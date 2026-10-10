# FieldArray

Headless compound component for managing form arrays.

> Renamed from `FormArray`: the component family is `FieldArray*`, the hook is `useFieldArray`,
> the subpath is `@reformer/cdk/field-array`. The old names are not exported.

## Basic Usage

```tsx
import { FieldArray } from '@reformer/cdk/field-array';

<FieldArray.Root control={form.items}>
  <FieldArray.Empty>
    <p>No items added</p>
  </FieldArray.Empty>

  <FieldArray.List>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Item #{index + 1}</h4>
        <ItemForm control={control} />
        <button onClick={remove}>Remove</button>
      </div>
    )}
  </FieldArray.List>

  <FieldArray.AddButton>Add Item</FieldArray.AddButton>
</FieldArray.Root>;
```

## Sub-components

| Component                | Props                           | Purpose                            |
| ------------------------ | ------------------------------- | ---------------------------------- |
| `FieldArray.Root`         | `control: ArrayNode<T>`         | Context provider                   |
| `FieldArray.List`         | `children: (item) => ReactNode` | Iterates items (render props)      |
| `FieldArray.AddButton`    | `initialValue?: Partial<T>`     | Adds new item (from model template) |
| `FieldArray.RemoveButton` | -                               | Removes current item (inside List) |
| `FieldArray.Empty`        | `children: ReactNode`           | Shows when array is empty          |
| `FieldArray.Count`        | `render?: (count) => ReactNode` | Displays item count                |
| `FieldArray.ItemIndex`    | `render?: (index) => ReactNode` | Displays current index             |

## List Render Props

```typescript
interface FieldArrayItemRenderProps<T> {
  control: FormGroup<T>; // Form control for item
  index: number; // Zero-based index
  id: string | number; // Unique key
  remove: () => void; // Remove this item
  moveUp: () => void; // Move one position up (no-op when first)
  moveDown: () => void; // Move one position down (no-op when last)
  canMoveUp: boolean; // index > 0
  canMoveDown: boolean; // index < length - 1
}
```

Reorder helpers (`moveUp` / `moveDown`) preserve item state — the underlying
`ArrayNode.move` reorders controls without recreating them.

## Typed item access (avoid `FormGroup<object>`)

`FieldArray.List` gets its `control` from `FieldArrayContext`, which is typed
`any` (it has to accept any element type). The generic `T` you write on the
JSX tag is **not** inferred through React context, so a bare `<FieldArray.List>`
defaults `T` to `object` and the render-prop `control` is `FormGroup<object>`.
Accessing item fields then fails to compile:

```tsx
<FieldArray.List>
  {({ control: item }) => (
    // ❌ TS2339: Property 'type' does not exist on type 'FormGroup<object>'
    <FormField control={item.type} />
  )}
</FieldArray.List>
```

The compound (`FieldArray.Root` / `FieldArray.List`) is **headless and
render-prop-untyped by design**. For typed access to item fields, use one of
the paths below. Prefer `FieldArraySection` (canonical) or `useFieldArray` — both
infer the element type, so you cannot forget the annotation.

### Canonical: ui-kit `FieldArraySection` + typed `itemComponent`

The typed, styled array UI lives in `@reformer/ui-kit/field-array`, not in the
CDK compound. Its `itemComponent` FC receives a fully typed
`control: FormGroup<T>` (T inferred from `control`), so item fields resolve:

```tsx
import { FieldArraySection } from '@reformer/ui-kit/field-array';
import type { FormGroup } from '@reformer/core';

const PropertyForm: FC<{ control: FormGroup<Property> }> = ({ control }) => (
  <>
    <FormField control={control.type} /> {/* ✅ typed */}
    <FormField control={control.estimatedValue} />
  </>
);

<FieldArraySection
  control={form.properties} // FormArray<Property>
  itemComponent={PropertyForm}
  title="Properties"
/>;
```

The new item comes from the array template declared in the model —
`createModel({ properties: arrayOf(blankProperty) })` (`arrayOf` from `@reformer/core`). The
`initialValue` prop is a fallback for an array whose model declares no template.

Full prop list, RenderSchema and JSON variants: `find_recipe(topic="field-array-section")`.

### CDK-native typed: `useFieldArray<T>` hook

If you need the headless hook (custom layout, no ui-kit dependency),
`useFieldArray(control)` infers `T` from the array control — every
`item.control` is `FormGroup<T>`, no explicit type argument required:

```tsx
function ExistingLoansList({ control }: { control: FormGroup<Application> }) {
  const { items, add } = useFieldArray(control.existingLoans); // T = ExistingLoan inferred

  return (
    <>
      {items.map(({ control: item, id, remove }) => (
        <div key={id}>
          <FormField control={item.bank} /> {/* ✅ typed */}
          <FormField control={item.amount} />
          <button onClick={remove}>×</button>
        </div>
      ))}
      <button onClick={() => add(blankLoan())}>+ Add</button>
    </>
  );
}
```

### Staying on the compound: pin `FieldArray.List<T>`

The JSX tag accepts an explicit type argument, which restores the item type:

```tsx
<FieldArray.List<Property>>
  {({ control: item }) => <FormField control={item.type} />} {/* ✅ typed */}
</FieldArray.List>
```

You must repeat `<T>` on **every** `FieldArray.List` — miss one and it silently
falls back to `FormGroup<object>`. When you access item fields directly, reach
for `FieldArraySection` or `useFieldArray` instead.

## External Control via Ref

```tsx
import { useRef } from 'react';
import { FieldArray, FieldArrayHandle } from '@reformer/cdk/field-array';

const arrayRef = useRef<FieldArrayHandle<ItemType>>(null);

// Control from outside
arrayRef.current?.add({ name: 'New' });
arrayRef.current?.removeAt(0);
arrayRef.current?.move(2, 0);
arrayRef.current?.clear();

<FieldArray.Root ref={arrayRef} control={form.items}>
  ...
</FieldArray.Root>;
```

## FieldArrayHandle API

```typescript
interface FieldArrayHandle<T> {
  add: (value?: Partial<T>) => void;
  clear: () => void;
  insert: (index: number, value?: Partial<T>) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void; // reorder, state preserved
  swap: (a: number, b: number) => void; // swap two items, state preserved
  length: number;
  isEmpty: boolean;
  at: (index: number) => FormGroup<T> | undefined;
}
```

> `length` / `isEmpty` are a snapshot at render time. For a reactive length
> outside the array, subscribe via `useFormControl(form.items).length`.

## useFieldArray Hook

For full customization without compound components:

```tsx
import { useFieldArray } from '@reformer/cdk/field-array';

function CustomList() {
  const { items, add, isEmpty, length } = useFieldArray(form.items);

  return (
    <div>
      <span>Total: {length}</span>
      {items.map(({ control, id, remove }) => (
        <div key={id}>
          <ItemForm control={control} />
          <button onClick={remove}>X</button>
        </div>
      ))}
      {isEmpty && <p>Empty</p>}
      <button onClick={() => add()}>Add</button>
    </div>
  );
}
```

### UseFieldArrayReturn

```typescript
interface UseFieldArrayReturn<T> {
  items: FieldArrayItem<T>[]; // { control, index, id, remove }
  length: number;
  isEmpty: boolean;
  add: (value?: Partial<T>) => void; // push to end
  clear: () => void; // remove all
  insert: (index: number, value?: Partial<T>) => void;
  move: (from: number, to: number) => void; // reorder, state preserved
  swap: (a: number, b: number) => void; // swap two items, state preserved
}
```

Note: `items[]` is memoized by array length AND order — changing a value inside
an item does not recreate the `items` array, but `move` / `swap` do (order ref changes).
