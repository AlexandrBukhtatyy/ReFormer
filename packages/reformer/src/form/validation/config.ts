/**
 * Валидация как ЧАСТЬ КОНФИГА формы: правила описываются данными, а фабрика формы собирает из них
 * готовые функции.
 *
 * Движок тот же, что у `validateModel` и `createFormValidation`, но собранный один раз вместе с
 * формой — см. `createForm`.
 *
 * `form.validate()` и `form.submit()` правил не запускают: ноды отражают своё текущее состояние,
 * а schema-валидация — внешний прогон, который сам разносит ошибки по нодам.
 *
 * @module form/validation/config
 */

import { computed, signal, type ReadonlySignal } from '@preact/signals-core';
import type { FormModel } from '../../model/types';
import { apply } from './operators';
import { defineValidationSchema, runAndApply } from './run';
import type { ValidationResult, ValidationSchema } from './types';
import {
  createFormValidation,
  type FormValidationController,
  type ValidationStrategyKind,
} from './strategy';

/**
 * Правила валидации формы — ДАННЫЕ (без привязки к рендеру).
 *
 * ⚠️ `schema` и значения `steps` обязаны быть **стабильными ссылками**: отмена устаревших прогонов
 * ключуется по паре `(model, schema)` через `WeakMap`, поэтому инлайн-стрелка ломает дедупликацию —
 * валидация начнёт возвращать `false` от уже отменённых прогонов. Держите их
 * module-level-константами (`defineValidationSchema`).
 */
export interface FormValidation<T> {
  /** Полный набор правил — для submit и `validateAll`. Без него собирается из `steps` + `extras`. */
  schema?: ValidationSchema<T>;
  /**
   * Пошаговая валидация визарда: ключ = `selector` шага. `null` означает «шаг без правил» ЯВНО —
   * чтобы опечатка в ключе не выглядела как пустой шаг.
   */
  steps?: Record<string, ValidationSchema<T> | null>;
  /** Cross-field правила, которые проверяются только целиком (в `validateAll`), но не по шагам. */
  extras?: ValidationSchema<T>;
  /** Когда запускать живую валидацию. По умолчанию `'submit'` (реактивно молчит). */
  strategy?: ValidationStrategyKind;
  debounce?: number;
  /** Режим live-фазы для `afterFirstSubmit`. По умолчанию `'change'`. */
  liveAfterSubmit?: 'change' | 'blur';
}

/**
 * Собранная валидация формы. Структурно совместима с `FormWizardConfig` и `StepValidationConfig`
 * из `@reformer/cdk`, поэтому уходит в визард как есть: `config={bundle.validation}` либо
 * `patchProps({ form, ...bundle.validation })`.
 */
export interface FormValidationBundle<T> {
  /** Полная схема (стабильная ссылка) — та, по которой идёт `validateAll`. */
  readonly schema: ValidationSchema<T>;
  /** Селекторы шагов в порядке объявления. Пусто, если `steps` не заданы. */
  readonly stepSelectors: readonly string[];
  /** Полный прогон с раскрытием ошибок. Синоним {@link FormValidationBundle.validateAll}. */
  validate(): Promise<boolean>;
  /** Полный прогон с раскрытием ошибок; `true` только при статусе `valid`. */
  validateAll(): Promise<boolean>;
  /** Прогон правил одного шага: по номеру (1-based, как у визарда) или по селектору. */
  validateStep(step: number | string): Promise<boolean>;
  /**
   * Тот же полный прогон, что {@link FormValidationBundle.validateAll}, с полным результатом: по
   * статусу отличают ошибки (`invalid`) от сбоя правила (`error`) и отмены (`cancelled`).
   */
  runAll(): Promise<ValidationResult>;
  /** Тот же прогон шага, что {@link FormValidationBundle.validateStep}, с полным результатом. */
  runStep(step: number | string): Promise<ValidationResult>;
  /** Контроллер живой валидации ШАГА; `null` — у шага нет правил либо стратегия `submit`. */
  createStepController(step: number | string): FormValidationController | null;
  /** Контроллер живой валидации ФОРМЫ. Армится хуком (`useFormBundle`), не фабрикой. */
  readonly controller: FormValidationController;
  /**
   * Идёт ли прогон — полный либо шага (`validateStep` / `runStep`). Реактивный сигнал для тонкой
   * подписки в UI. Живую валидацию шага показывает сигнал её контроллера
   * ({@link FormValidationBundle.createStepController}).
   */
  readonly validating: ReadonlySignal<boolean>;
}

/** Схема-заглушка для шага без правил: прогон по ней всегда успешен. */
const EMPTY: ValidationSchema<never> = () => {};

/**
 * Собрать {@link FormValidationBundle} из правил. Принимает либо готовую схему (сахар для простых
 * форм), либо {@link FormValidation} с шагами и стратегией.
 *
 * Схема для `validateAll` собирается ОДИН раз на бандл — иначе ломается дедупликация прогонов.
 *
 * @typeParam T - Форма данных модели.
 * @param model - Модель, по которой идут прогоны.
 * @param validation - Правила; `undefined` — валидации у формы нет.
 * @returns Бандл валидации либо `undefined`, если правила не заданы.
 *
 * @example
 * ```ts
 * const v = buildValidation(model, {
 *   steps: { loan: loanRules, applicant: applicantRules, confirm: null },
 *   extras: crossFieldRules,
 *   strategy: 'blur',
 * });
 * await v!.validateStep(1);   // правила шага `loan`
 * await v!.validateAll();     // все шаги + extras
 *
 * const result = await v!.runAll();
 * if (result.status === 'error') showToast('Не удалось проверить форму, повторите попытку');
 * ```
 */
export function buildValidation<T>(
  model: FormModel<T>,
  validation?: FormValidation<T> | ValidationSchema<T>
): FormValidationBundle<T> | undefined {
  if (!validation) return undefined;
  const config: FormValidation<T> =
    typeof validation === 'function' ? { schema: validation } : validation;

  const stepSelectors = Object.keys(config.steps ?? {});
  const stepSchemas = stepSelectors
    .map((selector) => config.steps?.[selector])
    .filter((schema): schema is ValidationSchema<T> => schema != null);

  // Стабильная ссылка на весь набор правил: собирается один раз и переиспользуется всеми прогонами.
  const fullSchema =
    config.schema ??
    defineValidationSchema<T>(() =>
      apply(...stepSchemas, ...(config.extras ? [config.extras] : []))
    );

  /** Правила шага по номеру (1-based) или селектору; `null` — шага нет либо он объявлен без правил. */
  const schemaAt = (step: number | string): ValidationSchema<T> | null => {
    const selector = typeof step === 'number' ? stepSelectors[step - 1] : step;
    return (selector != null ? config.steps?.[selector] : null) ?? null;
  };

  const { strategy, debounce, liveAfterSubmit } = config;
  const controller = createFormValidation(model, fullSchema, {
    strategy,
    debounce,
    liveAfterSubmit,
  });

  // Прогоны шага идут мимо контроллера формы, поэтому считаются отдельно.
  const stepRuns = signal(0);
  const runStep = async (step: number | string): Promise<ValidationResult> => {
    stepRuns.value++;
    try {
      return await runAndApply(model, schemaAt(step) ?? (EMPTY as ValidationSchema<T>), {
        touch: true,
      });
    } finally {
      stepRuns.value--;
    }
  };

  return {
    schema: fullSchema,
    stepSelectors,
    validate: () => controller.validate(),
    validateAll: () => controller.validate(),
    validateStep: async (step) => (await runStep(step)).status === 'valid',
    runAll: () => controller.run(),
    runStep,
    createStepController: (step) => {
      // Живая валидация шага имеет смысл только при live-стратегии; шаг без правил не армируем.
      if (!strategy || strategy === 'submit') return null;
      const schema = schemaAt(step);
      if (!schema) return null;
      // Та же ссылка на под-схему, что и в validateStep → прогоны дедуплицируются.
      return createFormValidation(model, schema, { strategy, debounce, liveAfterSubmit });
    },
    controller,
    validating: computed(() => controller.validating.value || stepRuns.value > 0),
  };
}
