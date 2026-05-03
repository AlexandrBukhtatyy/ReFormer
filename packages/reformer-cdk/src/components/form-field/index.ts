// Main compound component
export { FormField } from './FormField';

// Sub-components (also available as FormField.Root, FormField.Label, etc.)
export { FormFieldRoot } from './FormFieldRoot';
export { FormFieldLabel } from './FormFieldLabel';
export { FormFieldControl } from './FormFieldControl';
export { FormFieldError } from './FormFieldError';
export { FormFieldDescription } from './FormFieldDescription';

// Hook (primary standalone API for power users)
export { useFormField } from './useFormField';
export type {
  UseFormFieldReturn,
  UseFormFieldState,
  UseFormFieldLabelProps,
  UseFormFieldControlProps,
  UseFormFieldErrorProps,
  UseFormFieldDescriptionProps,
} from './useFormField';

// Context and context hook
export { FormFieldContext, useFormFieldContext } from './FormFieldContext';

// Types
export type {
  FormFieldIds,
  FormFieldContextValue,
  FormFieldRootProps,
  FormFieldLabelProps,
  FormFieldControlProps,
  FormFieldErrorProps,
  FormFieldDescriptionProps,
} from './types';
