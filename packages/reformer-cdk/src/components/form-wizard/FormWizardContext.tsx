import { createContext, useContext } from 'react';
import type { FormFlow, FormGroup, SubmitResult } from '@reformer/core';

/**
 * Контекст визарда: форма, поток шагов и производные для кнопок и индикатора (номер шага с
 * единицы — `flow.index + 1`).
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
  form: FormGroup<T>;

  /** Поток шагов: переходы и правила доступности шагов. */
  flow: FormFlow;

  // ============================================================================
  // Navigation Methods
  // ============================================================================

  /** Go to next step (with validation) */
  goToNextStep: () => Promise<boolean>;

  /** Go to previous step */
  goToPreviousStep: () => void;

  /** Go to specific step */
  goToStep: (step: number) => boolean;

  // ============================================================================
  // Submit
  // ============================================================================

  /**
   * Отправить форму. Внутри сборки (`FormBundleContext`) — через `bundle.submit`: обработчик
   * зовётся только после успешной проверки всей формы. Без сборки обработчик зовётся сразу, а
   * проверку делает приложение.
   */
  submit: <R>(handler: (values: T) => Promise<R> | R) => Promise<SubmitResult<R>>;
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
 * Возвращает форму и поток шагов (`form`, `flow`), производное состояние мастера
 * (`currentStep` с единицы, `totalSteps`, `completedSteps`, `isFirstStep`, `isLastStep`,
 * `isValidating`, `isSubmitting`), методы навигации (`goToNextStep`, `goToPreviousStep`,
 * `goToStep`) и `submit` — отправку: внутри сборки через `bundle.submit`, результат — объект
 * со статусом. Бросает исключение, если вызван вне `<FormWizard>`.
 *
 * Управление снаружи дерева визарда — через сам поток: `bundle.flow.goTo('loan')`.
 *
 * @typeParam T - Тип корневой формы (`FormGroup<T>`).
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
