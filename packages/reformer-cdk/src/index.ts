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
// FormWizard - Headless compound component for multi-step form wizards
// ============================================================================
export {
  FormWizard,
  FormWizardStep,
  FormWizardIndicator,
  FormWizardActions,
  FormWizardProgress,
  useFormWizard,
  FormWizardContext,
} from './components/form-wizard';

export type {
  FormWizardHandle,
  FormWizardProps,
  FormWizardConfig,
  FormWizardStepProps,
  FormWizardContextValue,
  FormWizardIndicatorProps,
  FormWizardIndicatorStep,
  FormWizardIndicatorStepWithState,
  FormWizardIndicatorRenderProps,
  FormWizardActionsProps,
  FormWizardActionsRenderProps,
  FormWizardButtonProps,
  FormWizardSubmitProps,
  FormWizardProgressProps,
  FormWizardProgressRenderProps,
} from './components/form-wizard';
