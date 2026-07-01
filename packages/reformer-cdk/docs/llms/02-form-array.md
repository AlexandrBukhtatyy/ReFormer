# FormArray

Headless compound component for managing form arrays.

## Basic Usage

```tsx
import { FormArray } from '@reformer/cdk/form-array';

<FormArray.Root control={form.items}>
  <FormArray.Empty>
    <p>No items added</p>
  </FormArray.Empty>

  <FormArray.List>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Item #{index + 1}</h4>
        <ItemForm control={control} />
        <button onClick={remove}>Remove</button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Add Item</FormArray.AddButton>
</FormArray.Root>;
```

## Sub-components

| Component                | Props                           | Purpose                            |
| ------------------------ | ------------------------------- | ---------------------------------- |
| `FormArray.Root`         | `control: ArrayNode<T>`         | Context provider                   |
| `FormArray.List`         | `children: (item) => ReactNode` | Iterates items (render props)      |
| `FormArray.AddButton`    | `initialValue?: Partial<T>`     | Adds new item                      |
| `FormArray.RemoveButton` | -                               | Removes current item (inside List) |
| `FormArray.Empty`        | `children: ReactNode`           | Shows when array is empty          |
| `FormArray.Count`        | `render?: (count) => ReactNode` | Displays item count                |
| `FormArray.ItemIndex`    | `render?: (index) => ReactNode` | Displays current index             |

## List Render Props

```typescript
interface FormArrayItemRenderProps<T> {
  control: FormProxy<T>; // Form control for item
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

## External Control via Ref

```tsx
import { useRef } from 'react';
import { FormArray, FormArrayHandle } from '@reformer/cdk/form-array';

const arrayRef = useRef<FormArrayHandle<ItemType>>(null);

// Control from outside
arrayRef.current?.add({ name: 'New' });
arrayRef.current?.removeAt(0);
arrayRef.current?.move(2, 0);
arrayRef.current?.clear();

<FormArray.Root ref={arrayRef} control={form.items}>
  ...
</FormArray.Root>;
```

## FormArrayHandle API

```typescript
interface FormArrayHandle<T> {
  add: (value?: Partial<T>) => void;
  clear: () => void;
  insert: (index: number, value?: Partial<T>) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void; // reorder, state preserved
  swap: (a: number, b: number) => void; // swap two items, state preserved
  length: number;
  isEmpty: boolean;
  at: (index: number) => FormProxy<T> | undefined;
}
```

> `length` / `isEmpty` are a snapshot at render time. For a reactive length
> outside the array, subscribe via `useFormControl(form.items).length`.

## useFormArray Hook

For full customization without compound components:

```tsx
import { useFormArray } from '@reformer/cdk/form-array';

function CustomList() {
  const { items, add, isEmpty, length } = useFormArray(form.items);

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

### UseFormArrayReturn

```typescript
interface UseFormArrayReturn<T> {
  items: FormArrayItem<T>[]; // { control, index, id, remove }
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
