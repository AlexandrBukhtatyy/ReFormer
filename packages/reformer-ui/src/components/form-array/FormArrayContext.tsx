/**
 * Re-export FormArray context from core
 *
 * Контекст определён в @reformer/core для обеспечения совместимости
 * между RenderSchema (core) и compound-компонентами (ui).
 */

import type { FormFields } from '@reformer/core';
import {
  FormArrayContext,
  FormArrayItemContext,
  useFormArrayContext as useFormArrayContextCore,
  useFormArrayItemContext as useFormArrayItemContextCore,
  type FormArrayContextValue,
  type FormArrayItemContextValue,
} from '@reformer/core';

// Re-export context и типы из core
export { FormArrayContext, FormArrayItemContext };
export type { FormArrayContextValue, FormArrayItemContextValue };

/**
 * Hook to access FormArray context
 * @throws Error if used outside of FormArray.Root or RenderSchema ArrayRenderer
 */
export function useFormArrayContext<T extends FormFields = FormFields>(): FormArrayContextValue<T> {
  const context = useFormArrayContextCore<T>();
  if (!context) {
    throw new Error(
      'FormArray.* components must be used within FormArray.Root or RenderSchema FormArray'
    );
  }
  return context;
}

/**
 * Hook to access current item context within FormArray.List
 * @throws Error if used outside of FormArray.List or item template
 */
export function useFormArrayItemContext<
  T extends FormFields = FormFields,
>(): FormArrayItemContextValue<T> {
  const context = useFormArrayItemContextCore<T>();
  if (!context) {
    throw new Error(
      'FormArray.Item* components must be used within FormArray.List or item template'
    );
  }
  return context;
}
