// Main compound component
export { FormNavigation } from './FormNavigation';

// Step marker component for wizard schemas
export { Step, type StepProps } from './Step';

// Wizard selector utilities
export {
  useNavigationSelectors,
  parseStepNumber,
  type WizardSelector,
  type WizardSelectorNode,
  type WizardComponentProps,
  type StepMetadata,
  type ParsedWizardSelectors,
} from './useNavigationSelectors';

// Sub-components (also available as FormNavigation.Step, etc.)
export { FormNavigationStep } from './FormNavigationStep';
export { FormNavigationIndicator } from './FormNavigationIndicator';
export { FormNavigationActions, useFormNavigationActions } from './FormNavigationActions';
export { FormNavigationProgress } from './FormNavigationProgress';

// Action button components (also available as FormNavigation.Prev, etc.)
export { FormNavigationPrev } from './FormNavigationPrev';
export { FormNavigationNext } from './FormNavigationNext';
export { FormNavigationSubmit } from './FormNavigationSubmit';

// Slot utility for asChild pattern
export { Slot } from './Slot';
export type { SlotProps } from './Slot';

// Context and hook
export { useFormNavigation, FormNavigationContext } from './FormNavigationContext';

// Types - Main
export type { FormNavigationHandle, FormNavigationProps, FormNavigationConfig } from './types';

export type { FormNavigationStepProps } from './FormNavigationStep';
export type { FormNavigationContextValue } from './FormNavigationContext';

// Types - Indicator (headless)
export type {
  FormNavigationIndicatorProps,
  FormNavigationIndicatorStep,
  FormNavigationIndicatorStepWithState,
  FormNavigationIndicatorRenderProps,
} from './FormNavigationIndicator';

// Types - Actions (headless + compound)
export type {
  FormNavigationActionsProps,
  FormNavigationActionsRenderProps,
  FormNavigationButtonProps,
  FormNavigationSubmitProps as FormNavigationSubmitRenderProps,
} from './FormNavigationActions';

// Types - Action buttons
export type { FormNavigationPrevProps } from './FormNavigationPrev';
export type { FormNavigationNextProps } from './FormNavigationNext';
export type { FormNavigationSubmitProps } from './FormNavigationSubmit';

// Types - Progress (headless)
export type {
  FormNavigationProgressProps,
  FormNavigationProgressRenderProps,
} from './FormNavigationProgress';
