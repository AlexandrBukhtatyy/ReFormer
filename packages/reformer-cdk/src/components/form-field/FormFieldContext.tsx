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
 * @example Счётчик символов рядом с label
 * ```tsx
 * import { useFormFieldContext } from '@reformer/cdk/form-field';
 *
 * function CharCount() {
 *   const { control } = useFormFieldContext<string>();
 *   return <small>{control.value.length} chars</small>;
 * }
 * ```
 *
 * @example Async pending-индикатор и required-астериск
 * ```tsx
 * function PendingBadge() {
 *   const { pending, required, error } = useFormFieldContext();
 *   if (pending) return <Spinner size="xs" aria-label="Проверяем..." />;
 *   if (error) return <span className="text-red-600 text-xs">!</span>;
 *   if (required) return <span className="text-gray-400">*</span>;
 *   return null;
 * }
 *
 * <FormField.Root control={form.username}>
 *   <div className="flex items-center gap-2">
 *     <FormField.Label />
 *     <PendingBadge />
 *   </div>
 *   <FormField.Control />
 *   <FormField.Error />
 * </FormField.Root>
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
