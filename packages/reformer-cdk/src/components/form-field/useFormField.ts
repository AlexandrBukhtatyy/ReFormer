import { useId, useMemo } from 'react';
import {
  useFormControl,
  type FieldNode,
  type FormValue,
  type ValidationError,
} from '@reformer/core';
import type { FormFieldIds } from './types';

/**
 * Field state returned by useFormField
 */
export interface UseFormFieldState<T extends FormValue = FormValue> {
  value: T;
  errors: ValidationError[];
  /** First error message, only set when shouldShowError is true */
  error: string | undefined;
  isPending: boolean;
  isDisabled: boolean;
  isValid: boolean;
  isInvalid: boolean;
  isTouched: boolean;
  shouldShowError: boolean;
  label: string | undefined;
  required: boolean;
  /** Full componentProps bag from FieldNode config */
  componentProps: Record<string, unknown>;
}

/** Props to spread onto a <label> element */
export interface UseFormFieldLabelProps {
  id: string;
  htmlFor: string;
}

/** Props to spread onto the interactive control element */
export interface UseFormFieldControlProps {
  id: string;
  disabled: boolean;
  'aria-labelledby': string;
  'aria-invalid': true | undefined;
  'aria-errormessage': string | undefined;
  'aria-required': true | undefined;
  /** Direct-value onChange compatible with ReFormer field components */
  onChange: (value: unknown) => void;
  onBlur: () => void;
}

/** Props to spread onto an error paragraph */
export interface UseFormFieldErrorProps {
  id: string;
  role: 'alert';
}

/** Props to spread onto a description paragraph */
export interface UseFormFieldDescriptionProps {
  id: string;
}

/**
 * Return type of useFormField hook
 */
export interface UseFormFieldReturn<T extends FormValue = FormValue> {
  /** Spread onto <label> */
  labelProps: UseFormFieldLabelProps;
  /** Spread onto the interactive control; includes value */
  controlProps: UseFormFieldControlProps & { value: T };
  /** Spread onto the first error paragraph */
  errorProps: UseFormFieldErrorProps;
  /** Spread onto the description paragraph */
  descriptionProps: UseFormFieldDescriptionProps;
  /** Structured field state */
  state: UseFormFieldState<T>;
  /** Field actions */
  actions: {
    setValue: (value: T) => void;
    markAsTouched: () => void;
    markAsUntouched: () => void;
    reset: (value?: T) => void;
  };
  /** Raw IDs for manual wiring (e.g. aria-describedby) */
  ids: FormFieldIds;
}

/**
 * Primary hook for building accessible form fields.
 *
 * Returns partitioned prop collections and structured state that you can spread
 * directly onto your own elements. No prescribed DOM structure.
 *
 * @example Basic usage
 * ```tsx
 * function EmailField({ control }: { control: FieldNode<string> }) {
 *   const { labelProps, controlProps, errorProps, state } = useFormField(control);
 *
 *   return (
 *     <div>
 *       <label {...labelProps}>{state.label}</label>
 *       <input {...controlProps} type="email" />
 *       {state.shouldShowError && (
 *         <p {...errorProps}>{state.error}</p>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With description (manual aria-describedby wiring)
 * ```tsx
 * const { labelProps, controlProps, errorProps, descriptionProps, state, ids } =
 *   useFormField(control);
 *
 * const enrichedControlProps = {
 *   ...controlProps,
 *   'aria-describedby': [
 *     ids.descriptionId,
 *     state.shouldShowError ? ids.errorId : null,
 *   ].filter(Boolean).join(' ') || undefined,
 * };
 * ```
 */
export function useFormField<T extends FormValue>(
  control: FieldNode<T>,
  id?: string
): UseFormFieldReturn<T> {
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

  return useMemo<UseFormFieldReturn<T>>(() => {
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
    const required = Boolean(componentProps.required);

    return {
      ids,
      labelProps: {
        id: ids.labelId,
        htmlFor: ids.controlId,
      },
      controlProps: {
        id: ids.controlId,
        value: value as T,
        disabled,
        'aria-labelledby': ids.labelId,
        'aria-invalid': shouldShowError ? true : undefined,
        'aria-errormessage': shouldShowError && errors.length > 0 ? ids.errorId : undefined,
        'aria-required': required ? true : undefined,
        onChange: (v: unknown) => control.setValue(v as T),
        onBlur: () => control.markAsTouched(),
      },
      errorProps: {
        id: ids.errorId,
        role: 'alert' as const,
      },
      descriptionProps: {
        id: ids.descriptionId,
      },
      state: {
        value: value as T,
        errors,
        error: shouldShowError ? errors[0]?.message : undefined,
        isPending: pending,
        isDisabled: disabled,
        isValid: valid,
        isInvalid: invalid,
        isTouched: touched,
        shouldShowError,
        label: componentProps.label as string | undefined,
        required,
        componentProps: componentProps as Record<string, unknown>,
      },
      actions: {
        setValue: (v: T) => control.setValue(v),
        markAsTouched: () => control.markAsTouched(),
        markAsUntouched: () => control.markAsUntouched(),
        reset: (v?: T) => control.reset(v),
      },
    };
  }, [raw, control, ids]);
}
