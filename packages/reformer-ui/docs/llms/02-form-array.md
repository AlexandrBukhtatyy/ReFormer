# FormArray

Headless compound component for managing form arrays.

## Basic Usage

```tsx
import { FormArray } from '@reformer/ui/form-array';

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
</FormArray.Root>
```

## Sub-components

| Component | Props | Purpose |
|-----------|-------|---------|
| `FormArray.Root` | `control: ArrayNode<T>` | Context provider |
| `FormArray.List` | `children: (item) => ReactNode` | Iterates items (render props) |
| `FormArray.AddButton` | `initialValue?: Partial<T>` | Adds new item |
| `FormArray.RemoveButton` | - | Removes current item (inside List) |
| `FormArray.Empty` | `children: ReactNode` | Shows when array is empty |
| `FormArray.Count` | `render?: (count) => ReactNode` | Displays item count |
| `FormArray.ItemIndex` | `render?: (index) => ReactNode` | Displays current index |

## List Render Props

```typescript
interface FormArrayItemRenderProps<T> {
  control: FormProxy<T>;  // Form control for item
  index: number;                       // Zero-based index
  id: string | number;                 // Unique key
  remove: () => void;                  // Remove this item
}
```

## External Control via Ref

```tsx
import { useRef } from 'react';
import { FormArray, FormArrayHandle } from '@reformer/ui/form-array';

const arrayRef = useRef<FormArrayHandle<ItemType>>(null);

// Control from outside
arrayRef.current?.add({ name: 'New' });
arrayRef.current?.removeAt(0);
arrayRef.current?.clear();

<FormArray.Root ref={arrayRef} control={form.items}>
  ...
</FormArray.Root>
```

## FormArrayHandle API

```typescript
interface FormArrayHandle<T> {
  add: (value?: Partial<T>) => void;
  clear: () => void;
  insert: (index: number, value?: Partial<T>) => void;
  removeAt: (index: number) => void;
  length: number;
  isEmpty: boolean;
  at: (index: number) => FormProxy<T> | undefined;
}
```

## useFormArray Hook

For full customization without compound components:

```tsx
import { useFormArray } from '@reformer/ui/form-array';

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
