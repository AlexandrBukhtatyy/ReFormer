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

// Using any for flexibility since context will be typed at usage site
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormWizardContext = createContext<FormWizardContextValue<any> | null>(null);

/**
 * Hook to access FormWizard context
 *
 * @example
 * ```tsx
 * function MyStepComponent() {
 *   const { currentStep, isLastStep } = useFormWizard();
 *   // ...
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
