import { createContext, useContext } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';

/**
 * Context value for FormNavigation
 * Shares navigation state and methods with child components
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormNavigationContextValue<T extends Record<string, any>> {
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
  form: GroupNodeWithControls<T>;

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
export const FormNavigationContext = createContext<FormNavigationContextValue<any> | null>(null);

/**
 * Hook to access FormNavigation context
 *
 * @example
 * ```tsx
 * function MyStepComponent() {
 *   const { currentStep, isLastStep } = useFormNavigation();
 *   // ...
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFormNavigation<T extends Record<string, any>>(): FormNavigationContextValue<T> {
  const context = useContext(FormNavigationContext);
  if (!context) {
    throw new Error('useFormNavigation must be used within FormNavigation');
  }
  return context as FormNavigationContextValue<T>;
}
