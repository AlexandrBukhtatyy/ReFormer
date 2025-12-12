import type { ReactNode } from 'react';
import type { GroupNodeWithControls, ValidationSchemaFn } from '@reformer/core';

/**
 * Configuration for multi-step form navigation
 * Note: totalSteps is inferred from children count
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormNavigationConfig<T extends Record<string, any>> {
  /** Validation schemas per step (1-based indexing) */
  stepValidations: Record<number, ValidationSchemaFn<T>>;

  /** Full validation schema for submit */
  fullValidation: ValidationSchemaFn<T>;
}

/**
 * Handle for external access to FormNavigation methods via ref
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormNavigationHandle<T extends Record<string, any>> {
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
 * Props for FormNavigation component
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FormNavigationProps<T extends Record<string, any>> {
  /** Form instance */
  form: GroupNodeWithControls<T>;

  /** Step configuration (validation schemas) */
  config: FormNavigationConfig<T>;

  /** Children (Step components, Indicator, Actions, Progress, or any ReactNode) */
  children: ReactNode;

  /** Callback when step changes */
  onStepChange?: (step: number) => void;

  /** Scroll to top on step change */
  scrollToTop?: boolean;
}

// ============================================================================
// Legacy type aliases for backward compatibility
// ============================================================================

/** @deprecated Use FormNavigationConfig instead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StepNavigationConfig<T extends Record<string, any>> = FormNavigationConfig<T> & {
  /** @deprecated totalSteps is now inferred from children count */
  totalSteps?: number;
};

/** @deprecated Use FormNavigationHandle instead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type StepNavigationHandle<T extends Record<string, any>> = FormNavigationHandle<T>;

/** @deprecated Render state is no longer used with compound components */
export interface StepNavigationRenderState {
  currentStep: number;
  completedSteps: number[];
  isFirstStep: boolean;
  isLastStep: boolean;
  isValidating: boolean;
}

/** @deprecated Use FormNavigationProps instead */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface StepNavigationProps<T extends Record<string, any>> {
  form: GroupNodeWithControls<T>;
  config: StepNavigationConfig<T>;
  children: (state: StepNavigationRenderState) => React.ReactNode;
  onStepChange?: (step: number) => void;
  scrollToTop?: boolean;
}
