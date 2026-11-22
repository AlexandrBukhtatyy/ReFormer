/**
 * Живая фаза шагов потока (`validation.liveAfterStep`): шаг молчит до первой попытки «Далее» на
 * нём (`flow.next()`), дальше его правила проверяются на каждую правку либо уход из поля — пока
 * поток стоит на этом шаге.
 *
 * Стратегия формы одна, и её живую фазу `afterFirstSubmit` включает только отправка. Живая фаза
 * шага — отдельный контроллер на правила шага: живой прогон проверяет только их и замечания
 * полей других шагов не трогает. Контроллер формы, который видит сборка, — составной: его
 * `start` / `dispose` армируют и снимают контроллеры шагов вместе с контроллером формы.
 *
 * Армирован только контроллер текущего шага потока. Поля пройденных шагов не на экране, и
 * перепроверять их правила на каждую правку другого шага — работа, которую никто не увидит; на
 * пятом шаге формы это пять прогонов на клавишу вместо одного. Межшаговые замечания ловит
 * отправка. Возврат на пройденный шаг армирует его снова и один раз перепроверяет: пока поток
 * стоял на другом шаге, поле этого могло измениться поведением (`computeFrom`, `copyFrom`,
 * `resetWhen`), и замечания шага должны быть о том, что видно сейчас. Исключение — переход, который
 * делает отказ отправки (`flow.onInvalidSubmit`): отправка только что проверила правила шага.
 *
 * @internal
 * @module form/step-live
 */

import { computed, effect, signal, untracked, type ReadonlySignal } from '@preact/signals-core';
import type { FormModel } from '../model/types';
import type { NodeScope } from './signal-node-registry';
import { runAndApply } from './validation/run';
import { createFormValidation, type FormValidationController } from './validation/strategy';
import type { ValidationDefinition } from './validation/types';

/** Контроллер формы с живой фазой шагов: `armStep` — попытка «Далее» на шаге. */
export interface StepLiveController<T> extends FormValidationController {
  /** Включить живую фазу шага с этими правилами; повторно — ничего. */
  armStep(stepId: string, rules: ValidationDefinition<T>): void;
  /**
   * Перевести поток без перепроверки шага, на который он придёт: его правила только что проверил
   * прогон, который и переводит поток (отказ отправки с `flow.onInvalidSubmit`). Шаг всё равно
   * становится живым.
   */
  moveChecked(move: () => void): void;
}

export interface StepLiveOptions<T> {
  model: FormModel<T>;
  /** Режим живой фазы шага. */
  mode: 'change' | 'blur';
  debounce: number | undefined;
  nodes: NodeScope | undefined;
  /**
   * Отправка переводит в живую фазу всю форму (`afterFirstSubmit`): контроллеры шагов после неё
   * только повторяли бы её прогоны — они снимаются, пока сброс формы не вернёт тихую фазу.
   */
  submitMakesFormLive: boolean;
  /** Текущий шаг потока: живая фаза армирована только у него. */
  current: ReadonlySignal<string>;
}

/** Шаг с включённой живой фазой: его правила и контроллер. */
interface LiveStep<T> {
  readonly rules: ValidationDefinition<T>;
  readonly controller: FormValidationController;
}

/**
 * Составной контроллер: контроллер формы плюс контроллер текущего шага, если его живая фаза
 * включена.
 *
 * @param form - Контроллер стратегии формы.
 */
export function createStepLiveController<T>(
  form: FormValidationController,
  options: StepLiveOptions<T>
): StepLiveController<T> {
  const { model, mode, debounce, nodes, submitMakesFormLive, current } = options;
  /**
   * Шаги с включённой живой фазой по идентификатору шага. Переживают снятие (`dispose`) — как
   * фаза формы: после повторного `start` текущий шаг снова живой.
   */
  const steps = signal<ReadonlyMap<string, LiveStep<T>>>(new Map());
  /** Шаг, чей контроллер армирован сейчас. */
  let active: LiveStep<T> | undefined;
  /** Подписка на текущий шаг потока; есть, пока составной контроллер армирован. */
  let stopFollowing: (() => void) | undefined;
  /** Идущие перепроверки шага при возврате на него. */
  const refreshing = signal(0);
  /** Вся форма в живой фазе — шагам своя не нужна. */
  let formLive = false;
  /** Идёт переход без перепроверки шага — {@link StepLiveController.moveChecked}. */
  let movingChecked = false;

  /** Армировать контроллер шага (или никакой) вместо прежнего. */
  const activate = (step: LiveStep<T> | undefined): void => {
    if (step === active) return;
    active?.controller.dispose();
    active = step;
    step?.controller.start();
  };

  /**
   * Перепроверить шаг, на который вернулся поток: живой прогон его правил без касания. Результат
   * никто не ждёт — исключение правила ловится здесь, как в живом прогоне стратегии. Снятие
   * контроллера шага отменяет и этот прогон: правила и модель у них общие.
   */
  const refresh = (step: LiveStep<T>): void => {
    refreshing.value++;
    runAndApply(model, step.rules, { touch: false, skipDisabled: true, nodes, live: true })
      .catch((error: unknown) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[@reformer/core] живой прогон шага завершился исключением', error);
        }
      })
      .finally(() => {
        refreshing.value--;
      });
  };

  const dropSteps = (): void => {
    activate(undefined);
    steps.value = new Map();
  };

  const validating = computed(
    () =>
      form.validating.value ||
      refreshing.value > 0 ||
      [...steps.value.values()].some((step) => step.controller.validating.value)
  );

  const controller: StepLiveController<T> = {
    armStep(stepId, rules) {
      if (formLive || steps.peek().has(stepId)) return;
      const step: LiveStep<T> = {
        rules,
        controller: createFormValidation(model, rules, {
          strategy: mode,
          ...(debounce !== undefined ? { debounce } : {}),
          ...(nodes !== undefined ? { nodes } : {}),
        }),
      };
      // Армирует его подписка на текущий шаг — если составной контроллер армирован.
      steps.value = new Map([...steps.peek(), [stepId, step]]);
    },
    moveChecked(move) {
      movingChecked = true;
      try {
        move();
      } finally {
        movingChecked = false;
      }
    },
    validate: () => form.validate(),
    run(runOptions) {
      if (runOptions?.submit && submitMakesFormLive) {
        formLive = true;
        dropSteps();
      }
      return form.run(runOptions);
    },
    start() {
      form.start();
      if (!stopFollowing) {
        /** Шаг, на котором поток стоял при прошлом запуске подписки. */
        let shown: string | undefined;
        stopFollowing = effect(() => {
          const stepId = current.value;
          const step = steps.value.get(stepId);
          untracked(() => {
            // Перепроверка — только при возврате на шаг. Армирование шага, на котором поток
            // стоит, перепроверки не просит: «Далее», которое его армирует, само проверяет шаг.
            // Не просит и переход, который сделал сам прогон, проверивший шаг (`moveChecked`).
            const returned = shown !== undefined && shown !== stepId;
            shown = stepId;
            activate(step);
            if (returned && step && !movingChecked) refresh(step);
          });
        });
      }
      return () => controller.dispose();
    },
    resetPhase() {
      form.resetPhase();
      formLive = false;
      dropSteps();
    },
    dispose() {
      stopFollowing?.();
      stopFollowing = undefined;
      form.dispose();
      activate(undefined);
    },
    get isValidating() {
      return validating.value;
    },
    validating,
  };
  return controller;
}
