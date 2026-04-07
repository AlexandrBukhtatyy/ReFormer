// Main compound component
export { FormWizard } from './FormWizard';

// Step marker component for wizard schemas
export { Step, type StepProps } from './Step';

// Sub-components (also available as FormWizard.Step, etc.)
export { FormWizardStep } from './FormWizardStep';
export { FormWizardIndicator } from './FormWizardIndicator';
export { FormWizardActions, useFormWizardActions } from './FormWizardActions';
export { FormWizardProgress } from './FormWizardProgress';

// Action button components (also available as FormWizard.Prev, etc.)
export { FormWizardPrev } from './FormWizardPrev';
export { FormWizardNext } from './FormWizardNext';
export { FormWizardSubmit } from './FormWizardSubmit';

// Slot utility for asChild pattern
export { Slot } from './Slot';
export type { SlotProps } from './Slot';

// Context and hook
export { useFormWizard, FormWizardContext } from './FormWizardContext';

// Types - Main
export type { FormWizardHandle, FormWizardProps, FormWizardConfig } from './types';

export type { FormWizardStepProps } from './FormWizardStep';
export type { FormWizardContextValue } from './FormWizardContext';

// Types - Indicator (headless)
export type {
  FormWizardIndicatorProps,
  FormWizardIndicatorStep,
  FormWizardIndicatorStepWithState,
  FormWizardIndicatorRenderProps,
} from './FormWizardIndicator';

// Types - Actions (headless + compound)
export type {
  FormWizardActionsProps,
  FormWizardActionsRenderProps,
  FormWizardButtonProps,
  FormWizardSubmitProps as FormWizardSubmitRenderProps,
} from './FormWizardActions';

// Types - Action buttons
export type { FormWizardPrevProps } from './FormWizardPrev';
export type { FormWizardNextProps } from './FormWizardNext';
export type { FormWizardSubmitProps } from './FormWizardSubmit';

// Types - Progress (headless)
export type { FormWizardProgressProps, FormWizardProgressRenderProps } from './FormWizardProgress';
