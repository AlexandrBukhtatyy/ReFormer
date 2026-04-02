// ============================================================================
// FormArray - Headless compound component for managing form arrays
// ============================================================================
export {
  FormArray,
  FormArrayList,
  FormArrayAddButton,
  FormArrayRemoveButton,
  FormArrayEmpty,
  FormArrayCount,
  FormArrayItemIndex,
  useFormArray,
  FormArrayContext,
  FormArrayItemContext,
  useFormArrayContext,
  useFormArrayItemContext,
} from './components/form-array';

export type {
  FormArrayHandle,
  FormArrayItem,
  UseFormArrayReturn,
  FormArrayRootProps,
  FormArrayListProps,
  FormArrayItemRenderProps,
  FormArrayAddButtonProps,
  FormArrayRemoveButtonProps,
  FormArrayEmptyProps,
  FormArrayCountProps,
  FormArrayItemIndexProps,
  FormArrayContextValue,
  FormArrayItemContextValue,
} from './components/form-array';

// ============================================================================
// FormNavigation - Headless compound component for multi-step form wizards
// ============================================================================
export {
  FormNavigation,
  FormNavigationStep,
  FormNavigationIndicator,
  FormNavigationActions,
  FormNavigationProgress,
  useFormNavigation,
  FormNavigationContext,
} from './components/form-navigation';

export type {
  FormNavigationHandle,
  FormNavigationProps,
  FormNavigationConfig,
  FormNavigationStepProps,
  FormNavigationContextValue,
  FormNavigationIndicatorProps,
  FormNavigationIndicatorStep,
  FormNavigationIndicatorStepWithState,
  FormNavigationIndicatorRenderProps,
  FormNavigationActionsProps,
  FormNavigationActionsRenderProps,
  FormNavigationButtonProps,
  FormNavigationSubmitProps,
  FormNavigationProgressProps,
  FormNavigationProgressRenderProps,
} from './components/form-navigation';
