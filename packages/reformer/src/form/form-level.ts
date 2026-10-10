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
   */
  validate(): Promise<ValidationResult>;
  /** Проверить шаг потока (без выключенных полей); неизвестный шаг — исключение. */
  validateStep(stepId: string): Promise<ValidationResult>;
  /**
   * Отправить: один прогон всех правил; при успехе — обработчик со значениями модели.
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

  const stepRuns = signal(0);
  const submits = signal(0);

  const validate = (): Promise<ValidationResult> =>
    controller ? controller.run() : Promise.resolve(VALID);

  const validateStep = async (stepId: string): Promise<ValidationResult> => {
    if (!stepRules.has(stepId)) {
      const known = [...stepRules.keys()];
      throw new Error(
        `${AT}: шага «${stepId}» нет в потоке. ` +
          (known.length > 0 ? `Шаги потока: ${known.join(', ')}.` : 'Поток не задан: `flow`.')
      );
    }
    const step = stepRules.get(stepId);
    if (!step) return VALID;
    stepRuns.value++;
    try {
      return await runAndApply(model, step, { touch: true, skipDisabled: true });
    } finally {
      stepRuns.value--;
    }
  };

  const flow =
    config.flow !== undefined
      ? createFormFlow({ steps: [...stepRules.keys()], validateStep })
      : undefined;

  return {
    flow,
    validating: computed(() => (controller?.validating.value ?? false) || stepRuns.value > 0),
    submitting: computed(() => submits.value > 0),
    validation: rules !== undefined && controller ? { rules, controller } : undefined,
    validate,
    validateStep,
    async submit(handler) {
      const result = await validate();
      if (result.status !== 'valid') {
        // Показать замечания всех полей, а не только проверенных правилами. Одним batch и от имени
        // проверки: стратегия `blur` не запустит по живому прогону на каждое поле.
        touchByValidation(() => getNodeForSignal(model.$ as object)?.markAsTouched());
        return { status: result.status, validation: result };
      }
      submits.value++;
      try {
        return { status: 'submitted', result: await handler(model.get() as T) };
      } catch (error) {
        return { status: 'failed', error };
      } finally {
        submits.value--;
      }
    },
  };
}
