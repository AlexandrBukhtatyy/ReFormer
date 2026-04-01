import { useFormArrayContext } from './FormArrayContext';
import type { FormArrayEmptyProps } from './types';

/**
 * FormArray.Empty - Renders children only when array is empty
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.Empty>
 *   <p className="text-gray-500">No items added yet</p>
 * </FormArray.Empty>
 * ```
 *
 * @example With call to action
 * ```tsx
 * <FormArray.Empty>
 *   <div className="text-center p-8">
 *     <p>No properties</p>
 *     <FormArray.AddButton>Add your first property</FormArray.AddButton>
 *   </div>
 * </FormArray.Empty>
 * ```
 */
export function FormArrayEmpty({ children }: FormArrayEmptyProps) {
  const { isEmpty } = useFormArrayContext();

  if (!isEmpty) {
    return null;
  }

  return <>{children}</>;
}
