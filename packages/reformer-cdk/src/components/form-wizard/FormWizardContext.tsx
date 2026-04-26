import { createContext, useContext } from 'react';
import type { FormProxy } from '@reformer/core';

/**
 * Context value for FormWizard
 * Shares navigation state and methods with child components
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormWizardContextValue<T extends Record<string, any>> {
  // ============================================================================
  // State
  // ============================================================================

  /** Current step (1-based) */
  currentStep: number;

  /** Total number of steps */
  totalSteps: number;

  /** Completed steps */
  completedSteps: number[];

  /** Is this the first step */
  isFirstStep: boolean;

  /** Is this the last step */
  isLastStep: boolean;

  /** Is validation in progress */
  isValidating: boolean;

  /** Is form submitting */
  isSubmitting: boolean;

  /** Form instance */
  form: FormProxy<T>;

  // ============================================================================
  // Navigation Methods
  // ============================================================================

  /** Go to next step (with validation) */
  goToNextStep: () => Promise<boolean>;

  /** Go to previous step */
  goToPreviousStep: () => void;

  /** Go to specific step */
  goToStep: (step: number) => boolean;
}

/**
 * React context, который снабжает дочерние компоненты `FormWizard` (Step,
 * Actions, Indicator, Progress) текущим состоянием мастера. Создаётся
 * `FormWizard`. Читать через `useFormWizard()`.
 *
 * @example
 * ```tsx
 * import { FormWizardContext } from '@reformer/cdk/form-wizard';
 *
 * function CurrentStep() {
 *   const ctx = useContext(FormWizardContext);
 *   return <span>step {ctx?.currentStep}</span>;
 * }
 * ```
 */
// Using any for flexibility since context will be typed at usage site
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormWizardContext = createContext<FormWizardContextValue<any> | null>(null);

/**
 * Хук для доступа к контексту {@link FormWizard} из любого потомка.
 *
 * Возвращает текущее состояние мастера (`currentStep`, `totalSteps`,
 * `completedSteps`, `isFirstStep`, `isLastStep`, `isValidating`, `isSubmitting`,
 * `form`) и методы навигации (`goToNextStep`, `goToPreviousStep`, `goToStep`).
 * Бросает исключение, если вызван вне `<FormWizard>`.
 *
 * Для внешнего управления (вне дерева Wizard) используйте
 * {@link FormWizardHandle} через `useRef`.
 *
 * @typeParam T - Тип корневой формы (`FormProxy<T>`).
 * @returns Текущий {@link FormWizardContextValue}.
 * @throws Error если используется вне `<FormWizard>`.
 *
 * @example Минимальное использование внутри custom-step
 * ```tsx
 * function MyStepComponent() {
 *   const { currentStep, isLastStep } = useFormWizard();
 *   return <p>Шаг {currentStep}{isLastStep && ' — последний'}</p>;
 * }
 * ```
 *
 * @example Условный рендер кнопки на основе isValidating + completedSteps
 * ```tsx
 * function ProgressBadge() {
 *   const { currentStep, totalSteps, completedSteps, isValidating } =
 *     useFormWizard<CreditApplication>();
 *
 *   if (isValidating) return <span>Проверяем шаг {currentStep}...</span>;
 *   return (
 *     <span>
 *       Завершено {completedSteps.length} из {totalSteps}
 *     </span>
 *   );
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormWizard<T extends Record<string, any>>(): FormWizardContextValue<T> {
  const context = useContext(FormWizardContext);
  if (!context) {
    throw new Error('useFormWizard must be used within FormWizard');
  }
  return context as FormWizardContextValue<T>;
}
