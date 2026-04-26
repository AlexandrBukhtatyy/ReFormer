import { forwardRef, useImperativeHandle } from 'react';
import type { FormFields, FormProxy } from '@reformer/core';
import { useFormArray } from './useFormArray';
import { FormArrayContext } from './FormArrayContext';
import { FormArrayList } from './FormArrayList';
import { FormArrayAddButton } from './FormArrayAddButton';
import { FormArrayRemoveButton } from './FormArrayRemoveButton';
import { FormArrayEmpty } from './FormArrayEmpty';
import { FormArrayCount } from './FormArrayCount';
import { FormArrayItemIndex } from './FormArrayItemIndex';
import type { FormArrayRootProps } from './types';

/**
 * Handle exposed via ref for external control of {@link FormArray}.
 *
 * Имперо-API для случаев, когда триггер находится вне дерева `FormArray.Root`
 * (тулбар страницы, диалог подтверждения, async-эффект). Получают через
 * `useRef<FormArrayHandle<T>>(null)` и передают в `<FormArray.Root ref={...}>`.
 *
 * Свойства `length` / `isEmpty` — снимок на момент рендера. Реактивную длину
 * для условного UI снаружи берите через `useFormControl(arrayNode).length`.
 *
 * @typeParam T - Тип одного элемента массива (как в `FormArray.Root control={...}`).
 *
 * @example Тулбар «Добавить / Очистить» поверх массива
 * ```tsx
 * import { useRef } from 'react';
 * import { FormArray, type FormArrayHandle } from '@reformer/cdk/form-array';
 *
 * function PropertiesEditor({ form }: Props) {
 *   const arrayRef = useRef<FormArrayHandle<Property>>(null);
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
 *       <FormArray.Root ref={arrayRef} control={form.properties}>
 *         <FormArray.List>{({ control }) => <PropertyForm control={control} />}</FormArray.List>
 *       </FormArray.Root>
 *     </>
 *   );
 * }
 * ```
 *
 * @example Импорт массива из API: insert + at для проверки дублей
 * ```tsx
 * const arrayRef = useRef<FormArrayHandle<Contact>>(null);
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
export interface FormArrayHandle<T extends FormFields> {
  /** Add a new item to the end of the array */
  add: (value?: Partial<T>) => void;
  /** Remove all items from the array */
  clear: () => void;
  /** Insert a new item at a specific index */
  insert: (index: number, value?: Partial<T>) => void;
  /** Remove item at specific index */
  removeAt: (index: number) => void;
  /** Current number of items */
  length: number;
  /** Whether the array is empty */
  isEmpty: boolean;
  /** Get item control at specific index */
  at: (index: number) => FormProxy<T> | undefined;
}

/**
 * FormArray.Root - Context provider for form array compound component
 *
 * Supports ref for external control via useImperativeHandle.
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.Root control={form.properties}>
 *   <FormArray.List>
 *     {({ control }) => <PropertyForm control={control} />}
 *   </FormArray.List>
 *   <FormArray.AddButton>Add Property</FormArray.AddButton>
 * </FormArray.Root>
 * ```
 *
 * @example With ref for external control
 * ```tsx
 * const arrayRef = useRef<FormArrayHandle<Property>>(null);
 *
 * // Later, control from outside:
 * arrayRef.current?.add({ type: 'apartment' });
 * arrayRef.current?.clear();
 * arrayRef.current?.removeAt(0);
 *
 * <FormArray.Root ref={arrayRef} control={form.properties}>
 *   ...
 * </FormArray.Root>
 * ```
 */
function FormArrayRootInner<T extends FormFields>(
  { control, children }: FormArrayRootProps<T>,
  ref: React.ForwardedRef<FormArrayHandle<T>>
) {
  const arrayState = useFormArray(control);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      add: arrayState.add,
      clear: arrayState.clear,
      insert: arrayState.insert,
      removeAt: (index: number) => control.removeAt(index),
      length: arrayState.length,
      isEmpty: arrayState.isEmpty,
      at: (index: number) => control.at(index),
    }),
    [arrayState, control]
  );

  return (
    <FormArrayContext.Provider value={{ ...arrayState, control }}>
      {children}
    </FormArrayContext.Provider>
  );
}

// Typed forwardRef for generic component
const FormArrayRoot = forwardRef(FormArrayRootInner) as <T extends FormFields>(
  props: FormArrayRootProps<T> & { ref?: React.ForwardedRef<FormArrayHandle<T>> }
) => React.ReactElement;

// Compound component type with all sub-components attached
type FormArrayComponent = typeof FormArrayRoot & {
  Root: typeof FormArrayRoot;
  List: typeof FormArrayList;
  AddButton: typeof FormArrayAddButton;
  RemoveButton: typeof FormArrayRemoveButton;
  Empty: typeof FormArrayEmpty;
  Count: typeof FormArrayCount;
  ItemIndex: typeof FormArrayItemIndex;
};

/**
 * FormArray - Headless compound component for managing form arrays
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
 * - `FormArray.Root` - context provider, accepts ref for external control
 * - `FormArray.List` - iterates over array items
 * - `FormArray.AddButton` - button to add item
 * - `FormArray.RemoveButton` - button to remove item (inside List)
 * - `FormArray.Empty` - content for empty state
 * - `FormArray.Count` - display item count
 * - `FormArray.ItemIndex` - display item index (inside List)
 *
 * ## FormArrayHandle API (ref)
 * - `add(value?)` - add item to the end
 * - `insert(index, value?)` - insert item at position
 * - `removeAt(index)` - remove item by index
 * - `clear()` - clear array
 * - `at(index)` - get item control by index
 * - `length` - current item count
 * - `isEmpty` - empty array flag
 *
 * @example Basic usage
 * ```tsx
 * <FormArray.Root control={form.properties}>
 *   <h3>Properties (<FormArray.Count />)</h3>
 *
 *   <FormArray.Empty>
 *     <p className="text-gray-500">No properties added</p>
 *   </FormArray.Empty>
 *
 *   <FormArray.List className="space-y-4">
 *     {({ control }) => (
 *       <div className="p-4 border rounded">
 *         <div className="flex justify-between mb-2">
 *           <h4>Property #<FormArray.ItemIndex /></h4>
 *           <FormArray.RemoveButton className="text-red-500">
 *             Remove
 *           </FormArray.RemoveButton>
 *         </div>
 *         <PropertyForm control={control} />
 *       </div>
 *     )}
 *   </FormArray.List>
 *
 *   <FormArray.AddButton className="mt-4 btn-primary">
 *     + Add Property
 *   </FormArray.AddButton>
 * </FormArray.Root>
 * ```
 *
 * @example External control via ref
 * ```tsx
 * import { useRef } from 'react';
 * import { FormArray, FormArrayHandle } from '@reformer/cdk/form-array';
 *
 * function PropertiesManager() {
 *   const arrayRef = useRef<FormArrayHandle<Property>>(null);
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
 *       <FormArray.Root ref={arrayRef} control={form.properties}>
 *         <FormArray.List>
 *           {({ control }) => <PropertyForm control={control} />}
 *         </FormArray.List>
 *       </FormArray.Root>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example Using useFormArray hook for full customization
 * ```tsx
 * import { useFormArray } from '@reformer/cdk/form-array';
 *
 * function CustomArrayUI() {
 *   const { items, add, isEmpty, length } = useFormArray(form.properties);
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
export const FormArray = FormArrayRoot as FormArrayComponent;

// Attach sub-components
FormArray.Root = FormArrayRoot;
FormArray.List = FormArrayList;
FormArray.AddButton = FormArrayAddButton;
FormArray.RemoveButton = FormArrayRemoveButton;
FormArray.Empty = FormArrayEmpty;
FormArray.Count = FormArrayCount;
FormArray.ItemIndex = FormArrayItemIndex;
