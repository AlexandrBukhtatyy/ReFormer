import { forwardRef, useImperativeHandle } from 'react';
import type { FormGroup } from '@reformer/core';
import { useFieldArray } from './useFieldArray';
import { FieldArrayContext, type FieldArrayContextValue } from './FieldArrayContext';
import { FieldArrayList } from './FieldArrayList';
import { FieldArrayAddButton } from './FieldArrayAddButton';
import { FieldArrayRemoveButton } from './FieldArrayRemoveButton';
import { FieldArrayEmpty } from './FieldArrayEmpty';
import { FieldArrayCount } from './FieldArrayCount';
import { FieldArrayItemIndex } from './FieldArrayItemIndex';
import { FieldArrayError } from './FieldArrayError';
import type { FieldArrayRootProps } from './types';

/**
 * Handle exposed via ref for external control of {@link FieldArray}.
 *
 * Имперо-API для случаев, когда триггер находится вне дерева `FieldArray.Root`
 * (тулбар страницы, диалог подтверждения, async-эффект). Получают через
 * `useRef<FieldArrayHandle<T>>(null)` и передают в `<FieldArray.Root ref={...}>`.
 *
 * Свойства `length` / `isEmpty` — снимок на момент рендера. Реактивную длину
 * для условного UI снаружи берите через `useFormControl(arrayNode).length`.
 *
 * @typeParam T - Тип одного элемента массива (как в `FieldArray.Root control={...}`).
 *
 * @example Тулбар «Добавить / Очистить» поверх массива
 * ```tsx
 * import { useRef } from 'react';
 * import { FieldArray, type FieldArrayHandle } from '@reformer/cdk/field-array';
 *
 * function PropertiesEditor({ form }: Props) {
 *   const arrayRef = useRef<FieldArrayHandle<Property>>(null);
 *
 *   return (
 *     <>
 *       <div className="toolbar">
 *         <button onClick={() => arrayRef.current?.add({ type: 'apartment' })}>
 *           + Квартира
 *         </button>
 *         <button onClick={() => arrayRef.current?.add({ type: 'house' })}>
 *           + Дом
 *         </button>
 *         <button onClick={() => confirm('Удалить всё?') && arrayRef.current?.clear()}>
 *           Очистить
 *         </button>
 *       </div>
 *       <FieldArray.Root ref={arrayRef} control={form.properties}>
 *         <FieldArray.List>{({ control }) => <PropertyForm control={control} />}</FieldArray.List>
 *       </FieldArray.Root>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Импорт массива из API: insert + at для проверки дублей
 * ```tsx
 * const arrayRef = useRef<FieldArrayHandle<Contact>>(null);
 *
 * async function importFromCSV(rows: Contact[]) {
 *   for (const row of rows) {
 *     // skip duplicates by email
 *     const existing = Array.from({ length: arrayRef.current?.length ?? 0 })
 *       .map((_, i) => arrayRef.current?.at(i)?.getValue());
 *     if (existing.some((c) => c?.email === row.email)) continue;
 *     arrayRef.current?.insert(0, row); // добавляем в начало
 *   }
 * }
 * ```
 */
export interface FieldArrayHandle<T extends object> {
  /** Add a new item to the end of the array */
  add: (value?: Partial<T>) => void;
  /** Remove all items from the array */
  clear: () => void;
  /** Insert a new item at a specific index */
  insert: (index: number, value?: Partial<T>) => void;
  /** Remove item at specific index */
  removeAt: (index: number) => void;
  /** Move an item from one index to another (reorder, state preserved) */
  move: (from: number, to: number) => void;
  /** Swap two items by index (reorder, state preserved) */
  swap: (a: number, b: number) => void;
  /** Current number of items */
  length: number;
  /** Whether the array is empty */
  isEmpty: boolean;
  /** Get item control at specific index */
  at: (index: number) => FormGroup<T> | undefined;
}

/**
 * FieldArray.Root - Context provider for form array compound component
 *
 * Supports ref for external control via useImperativeHandle.
 *
 * @example Basic usage
 * ```tsx
 * <FieldArray.Root control={form.properties}>
 *   <FieldArray.List>
 *     {({ control }) => <PropertyForm control={control} />}
 *   </FieldArray.List>
 *   <FieldArray.AddButton>Add Property</FieldArray.AddButton>
 * </FieldArray.Root>
 * ```
 *
 * @example With ref for external control
 * ```tsx
 * const arrayRef = useRef<FieldArrayHandle<Property>>(null);
 *
 * // Later, control from outside:
 * arrayRef.current?.add({ type: 'apartment' });
 * arrayRef.current?.clear();
 * arrayRef.current?.removeAt(0);
 *
 * <FieldArray.Root ref={arrayRef} control={form.properties}>
 *   ...
 * </FieldArray.Root>
 * ```
 */
function FieldArrayRootInner<T extends object>(
  { control, children }: FieldArrayRootProps<T>,
  ref: React.ForwardedRef<FieldArrayHandle<T>>
) {
  const arrayState = useFieldArray(control);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      add: arrayState.add,
      clear: arrayState.clear,
      insert: arrayState.insert,
      removeAt: (index: number) => control.removeAt(index),
      move: arrayState.move,
      swap: arrayState.swap,
      length: arrayState.length,
      isEmpty: arrayState.isEmpty,
      at: (index: number) => control.at(index),
    }),
    [arrayState, control]
  );

  // FormGroup<T> не assignable к FormGroup<any> (у конкретного T нет index-signature): React-контекст
  // хранит generic-erased `<any>`, типобезопасность возвращает useFieldArrayContext<T>() на чтении.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contextValue = { ...arrayState, control } as FieldArrayContextValue<any>;
  return (
    <FieldArrayContext.Provider value={contextValue}>
      {typeof children === 'function' ? children(arrayState) : children}
    </FieldArrayContext.Provider>
  );
}

// Typed forwardRef for generic component
const FieldArrayRoot = forwardRef(FieldArrayRootInner) as <T extends object>(
  props: FieldArrayRootProps<T> & { ref?: React.ForwardedRef<FieldArrayHandle<T>> }
) => React.ReactElement;

// Compound component type with all sub-components attached
type FieldArrayComponent = typeof FieldArrayRoot & {
  Root: typeof FieldArrayRoot;
  List: typeof FieldArrayList;
  AddButton: typeof FieldArrayAddButton;
  RemoveButton: typeof FieldArrayRemoveButton;
  Empty: typeof FieldArrayEmpty;
  Count: typeof FieldArrayCount;
  ItemIndex: typeof FieldArrayItemIndex;
  Error: typeof FieldArrayError;
};

/**
 * FieldArray - Headless compound component for managing form arrays
 *
 * Provides complete flexibility for building array UI while handling
 * all the form array state and actions internally.
 *
 * ## Features
 * - **Headless** - complete freedom in building UI
 * - **Compound Components** - declarative API via nested components
 * - **External Control** - control from outside via ref (useImperativeHandle)
 * - **Type Safe** - full TypeScript support
 *
 * ## Sub-components
 * - `FieldArray.Root` - context provider, accepts ref for external control
 * - `FieldArray.List` - iterates over array items
 * - `FieldArray.AddButton` - button to add item
 * - `FieldArray.RemoveButton` - button to remove item (inside List)
 * - `FieldArray.Empty` - content for empty state
 * - `FieldArray.Count` - display item count
 * - `FieldArray.ItemIndex` - display item index (inside List)
 * - `FieldArray.Error` - display array-level validation issues (e.g. minItems)
 *
 * ## FieldArrayHandle API (ref)
 * - `add(value?)` - add item to the end
 * - `insert(index, value?)` - insert item at position
 * - `removeAt(index)` - remove item by index
 * - `move(from, to)` - reorder item (state preserved)
 * - `swap(a, b)` - swap two items (state preserved)
 * - `clear()` - clear array
 * - `at(index)` - get item control by index
 * - `length` - current item count
 * - `isEmpty` - empty array flag
 *
 * @example Basic usage
 * ```tsx
 * <FieldArray.Root control={form.properties}>
 *   <h3>Properties (<FieldArray.Count />)</h3>
 *
 *   <FieldArray.Empty>
 *     <p className="text-gray-500">No properties added</p>
 *   </FieldArray.Empty>
 *
 *   <FieldArray.List className="space-y-4">
 *     {({ control }) => (
 *       <div className="p-4 border rounded">
 *         <div className="flex justify-between mb-2">
 *           <h4>Property #<FieldArray.ItemIndex /></h4>
 *           <FieldArray.RemoveButton className="text-red-500">
 *             Remove
 *           </FieldArray.RemoveButton>
 *         </div>
 *         <PropertyForm control={control} />
 *       </div>
 *     )}
 *   </FieldArray.List>
 *
 *   <FieldArray.AddButton className="mt-4 btn-primary">
 *     + Add Property
 *   </FieldArray.AddButton>
 * </FieldArray.Root>
 * ```
 *
 * @example External control via ref
 * ```tsx
 * import { useRef } from 'react';
 * import { FieldArray, FieldArrayHandle } from '@reformer/cdk/field-array';
 *
 * function PropertiesManager() {
 *   const arrayRef = useRef<FieldArrayHandle<Property>>(null);
 *
 *   // Programmatic control from outside
 *   const handleAddApartment = () => {
 *     arrayRef.current?.add({ type: 'apartment', estimatedValue: 0 });
 *   };
 *
 *   const handleClearAll = () => {
 *     if (confirm('Delete all items?')) {
 *       arrayRef.current?.clear();
 *     }
 *   };
 *
 *   const handleRemoveFirst = () => {
 *     if (arrayRef.current && arrayRef.current.length > 0) {
 *       arrayRef.current.removeAt(0);
 *     }
 *   };
 *
 *   const handleInsertAtStart = () => {
 *     arrayRef.current?.insert(0, { type: 'house' });
 *   };
 *
 *   return (
 *     <div>
 *       <div className="toolbar">
 *         <button onClick={handleAddApartment}>+ Apartment</button>
 *         <button onClick={handleInsertAtStart}>Insert at start</button>
 *         <button onClick={handleRemoveFirst}>Remove first</button>
 *         <button onClick={handleClearAll}>Clear all</button>
 *       </div>
 *
 *       <FieldArray.Root ref={arrayRef} control={form.properties}>
 *         <FieldArray.List>
 *           {({ control }) => <PropertyForm control={control} />}
 *         </FieldArray.List>
 *       </FieldArray.Root>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Using useFieldArray hook for full customization
 * ```tsx
 * import { useFieldArray } from '@reformer/cdk/field-array';
 *
 * function CustomArrayUI() {
 *   const { items, add, isEmpty, length } = useFieldArray(form.properties);
 *
 *   return (
 *     <div>
 *       <span>Total: {length}</span>
 *       {items.map(({ control, id, remove }) => (
 *         <CustomCard key={id} onDelete={remove}>
 *           <PropertyForm control={control} />
 *         </CustomCard>
 *       ))}
 *       {isEmpty && <EmptyState />}
 *       <button onClick={() => add()}>Add</button>
 *     </div>
 *   );
 * }
 * ```
 */
export const FieldArray = FieldArrayRoot as FieldArrayComponent;

// Attach sub-components
FieldArray.Root = FieldArrayRoot;
FieldArray.List = FieldArrayList;
FieldArray.AddButton = FieldArrayAddButton;
FieldArray.RemoveButton = FieldArrayRemoveButton;
FieldArray.Empty = FieldArrayEmpty;
FieldArray.Count = FieldArrayCount;
FieldArray.ItemIndex = FieldArrayItemIndex;
FieldArray.Error = FieldArrayError;
