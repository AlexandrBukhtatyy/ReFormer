import { useMemo } from 'react';
import { useFormControl, type ArrayNode, type FormFields, type FormProxy } from '@reformer/core';

/**
 * Represents a single item in a form array with its control, index, and actions
 */
export interface FormArrayItem<T extends FormFields> {
  /** The form control for this item */
  control: FormProxy<T>;
  /** Zero-based index of the item in the array */
  index: number;
  /** Unique identifier for React key (uses internal id or falls back to index) */
  id: string | number;
  /** Remove this item from the array */
  remove: () => void;
}

/**
 * Return type for useFormArray hook
 */
export interface UseFormArrayReturn<T extends FormFields> {
  /** Array of items with their controls and actions */
  items: FormArrayItem<T>[];
  /** Current number of items in the array */
  length: number;
  /** Whether the array is empty */
  isEmpty: boolean;
  /** Add a new item to the end of the array */
  add: (value?: Partial<T>) => void;
  /** Remove all items from the array */
  clear: () => void;
  /** Insert a new item at a specific index */
  insert: (index: number, value?: Partial<T>) => void;
}

/**
 * Headless hook for managing form arrays
 *
 * Provides reactive state and actions for form array manipulation
 * without any UI - perfect for building custom array interfaces.
 *
 * @example Basic usage
 * ```tsx
 * function PropertyList() {
 *   const { items, add, isEmpty } = useFormArray(form.properties);
 *
 *   return (
 *     <div>
 *       {items.map(({ control, index, remove, id }) => (
 *         <div key={id}>
 *           <span>Property #{index + 1}</span>
 *           <button onClick={remove}>Remove</button>
 *           <PropertyForm control={control} />
 *         </div>
 *       ))}
 *       {isEmpty && <p>No properties added</p>}
 *       <button onClick={() => add()}>Add Property</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With initial values
 * ```tsx
 * const { add } = useFormArray(form.items);
 * // Add item with pre-filled values
 * add({ name: 'New Item', quantity: 1 });
 * ```
 */
export function useFormArray<T extends FormFields>(control: ArrayNode<T>): UseFormArrayReturn<T> {
  // Subscribe to array length changes to trigger re-renders
  const { length } = useFormControl(control);

  // Memoize items array - recalculates when length changes
  // Length is intentionally in deps to trigger recalculation when array changes
  const items = useMemo(
    () =>
      control.map((itemControl, index) => ({
        control: itemControl,
        index,
        id: itemControl.id ?? index,
        remove: () => control.removeAt(index),
      })),
    [control, length]
  );

  return {
    items,
    length,
    isEmpty: length === 0,
    add: (value?: Partial<T>) => control.push(value),
    clear: () => control.clear(),
    insert: (index: number, value?: Partial<T>) => control.insert(index, value),
  };
}
