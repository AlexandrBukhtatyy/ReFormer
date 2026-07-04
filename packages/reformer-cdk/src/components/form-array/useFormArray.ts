import { useMemo } from 'react';
import { useFormControl, type ArrayNode } from '@reformer/core';
// FormArrayItem объявлен один раз в FormArrayContext (устранён дубль-интерфейс с тем же именем).
import type { FormArrayItem } from './FormArrayContext';

/**
 * Return type for useFormArray hook
 */
export interface UseFormArrayReturn<T extends object> {
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
  /** Move an item from one index to another (reorder, state preserved) */
  move: (from: number, to: number) => void;
  /** Swap two items by index (reorder, state preserved) */
  swap: (a: number, b: number) => void;
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
 * @example With initial values + clear / insert
 * ```tsx
 * function PropertyToolbar() {
 *   const { add, clear, insert, length } = useFormArray(form.properties);
 *
 *   return (
 *     <div className="flex gap-2">
 *       <button onClick={() => add({ type: 'apartment', estimatedValue: 0 })}>
 *         + Квартира
 *       </button>
 *       <button onClick={() => insert(0, { type: 'house' })}>
 *         + Дом (в начало)
 *       </button>
 *       <button onClick={clear} disabled={length === 0}>Очистить</button>
 *       <span>{length} шт.</span>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Кастомный AddButton снаружи compound API (drop-down)
 * ```tsx
 * import { useFormArrayContext } from '@reformer/cdk/form-array';
 *
 * function AddPropertyMenu() {
 *   const { add } = useFormArrayContext<Property>();
 *   return (
 *     <Menu>
 *       <Menu.Trigger>+ Добавить ▾</Menu.Trigger>
 *       <Menu.Item onSelect={() => add({ type: 'apartment' })}>Квартира</Menu.Item>
 *       <Menu.Item onSelect={() => add({ type: 'house' })}>Дом</Menu.Item>
 *     </Menu>
 *   );
 * }
 * ```
 */
export function useFormArray<T extends object>(control: ArrayNode<T>): UseFormArrayReturn<T> {
  // Subscribe to array length AND value. `value` ref changes on reorder (move/swap), which keeps
  // the same length — without it the memo below would not recompute and the UI would not reorder.
  const { length, value } = useFormControl(control);

  // Memoize items array - recalculates when length OR order changes.
  const items = useMemo(
    () =>
      control.map((itemControl, index) => ({
        control: itemControl,
        index,
        id: itemControl.id ?? index,
        remove: () => control.removeAt(index),
      })),
    // `value` is intentionally in deps: its reference changes on add/remove/reorder.
    [control, length, value]
  );

  return {
    items,
    length,
    isEmpty: length === 0,
    add: (value?: Partial<T>) => control.push(value),
    clear: () => control.clear(),
    insert: (index: number, value?: Partial<T>) => control.insert(index, value),
    move: (from: number, to: number) => control.move(from, to),
    swap: (a: number, b: number) => control.swap(a, b),
  };
}
