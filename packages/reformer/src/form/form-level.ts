/**
 * Уровень формы: проверка, проверка шага и отправка — с результатом-объектом, плюс поток шагов.
 *
 * Общая часть всех сборок: `createForm`, `createReactForm`, `createJsonForm` и монтирование формы
 * из реестра собирают его одной функцией {@link createFormLevel}, поэтому `validate`, `submit` и
 * поток ведут себя одинаково, как бы форма ни рисовалась.
 *
 * @group Form
 * @module form/form-level
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import { deepEqual } from '../model/model-nodes';
import { deferredWritesSettled } from '../model/safe-effect';
import type { FormModel } from '../model/types';
import { createFormFlow, type FormFlow } from './flow/flow';
import { getNodeForSignal } from './signal-node-registry';
import { apply } from './validation/operators';
import { defineValidation, runAndApply, touchByValidation } from './validation/run';
import {
  createFormValidation,
  type FormValidationController,
  type ValidationStrategyKind,
} from './validation/strategy';
import type { ValidationDefinition, ValidationResult } from './validation/types';

/**
 * Правила валидации формы и стратегия живой проверки.
 *
 * ⚠️ `rules` и `extras` обязаны быть **стабильными ссылками** (`defineValidation` в модуле): отмена
 * устаревших прогонов ключится по паре «модель + правила».
 *
 * @group Form
 */
export interface FormValidation<T> {
  /** Полный набор правил. Без него собирается из правил шагов потока и `extras`. */
  rules?: ValidationDefinition<T>;
  /** Правила, которые проверяются только целиком (отправка), но не по шагам. */
  extras?: ValidationDefinition<T>;
  /** Когда запускать живую проверку. По умолчанию `'submit'` — живой проверки нет. */
  strategy?: ValidationStrategyKind;
  debounce?: number;
  /** Режим живой фазы для `afterFirstSubmit`. По умолчанию `'change'`. */
  liveAfterSubmit?: 'change' | 'blur';
}

/**
 * Шаг потока: идентификатор (он же `selector` узла шага в схеме) и правила шага.
 *
 * @group Form
 */
export interface FlowStep<T> {
  readonly id: string;
  /** Правила шага; `null` или без поля — шаг без правил. */
  readonly rules?: ValidationDefinition<T> | null;
}

/**
 * Поток шагов в конфиге сборки.
 *
 * @group Form
 */
export interface FormFlowConfig<T> {
  readonly steps: readonly FlowStep<T>[];
}

/**
 * Итог отправки: `submitted` — обработчик отработал, `invalid` / `error` / `cancelled` —
 * проверка не пропустила (обработчик не вызывался), `failed` — обработчик бросил исключение.
 *
 * `cancelled` — проверку отправки сменила следующая (вторая отправка, живой прогон) либо модель
 * изменилась, пока проверка шла: правила видели прежние значения, и отправлять новые нельзя.
 * Замечаний такой итог не несёт — отправку повторяют.
 *
 * @group Form
 */
export type SubmitResult<TResult> =
  | { readonly status: 'submitted'; readonly result: TResult }
  | { readonly status: 'invalid' | 'error' | 'cancelled'; readonly validation: ValidationResult }
  | { readonly status: 'failed'; readonly error: unknown };

/**
 * Правила формы и контроллер живой проверки — его армирует `useFormBundle`.
 *
 * @group Form
 */
export interface FormValidationState<T> {
  /** Полный набор правил (стабильная ссылка). */
  readonly rules: ValidationDefinition<T>;
  readonly controller: FormValidationController;
}

/**
 * Уровень формы в бандле сборки.
 *
 * @group Form
 */
export interface FormLevel<T> {
  /** Поток шагов; без `flow` в конфиге — `undefined`. */
  readonly flow: FormFlow | undefined;
  /** Идёт ли проверка: полная или шага. */
  readonly validating: ReadonlySignal<boolean>;
  /** Идёт ли отправка. */
  readonly submitting: ReadonlySignal<boolean>;
  /** Правила и контроллер живой проверки; без правил — `undefined`. */
  readonly validation: FormValidationState<T> | undefined;
  /**
   * Проверить всю форму и показать замечания. Поля выключенных нод (`enableWhen`, `disable()`)
   * не учитываются — статус совпадает с `valid` формы.
   *
   * Правила читают модель в момент вызова. Исключение — вызов в одном тике со сборкой формы или
   * правкой поля: поведение ещё пишет отложенно (колбэк `onChange`, сброс `resetOnDisable`), и
   * проверка сначала дожидается этих записей; `validating` поднят сразу. Так же ведут себя
   * `validateStep` и `submit`.
   */
  validate(): Promise<ValidationResult>;
  /**
   * Проверить шаг потока (без выключенных полей); неизвестный шаг — исключение.
   *
   * Это отчёт о шаге, как `validate` — о форме. Переход делает `flow.next()`: он сверяет модель
   * и не переходит, если её изменили, пока шла проверка шага.
   */
  validateStep(stepId: string): Promise<ValidationResult>;
  /**
   * Отправить: один прогон всех правил; при успехе — обработчик со значениями модели.
   *
   * Обработчик получает ровно те значения, которые видели правила. Пока идёт async-правило,
   * форма не заперта (`submitting` ещё `false`); если модель за это время изменилась — правкой
   * пользователя, загрузкой, записью поведения после таймера или запроса, — итог `cancelled`,
   * обработчик не вызывается.
   */
  submit<TResult>(
    handler: (values: T) => TResult | Promise<TResult>
  ): Promise<SubmitResult<TResult>>;
}

/** Результат проверки без правил: замечаний нет. */
const VALID: ValidationResult = Object.freeze({
  status: 'valid',
  issues: new Map(),
  failures: [],
});

const AT = '[@reformer/core] createForm';

/**
 * Собрать уровень формы: правила, контроллер живой проверки, поток шагов и отправку.
 *
 * @typeParam T - Форма данных модели.
 * @param model - Модель формы.
 * @param config - Правила (`validation`) и поток (`flow`).
 * @returns {@link FormLevel}.
 * @throws Error если в потоке повторяется шаг.
 *
 * @example
 * ```typescript
 * const level = createFormLevel(model, {
 *   validation: { extras: crossRules },
 *   flow: { steps: [{ id: 'loan', rules: loanRules }, { id: 'confirm' }] },
 * });
 * const result = await level.submit(sendApplication);
 * if (result.status === 'invalid') showErrors();
 * ```
 *
 * @group Form
 */
export function createFormLevel<T>(
  model: FormModel<T>,
  config: {
    validation?: FormValidation<T> | ValidationDefinition<T>;
    flow?: FormFlowConfig<T>;
  }
): FormLevel<T> {
  const validation: FormValidation<T> =
    typeof config.validation === 'function'
      ? { rules: config.validation }
      : (config.validation ?? {});

  const stepRules = new Map<string, ValidationDefinition<T> | null>();
  for (const step of config.flow?.steps ?? []) {
    if (stepRules.has(step.id)) throw new Error(`${AT}: шаг потока «${step.id}» повторяется.`);
    stepRules.set(step.id, step.rules ?? null);
  }
  const stepSchemas = [...stepRules.values()].filter(
    (rules): rules is ValidationDefinition<T> => rules != null
  );

  // Полный набор правил — стабильная ссылка, собранная один раз: на ней держится отмена
  // устаревших прогонов.
  const rules =
    validation.rules ??
    (stepSchemas.length > 0 || validation.extras
      ? defineValidation<T>(() =>
          apply(...stepSchemas, ...(validation.extras ? [validation.extras] : []))
        )
      : undefined);

  const controller =
    rules !== undefined
      ? createFormValidation(model, rules, {
          strategy: validation.strategy,
          debounce: validation.debounce,
          liveAfterSubmit: validation.liveAfterSubmit,
        })
      : undefined;

  // Идущие проверки шага и проверки, ждущие отложенных записей поведения.
  const checks = signal(0);
  const submits = signal(0);

  /**
   * Запустить проверку, когда отработали отложенные записи поведения этого тика (колбэк
   * `onChange`, сброс выключенного поля): правила читают модель после них. Записей нет — запуск
   * синхронный, как обычно.
   */
  const afterBehaviorWrites = <R>(run: () => Promise<R>): Promise<R> => {
    const settling = deferredWritesSettled();
    if (!settling) return run();
    checks.value++;
    return settling.then(run).finally(() => {
      checks.value--;
    });
  };

  /**
   * Проверка для действия по её результату — отправки, перехода шага. Модель читается в момент
   * запуска правил и после прогона: пока идёт async-правило, форма не заперта, и успех проверки
   * может относиться к значениям, которых в модели уже нет (`stale`).
   */
  const checkForAction = async (
    run: () => Promise<ValidationResult>
  ): Promise<{ result: ValidationResult; values: T; stale: boolean }> => {
    let seen: unknown;
    const result = await afterBehaviorWrites(() => {
      seen = model.get();
      return run();
    });
    const values = model.get() as T;
    return { result, values, stale: result.status === 'valid' && !deepEqual(seen, values) };
  };

  const validate = (): Promise<ValidationResult> =>
    controller ? afterBehaviorWrites(() => controller.run()) : Promise.resolve(VALID);

  /** Правила шага: без правил — `null`, неизвестный шаг — исключение. */
  const rulesOfStep = (stepId: string): ValidationDefinition<T> | null => {
    if (!stepRules.has(stepId)) {
      const known = [...stepRules.keys()];
      throw new Error(
        `${AT}: шага «${stepId}» нет в потоке. ` +
          (known.length > 0 ? `Шаги потока: ${known.join(', ')}.` : 'Поток не задан: `flow`.')
      );
    }
    return stepRules.get(stepId) ?? null;
  };

  const runStep = async (step: ValidationDefinition<T>): Promise<ValidationResult> => {
    checks.value++;
    try {
      return await runAndApply(model, step, { touch: true, skipDisabled: true });
    } finally {
      checks.value--;
    }
  };

  const validateStep = async (stepId: string): Promise<ValidationResult> => {
    const step = rulesOfStep(stepId);
    return step ? afterBehaviorWrites(() => runStep(step)) : VALID;
  };

  /**
   * Проверка шага для перехода `flow.next()`. Переход — действие по результату: успех проверки о
   * значениях, которых в модели уже нет, — отмена, а не пройденный шаг.
   */
  const validateStepToMove = async (stepId: string): Promise<ValidationResult> => {
    const step = rulesOfStep(stepId);
    if (!step) return VALID;
    const { result, stale } = await checkForAction(() => runStep(step));
    return stale ? { ...result, status: 'cancelled' } : result;
  };

  const flow =
    config.flow !== undefined
      ? createFormFlow({ steps: [...stepRules.keys()], validateStep: validateStepToMove })
      : undefined;

  return {
    flow,
    validating: computed(() => (controller?.validating.value ?? false) || checks.value > 0),
    submitting: computed(() => submits.value > 0),
    validation: rules !== undefined && controller ? { rules, controller } : undefined,
    validate,
    validateStep,
    async submit(handler) {
      // Без правил сверять нечего: обработчик получает модель как есть.
      const checked = await (controller ? checkForAction(() => controller.run()) : undefined);
      const result = checked?.result ?? VALID;
      if (result.status !== 'valid') {
        // Показать замечания всех полей, а не только проверенных правилами. Одним batch и от имени
        // проверки: стратегия `blur` не запустит по живому прогону на каждое поле.
        touchByValidation(() => getNodeForSignal(model.$ as object)?.markAsTouched());
        return { status: result.status, validation: result };
      }
      // Модель изменилась, пока шла проверка: эти значения правила не видели — не отправлять.
      if (checked?.stale) {
        return { status: 'cancelled', validation: { ...result, status: 'cancelled' } };
      }
      const values = checked ? checked.values : (model.get() as T);
      submits.value++;
      try {
        return { status: 'submitted', result: await handler(values) };
      } catch (error) {
        return { status: 'failed', error };
      } finally {
        submits.value--;
      }
    },
  };
}
