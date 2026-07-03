import { useId, useMemo } from 'react';
import { useFormControl, type FormValue } from '@reformer/core';
import { FormFieldContext } from './FormFieldContext';
import { useValidationErrorResolver } from '../../validation/error-resolver';
import type { FormFieldContextValue, FormFieldIds, FormFieldRootProps } from './types';

/**
 * FormField.Root - Context provider for form field compound component.
 *
 * Computes stable accessible IDs (controlId, labelId, descriptionId, errorId)
 * and provides all field state to child FormField.* components.
 *
 * @example Minimal usage
 * ```tsx
 * <FormField.Root control={control.email}>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Error />
 * </FormField.Root>
 * ```
 *
 * @example With description (pass hasDescription to auto-wire aria-describedby)
 * ```tsx
 * <FormField.Root control={control.email} hasDescription>
 *   <FormField.Label />
 *   <FormField.Control />
 *   <FormField.Description>Helper text</FormField.Description>
 *   <FormField.Error />
 * </FormField.Root>
 * ```
 */
function FormFieldRoot<T extends FormValue>({
  control,
  children,
  id,
  hasDescription = false,
}: FormFieldRootProps<T>) {
  const reactId = useId();
  const baseId = id ?? reactId;

  const ids = useMemo<FormFieldIds>(
    () => ({
      controlId: `control-${baseId}`,
      labelId: `label-${baseId}`,
      descriptionId: `desc-${baseId}`,
      errorId: `error-${baseId}`,
    }),
    [baseId]
  );

  const raw = useFormControl(control);
  // i18n: контекстный `error` резолвим (ValidationMessagesProvider), а не сырой message —
  // иначе useFormFieldContext().error расходится с useFormField().state.error.
  const resolve = useValidationErrorResolver();

  const contextValue = useMemo<FormFieldContextValue<T>>(() => {
    const {
      value,
      errors,
      pending,
      disabled,
      valid,
      invalid,
      touched,
      shouldShowError,
      componentProps,
    } = raw;

    return {
      value: value as T,
      errors,
      pending,
      disabled,
      valid,
      invalid,
      touched,
      shouldShowError,
      error: shouldShowError && errors[0] ? resolve(errors[0]) : undefined,
      label: componentProps.label as string | undefined,
      required: Boolean(componentProps.required),
      componentProps: componentProps as Record<string, unknown>,
      control,
      ids,
      hasDescription,
    };
  }, [raw, control, ids, hasDescription, resolve]);

  return <FormFieldContext.Provider value={contextValue}>{children}</FormFieldContext.Provider>;
}

FormFieldRoot.displayName = 'FormField.Root';

export { FormFieldRoot };
