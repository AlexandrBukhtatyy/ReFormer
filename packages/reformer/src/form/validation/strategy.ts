/**
 * Единый декларативный выбор СТРАТЕГИИ валидации — `@reformer/core/validation`.
 *
 * Стратегия решает только **КОГДА** запускать schema-валидацию и **с каким `touch`**. Движок прогона
 * не дублируется: раннер (`./run`) уже разносит ошибки по нодам, гасит валидные диффом, отменяет
 * устаревший прогон (`AbortController`) и дедуплицирует по идентичности `(model, schema)`. Реактивные
 * триггеры (`change`/`blur`) строятся тем же паттерном, что `revalidateWhen`: один `effect`, подписка на
 * ручки значений модели через {@link eachValueSignal} (без ручного перечисления зависимостей).
 *
 * @module form/validation/strategy
 */

import { effect, signal, untracked, type ReadonlySignal } from '@preact/signals-core';
import { eachValueSignal } from '../../model/create-model';
import type { FormModel, PathAwareSignal } from '../../model/types';
import { getNodeForSignal } from '../signal-node-registry';
import { cancelRun, isTouchByValidation, runAndApply } from './run';
import type { ValidationResult, ValidationDefinition } from './types';

/**
 * Когда запускается schema-валидация:
 * - `submit` (по умолчанию) — только явным вызовом `validate()` (на отправке);
 * - `blur` — при потере фокуса поля (каждый уход из любого листа, и повторный тоже);
 * - `change` — на каждый ввод (с опц. `debounce`);
 * - `afterFirstSubmit` — тихо до первого `validate()`, затем live (см. `liveAfterSubmit`).
 */
export type ValidationStrategyKind = 'submit' | 'blur' | 'change' | 'afterFirstSubmit';

export interface ValidationStrategyOptions {
  /** Стратегия запуска. Default `'submit'`. */
  strategy?: ValidationStrategyKind;
  /** Debounce (мс) для live-фаз (`change` и live-часть `afterFirstSubmit`). Default `0`. */
  debounce?: number;
  /** Режим live-фазы для `afterFirstSubmit`. Default `'change'`. */
  liveAfterSubmit?: 'change' | 'blur';
}

export interface FormValidationController {
  /**
   * Полный прогон схемы с раскрытием ошибок (`touch: true`) — для submit. Также переводит
   * `afterFirstSubmit` в live-фазу. Возвращает `true` только для статуса `valid`: ошибки, сбой
   * правила и отмена дают `false`.
   */
  validate(): Promise<boolean>;
  /**
   * Тот же полный прогон, что {@link FormValidationController.validate}, с полным результатом:
   * по статусу отличают ошибки (`invalid`) от сбоя правила (`error`) и отмены (`cancelled`).
   */
  run(): Promise<ValidationResult>;
  /**
   * Армировать реактивные подписки стратегии. Идемпотентно. Возвращает `dispose`. НЕ звать при SSR.
   *
   * После {@link FormValidationController.dispose} контроллер армируется ЗАНОВО: React монтирует
   * компоненты повторно (StrictMode в разработке, remount по роуту), и «одноразовый» контроллер
   * после такого цикла молча оставался бы без живой валидации.
   */
  start(): () => void;
  /**
   * Снять подписки и таймеры, отменить идущий прогон (его `validate()` или `run()` получит
   * `cancelled`). Идемпотентно; после него `start()` снова армирует стратегию.
   */
  dispose(): void;
  /** Идёт ли прогон (submit или live) — снапшот. */
  readonly isValidating: boolean;
  /** Реактивный сигнал состояния прогона (для тонкой подписки в UI). */
  readonly validating: ReadonlySignal<boolean>;
}

/**
 * Собрать контроллер валидации формы с выбранной стратегией запуска. Движок прогона — тот же, что у
 * `validateModel`.
 *
 * Фабрика ЧИСТАЯ до `start()` (никаких подписок) — безопасна для SSR/headless. Реактивные триггеры
 * арминуются только в `start()` (в React — из `useEffect`).
 *
 * @typeParam T - Форма данных модели.
 * @param model - Модель данных.
 * @param schema - Схема валидации. **Стабильная ссылка** (иначе устаревший прогон не отменится).
 * @param options - {@link ValidationStrategyOptions}.
 *
 * @example
 * ```ts
 * const ctrl = createFormValidation(model, schema, { strategy: 'afterFirstSubmit', debounce: 300 });
 * const dispose = ctrl.start();               // на клиенте
 * const ok = await ctrl.validate();           // submit → раскрыть все ошибки
 * dispose();
 * ```
 */
export function createFormValidation<T>(
  model: FormModel<T>,
  schema: ValidationDefinition<T>,
  options: ValidationStrategyOptions = {}
): FormValidationController {
  const { strategy = 'submit', debounce = 0, liveAfterSubmit = 'change' } = options;

  const _validating = signal(false);
  let inFlight = 0;
  let submitted = false;
  // Признак «стратегия армирована» — он же гарант идемпотентности start(). Отдельного флага
  // `disposed` НЕТ намеренно: контроллер переиспользуемый, см. док `start()`.
  let disposeFx: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async (touch: boolean): Promise<ValidationResult> => {
    inFlight++;
    _validating.value = true;
    try {
      // Проверка формы: выключенные поля не участвуют — как и в агрегате `valid`.
      return await runAndApply(model, schema, { touch, skipDisabled: true });
    } finally {
      if (--inFlight === 0) _validating.value = false;
    }
  };

  const fireLive = (): void => {
    // live-прогон НЕ метит touched — ошибки видны только по dirty/touched. Результат никто не ждёт,
    // поэтому исключение схемы ловится здесь: иначе оно осталось бы необработанным отклонением.
    run(false).catch((error: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error(
          '[@reformer/core/validation] живой прогон схемы завершился исключением',
          error
        );
      }
    });
  };
  const fireLiveDebounced = (): void => {
    if (!debounce) {
      fireLive();
      return;
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(fireLive, debounce);
  };

  // Реактивная арматура: подписка на листья модели + прогон (пропуск инициализирующего запуска,
  // как в `revalidateWhen`). Для `afterFirstSubmit` — тишина до первого `validate()`.
  const arm = (
    subscribe: (sig: PathAwareSignal<unknown>) => void,
    fire: () => void
  ): (() => void) => {
    let initial = true;
    return effect(() => {
      // Листья И массивы целиком: поле-мультивыбор живёт на сигнале массива, и его `touched`
      // иначе не попал бы в подписку стратегии `blur`.
      eachValueSignal(model, subscribe); // change: sig.value | blur: уходы из поля → подписка
      if (initial) {
        initial = false;
        return;
      }
      if (strategy === 'afterFirstSubmit' && !submitted) return;
      // Синхронная часть прогона (вся схема) идёт вне отслеживания: иначе её чтения — условие
      // `validateWhen`, сигнал вне модели — стали бы триггерами живой проверки.
      untracked(fire);
    });
  };

  const controller: FormValidationController = {
    async validate() {
      return (await controller.run()).status === 'valid';
    },
    run() {
      submitted = true; // двигает afterFirstSubmit в live-фазу
      return run(true); // submit → touch:true (раскрыть все ошибки)
    },
    start() {
      if (disposeFx) return () => controller.dispose(); // уже армирован — идемпотентно
      const mode = strategy === 'afterFirstSubmit' ? liveAfterSubmit : strategy;
      if (mode === 'change') {
        disposeFx = arm((sig) => void sig.value, fireLiveDebounced);
      } else if (mode === 'blur') {
        // blur — уже дискретное событие; дебаунс не нужен, метка touched сама раскрывает поле.
        // Подписка — на счётчик уходов, а не на саму метку: у тронутого поля `touched` при
        // повторном уходе не меняется, и поле, уже помеченное прошлым уходом, проверкой шага или
        // отказом отправки, иначе не перепроверялось бы вовсе. У контейнера счётчика нет — там метка.
        // Метку, которую ставит сама проверка (прогон с касанием, отказ отправки), за уход из поля
        // не считаем: иначе прогон будил бы лишний живой, а тот отменял бы его самого.
        disposeFx = arm(
          (sig) => {
            const node = getNodeForSignal(sig) as
              | { touched: ReadonlySignal<boolean>; touches?: ReadonlySignal<number> }
              | undefined;
            void (node?.touches ?? node?.touched)?.value;
          },
          () => {
            if (!isTouchByValidation()) fireLive();
          }
        );
      }
      // 'submit' — реактивно ничего не арминг (работает только validate()).
      return () => controller.dispose();
    },
    dispose() {
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
      disposeFx?.();
      disposeFx = undefined;
      // Идущий прогон тоже отменяется: его async-правило иначе ответило бы уже снятой форме.
      cancelRun(model as object, schema as object);
    },
    get isValidating() {
      return _validating.value;
    },
    get validating() {
      return _validating;
    },
  };

  return controller;
}
