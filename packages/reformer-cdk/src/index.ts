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
// FormField - Headless compound component for accessible form field anatomy
// ============================================================================
export {
  FormField,
  FormFieldRoot,
  FormFieldLabel,
  FormFieldControl,
  FormFieldError,
  FormFieldDescription,
  useFormField,
  FormFieldContext,
  useFormFieldContext,
} from './components/form-field';

export type {
  FormFieldIds,
  FormFieldContextValue,
  FormFieldRootProps,
  FormFieldLabelProps,
  FormFieldControlProps,
  FormFieldErrorProps,
  FormFieldDescriptionProps,
  UseFormFieldReturn,
  UseFormFieldState,
  UseFormFieldLabelProps,
  UseFormFieldControlProps,
  UseFormFieldErrorProps,
  UseFormFieldDescriptionProps,
} from './components/form-field';

// ============================================================================
// Validation messages - i18n resolver for field error display (code → message)
// ============================================================================
export {
  ValidationMessagesProvider,
  useValidationErrorResolver,
  createMessageResolver,
  defaultErrorResolver,
} from './validation/error-resolver';

export type { ValidationErrorResolver, ValidationMessageTable } from './validation/error-resolver';

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
