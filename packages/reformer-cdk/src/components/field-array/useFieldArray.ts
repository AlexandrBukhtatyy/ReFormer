import { useMemo } from 'react';
import { type FormGroup, type ValidationIssue } from '@reformer/core';
import { useFormControl } from '@reformer/core/react';
// FieldArrayItem объявлен один раз в FieldArrayContext (устранён дубль-интерфейс с тем же именем).
import type { FieldArrayItem } from './FieldArrayContext';
import type { FieldArrayControl } from './types';

/**
 * Return type for useFieldArray hook
 */
export interface UseFieldArrayReturn<T extends object> {
  /** Array of items with their controls and actions */
  items: FieldArrayItem<T>[];
  /** Current number of items in the array */
  length: number;
  /** Whether the array is empty */
  isEmpty: boolean;
  /**
   * Add a new item to the end of the array. No value — the model array template (`arrayOf`);
   * a partial value is completed from the template.
   */
  add: (value?: Partial<T>) => void;
  /** Remove all items from the array */
  clear: () => void;
  /** Insert a new item at a specific index */
  insert: (index: number, value?: Partial<T>) => void;
  /** Remove an item by index (symmetric with insert-by-index) */
  removeAt: (index: number) => void;
  /** Move an item from one index to another (reorder, state preserved) */
  move: (from: number, to: number) => void;
  /** Swap two items by index (reorder, state preserved) */
  swap: (a: number, b: number) => void;
  /** Get item control at a specific index */
  at: (index: number) => FormGroup<T> | undefined;
  /** Issues of the array and of all its rows (aggregate) */
  issues: ValidationIssue[];
  /** Array-level validation issues only (e.g. `minLength` on the array), without row issues */
  ownIssues: ValidationIssue[];
  /** Whether the array (and all its items) is valid */
  valid: boolean;
  /** Whether the array (or any item) is invalid */
  invalid: boolean;
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
 *   const { items, add, isEmpty } = useFieldArray(form.properties);
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
 *   const { add, clear, insert, length } = useFieldArray(form.properties);
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
 * import { useFieldArrayContext } from '@reformer/cdk/field-array';
 *
 * function AddPropertyMenu() {
 *   const { add } = useFieldArrayContext<Property>();
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
export function useFieldArray<T extends object>(
  control: FieldArrayControl<T>
): UseFieldArrayReturn<T> {
  // Subscribe to array length AND value. `value` ref changes on reorder (move/swap), which keeps
  // the same length — without it the memo below would not recompute and the UI would not reorder.
  const { length, value, issues, ownIssues, valid, invalid } = useFormControl(control);

  // Memoize items array - recalculates when the array value changes: on add/remove/reorder and on
  // any edit inside a row (the array value is derived from its rows). Хелперы reorder выводятся на
  // базовый элемент, чтобы консументы сырого хука получали тот же набор, что и FieldArray.List.
  const items = useMemo(
    () =>
      control.map((itemControl, index) => ({
        control: itemControl,
        index,
        id: control.keyAt(index),
        remove: () => control.removeAt(index),
        moveUp: () => control.move(index, index - 1),
        moveDown: () => control.move(index, index + 1),
        canMoveUp: index > 0,
        canMoveDown: index < length - 1,
      })),
    // `value` is intentionally in deps: its reference changes on add/remove/reorder and row edits.
    [control, length, value]
  );

  return {
    items,
    length,
    isEmpty: length === 0,
    // Модель берёт значение как есть: недостающие ключи частичного элемента она не достраивает.
    add: (value?: Partial<T>) => control.push(value as T | undefined),
    clear: () => control.clear(),
    insert: (index: number, value?: Partial<T>) => control.insert(index, value as T | undefined),
    removeAt: (index: number) => control.removeAt(index),
    move: (from: number, to: number) => control.move(from, to),
    swap: (a: number, b: number) => control.swap(a, b),
    at: (index: number) => control.at(index),
    issues,
    ownIssues,
    valid,
    invalid,
  };
}
