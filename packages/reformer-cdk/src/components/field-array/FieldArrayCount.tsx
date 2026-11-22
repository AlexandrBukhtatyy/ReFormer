import { useFieldArrayContext } from './FieldArrayContext';
import type { FieldArrayCountProps } from './types';

/**
 * FieldArray.Count - Displays the number of items in the array
 *
 * @example Basic usage
 * ```tsx
 * <h3>Items (<FieldArray.Count />)</h3>
 * ```
 *
 * @example With custom render
 * ```tsx
 * <FieldArray.Count render={(count) => (
 *   count === 0 ? 'No items' : `${count} item${count > 1 ? 's' : ''}`
 * )} />
 * ```
 */
export function FieldArrayCount({ render }: FieldArrayCountProps) {
  const { length } = useFieldArrayContext();

  if (render) {
    return <>{render(length)}</>;
  }

  return <>{length}</>;
}
