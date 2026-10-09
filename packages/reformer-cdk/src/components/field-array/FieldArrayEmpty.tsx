import { useFieldArrayContext } from './FieldArrayContext';
import type { FieldArrayEmptyProps } from './types';

/**
 * FieldArray.Empty - Renders children only when array is empty
 *
 * @example Basic usage
 * ```tsx
 * <FieldArray.Empty>
 *   <p className="text-gray-500">No items added yet</p>
 * </FieldArray.Empty>
 * ```
 *
 * @example With call to action
 * ```tsx
 * <FieldArray.Empty>
 *   <div className="text-center p-8">
 *     <p>No properties</p>
 *     <FieldArray.AddButton>Add your first property</FieldArray.AddButton>
 *   </div>
 * </FieldArray.Empty>
 * ```
 */
export function FieldArrayEmpty({ children }: FieldArrayEmptyProps) {
  const { isEmpty } = useFieldArrayContext();

  if (!isEmpty) {
    return null;
  }

  return <>{children}</>;
}
