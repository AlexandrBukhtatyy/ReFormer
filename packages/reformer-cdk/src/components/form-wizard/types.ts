import type { ReactNode } from 'react';
import type { FormProxy } from '@reformer/core';

/**
 * Configuration for multi-step form navigation.
 * Note: totalSteps is inferred from children count. Валидация под M1 — через колбэки,
 * не зависит от типа формы, поэтому конфиг не дженерик.
 */
export interface FormWizardConfig {
  /**
   * M1: валидация шага (1-based) через колбэк (обычно — обёртка над
   * `validateModel(model, stepSchema)` из `@reformer/core/validation`).
   * Возвращает `true`, если шаг валиден. Нет колбэка → шаг считается валидным.
   */
  validateStep?: (step: number) => boolean | Promise<boolean>;

  /**
   * M1: валидация всей формы перед submit. Нет колбэка → submit без блокировки.
   */
  validateAll?: () => boolean | Promise<boolean>;
}

/**
 * Handle для внешнего управления {@link FormWizard} через `useRef`.
 *
 * Используется, когда submit/навигация инициируется снаружи дерева Wizard:
 * шапка страницы, breadcrumbs, side-effect от API. Получают через
 * `useRef<FormWizardHandle<T>>(null)` и передают в `<FormWizard ref={...}>`.
 *
 * - `goToNextStep()` / `submit()` запускают валидацию текущего шага / всей
 *   формы соответственно.
 * - `goToStep(n)` возвращает `false`, если предыдущий шаг не в `completedSteps`
 *   (защита от пропуска валидации) либо `n` вне диапазона `[1; totalSteps]`.
 * - `submit()` возвращает `R | null`. `null` — форма не прошла `validateAll`.
 *
 * @typeParam T - Тип значения корневой формы (`FormProxy<T>`).
 *
 * @example «Сохранить и выйти» поверх wizard
 * ```tsx
 * import { useRef } from 'react';
 * import { FormWizard, type FormWizardHandle } from '@reformer/cdk/form-wizard';
 *
 * function Page({ form, config }: Props) {
 *   const navRef = useRef<FormWizardHandle<CreditApplication>>(null);
 *
 *   const handleSaveAndExit = async () => {
 *     const saved = await navRef.current?.submit((values) => api.saveDraft(values));
 *     if (saved) router.push('/dashboard');
 *   };
 *
 *   return (
 *     <>
 *       <header>
 *         <button onClick={handleSaveAndExit}>Сохранить и выйти</button>
 *       </header>
 *       <FormWizard ref={navRef} form={form} config={config}>
 *         <FormWizard.Step component={Step1} control={form} />
 *         <FormWizard.Step component={Step2} control={form} />
 *       </FormWizard>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Программный переход на шаг с проверкой доступности
 * ```tsx
 * const handleClickContacts = () => {
 *   const ok = navRef.current?.goToStep(3);
 *   if (!ok) toast('Сначала заполните предыдущие шаги');
 * };
 *
 * // Или с явной валидацией текущего шага:
 * const moveOn = async () => {
 *   const valid = await navRef.current?.validateCurrentStep();
 *   if (!valid) return;
 *   await navRef.current?.goToNextStep();
 * };
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormWizardHandle<T extends Record<string, any>> {
  /** Form instance — используется в RenderBehaviorFn для доступа к форме через ref */
  form: FormProxy<T>;

  /** Current step (1-based) */
  currentStep: number;

  /** Completed steps */
  completedSteps: number[];

  /** Validate current step */
  validateCurrentStep: () => Promise<boolean>;

  /** Go to next step (with validation) */
  goToNextStep: () => Promise<boolean>;

  /** Go to previous step */
  goToPreviousStep: () => void;

  /** Go to specific step */
  goToStep: (step: number) => boolean;

  /** Submit form (with full validation) */
  submit: <R>(onSubmit: (values: T) => Promise<R> | R) => Promise<R | null>;

  /** Is this the first step */
  isFirstStep: boolean;

  /** Is this the last step */
  isLastStep: boolean;

  /** Is validation in progress */
  isValidating: boolean;
}

/**
 * Props for FormWizard component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormWizardProps<T extends Record<string, any>> {
  /** Form instance */
  form: FormProxy<T>;

  /** Step configuration (validation callbacks) */
  config: FormWizardConfig;

  /** Children (Step components, Indicator, Actions, Progress, or any ReactNode) */
  children?: ReactNode;

  /** Callback when step changes */
  onStepChange?: (step: number) => void;

  /** Scroll to top on step change */
  scrollToTop?: boolean;
}
