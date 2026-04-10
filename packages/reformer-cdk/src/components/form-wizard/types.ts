import type { ReactNode } from 'react';
import type { FormProxy, ValidationSchemaFn } from '@reformer/core';

/**
 * Configuration for multi-step form navigation
 * Note: totalSteps is inferred from children count
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormWizardConfig<T extends Record<string, any>> {
  /** Validation schemas per step (1-based indexing) */
  stepValidations: Record<number, ValidationSchemaFn<T>>;

  /** Full validation schema for submit */
  fullValidation: ValidationSchemaFn<T>;
}

/**
 * Handle for external access to FormWizard methods via ref
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

  /** Step configuration (validation schemas) */
  config: FormWizardConfig<T>;

  /** Children (Step components, Indicator, Actions, Progress, or any ReactNode) */
  children?: ReactNode;

  /** Callback when step changes */
  onStepChange?: (step: number) => void;

  /** Scroll to top on step change */
  scrollToTop?: boolean;
}
