/**
 * defineSteps — конфиг валидации {@link FormWizard} из правил, адресованных по `selector` шага (§5).
 *
 * Раньше правила шагов держались МАССИВОМ (`STEP_SCHEMAS[step - 1]`): добавление или перестановка
 * шага молча рассинхронизировали правила с позицией, а шаг без правил получался «валидным» по
 * умолчанию (тихая дыра). `defineSteps` адресует правила по `selector` (тот же id, что у ноды шага
 * `$component(Step)` в схеме): порядок ключей = порядок шагов; шаг без правил объявляется ЯВНО
 * (`null`). Хрупкая индексация `[step - 1]` инкапсулирована здесь — приложение её больше не пишет.
 *
 * Аддитивно: возвращает обычный {@link FormWizardConfig}, который визард потребляет как раньше.
 *
 * @module reformer/cdk/form-wizard/define-steps
 */
import type { FormModel } from '@reformer/core';
import {
  validateModel,
  defineValidationSchema,
  apply,
  createFormValidation,
  type ValidationSchema,
  type ValidationStrategyKind,
  type FormValidationController,
} from '@reformer/core/validation';
import type { FormWizardConfig } from './types';

/** Конфиг {@link defineSteps}: правила шагов по `selector` + form-level extras + live-стратегия шага. */
export interface DefineStepsConfig<Sel extends string, T> {
  /**
   * Правила шагов. Ключ = `selector` шага (совпадает с id ноды шага в схеме); порядок ключей =
   * порядок шагов в визарде. `null` — шаг без правил (объявляется ЯВНО, а не молча по умолчанию).
   */
  steps: Record<Sel, ValidationSchema<T> | null>;
  /** Cross-field/warnings уровня всей формы — применяются только в `validateAll` (submit). */
  extras?: ValidationSchema<T>;
  /**
   * Live-стратегия ВНУТРИ активного шага (`blur`/`change`/`afterFirstSubmit`) — для
   * {@link useWizardStepValidation}. Не задана / `'submit'` → живой валидации внутри шага нет
   * (остаётся только per-step gate на «Далее» + submit). Аддитивно: per-step gate/submit не меняются.
   */
  strategy?: ValidationStrategyKind;
  /** Debounce (мс) для live-фаз внутришаговой стратегии (`change` / live-часть `afterFirstSubmit`). */
  debounce?: number;
  /** Режим live-фазы для `afterFirstSubmit`. Default `'change'`. */
  liveAfterSubmit?: 'change' | 'blur';
}

/** Результат {@link defineSteps}: {@link FormWizardConfig} + упорядоченный список селекторов шагов. */
export interface WizardStepsConfig<Sel extends string> extends FormWizardConfig {
  /** Валидация шага по номеру (1-based) — defineSteps всегда её возвращает (в базе она опциональна). */
  validateStep: (step: number) => Promise<boolean>;
  /** Полная валидация (submit) — всегда возвращается. */
  validateAll: () => Promise<boolean>;
  /** Селекторы шагов по порядку (индекс = `step - 1`). Для селекторной адресации/отладки. */
  stepSelectors: Sel[];
  /**
   * Контроллер live-стратегии для под-схемы шага (1-based) — для {@link useWizardStepValidation}.
   * Возвращает `null`, если live-стратегия не задана (`strategy` отсутствует / `'submit'`) или у
   * шага нет правил. Тип {@link FormValidationController} не зависит от `T`.
   */
  createStepController: (step: number) => FormValidationController | null;
}

/**
 * Строит {@link FormWizardConfig} из правил, адресованных по `selector` шага. `validateStep(n)`
 * резолвит `n → selector → правила`; `validateAll` — все шаги + `extras`. Обе помечают `touched`
 * только провалидированные поля (`{ touch: true }`, §6). Результат — обычный конфиг, визард
 * потребляет его без изменений.
 *
 * @typeParam Sel - Union селекторов шагов.
 * @typeParam T - Форма данных модели.
 * @param model - Модель формы.
 * @param config - {@link DefineStepsConfig}: `steps` (по `selector`) + опц. `extras`.
 * @returns {@link WizardStepsConfig} — `{ validateStep, validateAll, stepSelectors }`.
 *
 * @example
 * ```ts
 * const config = defineSteps<'loan' | 'applicant' | 'confirm', Root>(model, {
 *   steps: { loan: step1, applicant: step2, confirm: null }, // confirm — без правил, ЯВНО
 *   extras: crossFieldRules,
 * });
 * <FormWizard form={form} config={config}>…</FormWizard>
 * ```
 */
export function defineSteps<Sel extends string, T extends object>(
  model: FormModel<T>,
  config: DefineStepsConfig<Sel, T>
): WizardStepsConfig<Sel> {
  const stepSelectors = Object.keys(config.steps) as Sel[];
  const empty: ValidationSchema<T> = () => {};
  const stepSchemas = stepSelectors
    .map((s) => config.steps[s])
    .filter((s): s is ValidationSchema<T> => s != null);
  // Полная схема (submit): все непустые шаги + extras. Стабильная ссылка (важно для дедупликации
  // устаревших прогонов в validateModel).
  const fullSchema = defineValidationSchema<T>(() =>
    apply(...stepSchemas, ...(config.extras ? [config.extras] : []))
  );
  const { strategy, debounce, liveAfterSubmit } = config;
  return {
    stepSelectors,
    validateStep: (step: number): Promise<boolean> => {
      const selector = stepSelectors[step - 1];
      const schema = (selector != null ? config.steps[selector] : null) ?? empty;
      return validateModel(model, schema, { touch: true });
    },
    validateAll: (): Promise<boolean> => validateModel(model, fullSchema, { touch: true }),
    createStepController: (step: number): FormValidationController | null => {
      // Live-стратегия внутри шага опциональна; без неё (или 'submit') армировать нечего —
      // остаётся только per-step gate на «Далее». Шаг без правил (null) тоже не армируем.
      if (!strategy || strategy === 'submit') return null;
      const selector = stepSelectors[step - 1];
      const schema = selector != null ? config.steps[selector] : null;
      if (schema == null) return null;
      // Та же ссылка на под-схему шага, что и в validateStep → validateModel дедуплицирует прогоны.
      return createFormValidation(model, schema, { strategy, debounce, liveAfterSubmit });
    },
  };
}
