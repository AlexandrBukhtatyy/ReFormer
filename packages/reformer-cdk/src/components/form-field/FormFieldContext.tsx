import { createContext, useContext } from 'react';
import type { FormValue } from '@reformer/core';
import type { FormFieldContextValue } from './types';

/**
 * React context, который снабжает дочерние компоненты `FormField` (Label, Error,
 * Hint, Control) текущим контролом. Создаётся `FormField.Root`. Читать через
 * {@link useFormFieldContext}.
 *
 * @example
 * ```tsx
 * import { FormFieldContext } from '@reformer/cdk/form-field';
 *
 * function CurrentValue() {
 *   const ctx = useContext(FormFieldContext);
 *   return <pre>{JSON.stringify(ctx?.control.value)}</pre>;
 * }
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const FormFieldContext = createContext<FormFieldContextValue<any> | null>(null);

/**
 * Хук для доступа к контексту `FormField`. Бросает исключение, если вызван
 * вне `FormField.Root`.
 *
 * @returns Текущий {@link FormFieldContextValue}.
 * @throws Error если используется вне `<FormField.Root>`.
 *
 * @example
 * ```tsx
 * import { useFormFieldContext } from '@reformer/cdk/form-field';
 *
 * function CharCount() {
 *   const { control } = useFormFieldContext<string>();
 *   return <small>{control.value.length} chars</small>;
 * }
 * ```
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
