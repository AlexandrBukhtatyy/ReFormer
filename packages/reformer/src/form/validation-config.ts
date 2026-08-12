/**
 * Валидация как ЧАСТЬ КОНФИГА формы: правила описываются данными, а фабрика формы собирает из них
 * готовые функции.
 *
 * Раньше правила и форма жили порознь: приложение отдельно строило форму, отдельно звало
 * `defineSteps`/`validateModel` и руками сводило результат в проп визарда. Здесь тот же движок
 * (`validateModel` + `createFormValidation`), но собранный один раз вместе с формой — см.
 * {@link module:reformer/form/create-core-form}.
 *
 * Привязки к `form.validate()`/`submit()` по-прежнему НЕТ: ноды отражают своё текущее состояние, а
 * schema-валидация остаётся внешним прогоном, который сам роутит ошибки в ноды.
 *
 * @module reformer/form/validation-config
 */

import type { ReadonlySignal } from '@preact/signals-core';
import type { FormModel } from '../state/types';
import {
  apply,
  defineValidationSchema,
  validateModel,
  type ValidationSchema,
} from './validation-schema';
import {
  createFormValidation,
  type FormValidationController,
  type ValidationStrategyKind,
} from './validation-strategy';

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
  validateAll(): Promise<boolean>;
  /** Прогон правил одного шага: по номеру (1-based, как у визарда) или по селектору. */
  validateStep(step: number | string): Promise<boolean>;
  /** Контроллер живой валидации ШАГА; `null` — у шага нет правил либо стратегия `submit`. */
  createStepController(step: number | string): FormValidationController | null;
  /** Контроллер живой валидации ФОРМЫ. Армится хуком (`useFormBundle`), не фабрикой. */
  readonly controller: FormValidationController;
  /** Идёт ли прогон — реактивный сигнал (для тонкой подписки в UI). */
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

  return {
    schema: fullSchema,
    stepSelectors,
    validate: () => controller.validate(),
    validateAll: () => controller.validate(),
    validateStep: (step) =>
      validateModel(model, schemaAt(step) ?? (EMPTY as ValidationSchema<T>), { touch: true }),
    createStepController: (step) => {
      // Живая валидация шага имеет смысл только при live-стратегии; шаг без правил не армируем.
      if (!strategy || strategy === 'submit') return null;
      const schema = schemaAt(step);
      if (!schema) return null;
      // Та же ссылка на под-схему, что и в validateStep → прогоны дедуплицируются.
      return createFormValidation(model, schema, { strategy, debounce, liveAfterSubmit });
    },
    controller,
    validating: controller.validating,
  };
}
