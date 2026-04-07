import { createContext, useContext } from 'react';
import type { FormValue } from '@reformer/core';
import type { FormFieldContextValue } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormFieldContext = createContext<FormFieldContextValue<any> | null>(null);

/**
 * Hook to access FormField context.
 * @throws Error if used outside of FormField.Root
 */
export function useFormFieldContext<T extends FormValue = FormValue>(): FormFieldContextValue<T> {
  const ctx = useContext(FormFieldContext) as FormFieldContextValue<T> | null;
  if (!ctx) {
    throw new Error(
      'FormField.* components must be used within <FormField.Root>. ' +
        'Wrap your field with <FormField.Root control={control}>.'
    );
  }
  return ctx;
}
