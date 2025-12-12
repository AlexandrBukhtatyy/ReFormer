import { useFormArrayContext } from './FormArrayContext';
import type { FormArrayAddButtonProps } from './types';

/**
 * FormArray.AddButton - Button to add new items to the array
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.AddButton className="btn-primary">
 *   + Add Item
 * </FormArray.AddButton>
 * ```
 *
 * @example With initial value
 * ```tsx
 * <FormArray.AddButton initialValue={{ status: 'draft' }}>
 *   Add Draft
 * </FormArray.AddButton>
 * ```
 */
export function FormArrayAddButton({ children, initialValue, ...props }: FormArrayAddButtonProps) {
  const { add } = useFormArrayContext();

  return (
    <button type="button" onClick={() => add(initialValue)} {...props}>
      {children}
    </button>
  );
}
