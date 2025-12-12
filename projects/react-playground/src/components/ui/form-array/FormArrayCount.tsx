import { useFormArrayContext } from './FormArrayContext';
import type { FormArrayCountProps } from './types';

/**
 * FormArray.Count - Displays the number of items in the array
 *
 * @example Basic usage
 * ```tsx
 * <h3>Items (<FormArray.Count />)</h3>
 * ```
 *
 * @example With custom render
 * ```tsx
 * <FormArray.Count render={(count) => (
 *   count === 0 ? 'No items' : `${count} item${count > 1 ? 's' : ''}`
 * )} />
 * ```
 */
export function FormArrayCount({ render }: FormArrayCountProps) {
  const { length } = useFormArrayContext();

  if (render) {
    return <>{render(length)}</>;
  }

  return <>{length}</>;
}
