/**
 * Живая фаза шагов потока (`validation.liveAfterStep`): шаг молчит до первой попытки «Далее» на
 * нём (`flow.next()`), дальше его правила проверяются на каждую правку либо уход из поля.
 *
 * Стратегия формы одна, и её живую фазу `afterFirstSubmit` включает только отправка. Живая фаза
 * шага — отдельный контроллер на правила шага: живой прогон проверяет только их и замечания
 * полей других шагов не трогает. Контроллер формы, который видит сборка, — составной: его
 * `start` / `dispose` армируют и снимают контроллеры шагов вместе с контроллером формы.
 *
 * @internal
 * @module form/step-live
 */

import { computed, signal } from '@preact/signals-core';
import type { FormModel } from '../model/types';
import type { NodeScope } from './signal-node-registry';
import { createFormValidation, type FormValidationController } from './validation/strategy';
import type { ValidationDefinition } from './validation/types';

/** Контроллер формы с живой фазой шагов: `armStep` — попытка «Далее» на шаге. */
export interface StepLiveController<T> extends FormValidationController {
  /** Включить живую фазу шага с этими правилами; повторно — ничего. */
  armStep(rules: ValidationDefinition<T>): void;
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
}

/**
 * Составной контроллер: контроллер формы плюс контроллеры шагов, чья живая фаза включена.
 *
 * @param form - Контроллер стратегии формы.
 */
export function createStepLiveController<T>(
  form: FormValidationController,
  options: StepLiveOptions<T>
): StepLiveController<T> {
  const { model, mode, debounce, nodes, submitMakesFormLive } = options;
  /** Контроллеры шагов по правилам шага. Переживают снятие (`dispose`) — как фаза формы. */
  const steps = new Map<ValidationDefinition<T>, FormValidationController>();
  const armed = signal<readonly FormValidationController[]>([]);
  /** Армирован ли составной контроллер: шаг, включённый позже, армируется сразу. */
  let started = false;
  /** Вся форма в живой фазе — шагам своя не нужна. */
  let formLive = false;

  const dropSteps = (): void => {
    steps.forEach((step) => step.dispose());
    steps.clear();
    armed.value = [];
  };

  const validating = computed(
    () => form.validating.value || armed.value.some((step) => step.validating.value)
  );

  const controller: StepLiveController<T> = {
    armStep(rules) {
      if (formLive || steps.has(rules)) return;
      const step = createFormValidation(model, rules, {
        strategy: mode,
        ...(debounce !== undefined ? { debounce } : {}),
        ...(nodes !== undefined ? { nodes } : {}),
      });
      steps.set(rules, step);
      armed.value = [...steps.values()];
      if (started) step.start();
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
      started = true;
      form.start();
      steps.forEach((step) => step.start());
      return () => controller.dispose();
    },
    resetPhase() {
      form.resetPhase();
      formLive = false;
      dropSteps();
    },
    dispose() {
      started = false;
      form.dispose();
      steps.forEach((step) => step.dispose());
    },
    get isValidating() {
      return validating.value;
    },
    validating,
  };
  return controller;
}
