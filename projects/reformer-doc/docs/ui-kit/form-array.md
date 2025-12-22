---
sidebar_position: 2
---

# FormArray

Headless compound component для управления массивами форм.

## Базовое использование

```tsx
import { FormArray } from '@reformer/ui/form-array';

<FormArray.Root control={form.items}>
  <FormArray.Empty>
    <p>Нет элементов</p>
  </FormArray.Empty>

  <FormArray.List>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Элемент #{index + 1}</h4>
        <ItemForm control={control} />
        <button onClick={remove}>Удалить</button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Добавить</FormArray.AddButton>
</FormArray.Root>
```

## Sub-компоненты

| Компонент | Props | Назначение |
|-----------|-------|------------|
| `FormArray.Root` | `control: ArrayNode<T>` | Context provider |
| `FormArray.List` | `children: (item) => ReactNode` | Итерация по элементам (render props) |
| `FormArray.AddButton` | `initialValue?: Partial<T>` | Добавляет новый элемент |
| `FormArray.RemoveButton` | - | Удаляет текущий элемент (внутри List) |
| `FormArray.Empty` | `children: ReactNode` | Показывает при пустом массиве |
| `FormArray.Count` | `render?: (count) => ReactNode` | Отображает количество |
| `FormArray.ItemIndex` | `render?: (index) => ReactNode` | Отображает текущий индекс |

## Render Props в List

```typescript
interface FormArrayItemRenderProps<T> {
  control: FormProxy<T>;  // Контрол элемента
  index: number;                       // Индекс (0-based)
  id: string | number;                 // Уникальный ключ
  remove: () => void;                  // Удалить этот элемент
}
```

## Внешнее управление через Ref

```tsx
import { useRef } from 'react';
import { FormArray, FormArrayHandle } from '@reformer/ui/form-array';

const arrayRef = useRef<FormArrayHandle<ItemType>>(null);

// Управление извне
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

Для полной кастомизации без compound components:

```tsx
import { useFormArray } from '@reformer/ui/form-array';

function CustomList() {
  const { items, add, isEmpty, length } = useFormArray(form.items);

  return (
    <div>
      <span>Всего: {length}</span>
      {items.map(({ control, id, remove }) => (
        <div key={id}>
          <ItemForm control={control} />
          <button onClick={remove}>X</button>
        </div>
      ))}
      {isEmpty && <p>Пусто</p>}
      <button onClick={() => add()}>Добавить</button>
    </div>
  );
}
```

## Примеры

### С кастомным контейнером

```tsx
<FormArray.List className="space-y-4" as="ul">
  {(item) => (
    <li>
      <ItemForm control={item.control} />
    </li>
  )}
</FormArray.List>
```

### С начальными значениями

```tsx
<FormArray.AddButton initialValue={{ status: 'draft', priority: 'low' }}>
  Добавить черновик
</FormArray.AddButton>
```

### С счётчиком

```tsx
<h3>
  Элементы (
  <FormArray.Count render={(count) =>
    count === 0 ? 'нет' : `${count} шт.`
  } />
  )
</h3>
```
