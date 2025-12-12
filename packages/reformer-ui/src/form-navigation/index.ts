// Main compound component
export { FormNavigation } from './FormNavigation';

// Sub-components (also available as FormNavigation.Step, etc.)
export { FormNavigationStep } from './FormNavigationStep';
export { FormNavigationIndicator } from './FormNavigationIndicator';
export { FormNavigationActions } from './FormNavigationActions';
export { FormNavigationProgress } from './FormNavigationProgress';

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

// Types - Actions (headless)
export type {
  FormNavigationActionsProps,
  FormNavigationActionsRenderProps,
  FormNavigationButtonProps,
  FormNavigationSubmitProps,
} from './FormNavigationActions';

// Types - Progress (headless)
export type {
  FormNavigationProgressProps,
  FormNavigationProgressRenderProps,
} from './FormNavigationProgress';
