import { useFormArrayItemContext } from './FormArrayContext';
import type { FormArrayItemIndexProps } from './types';

/**
 * FormArray.ItemIndex - Displays the index of current item (must be inside FormArray.List)
 *
 * @example Basic usage (1-based display)
 * ```tsx
 * <FormArray.List>
 *   {() => (
 *     <h4>Item #<FormArray.ItemIndex render={(i) => i + 1} /></h4>
 *   )}
 * </FormArray.List>
 * ```
 *
 * @example Zero-based index
 * ```tsx
 * <FormArray.ItemIndex /> // Renders 0, 1, 2, ...
 * ```
 *
 * @example Custom render
 * ```tsx
 * <FormArray.ItemIndex render={(index) => `Position: ${index + 1}`} />
 * ```
 */
export function FormArrayItemIndex({ render }: FormArrayItemIndexProps) {
  const { index } = useFormArrayItemContext();

  if (render) {
    return <>{render(index)}</>;
  }

  // Default: 1-based display for better UX
  return <>{index + 1}</>;
}
