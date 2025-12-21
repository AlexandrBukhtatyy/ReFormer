import { useFormArrayItemContext } from './FormArrayContext';
import type { FormArrayRemoveButtonProps } from './types';

/**
 * FormArray.RemoveButton - Button to remove current item (must be inside FormArray.List)
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.List>
 *   {({ control }) => (
 *     <div>
 *       <ItemForm control={control} />
 *       <FormArray.RemoveButton className="text-red-500">
 *         Remove
 *       </FormArray.RemoveButton>
 *     </div>
 *   )}
 * </FormArray.List>
 * ```
 */
export function FormArrayRemoveButton({ children, ...props }: FormArrayRemoveButtonProps) {
  const { remove } = useFormArrayItemContext();

  return (
    <button type="button" onClick={remove} {...props}>
      {children}
    </button>
  );
}
