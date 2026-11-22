# List

Headless-перебор массива модели **только для показа**: на каждый элемент — своя разметка, без
кнопок добавления, удаления и перестановки. Это read-only брат `FieldArray`. Подходит для
списков, которые пользователь не правит, а поведение формы наполняет и чистит само: уведомления,
предупреждения, итоги по строкам.

```typescript
import { List, useList } from '@reformer/cdk/list';
```

## List vs FieldArray

| Нужно                                                        | Брать        |
| ------------------------------------------------------------ | ------------ |
| Пользователь добавляет, удаляет, переставляет строки         | `FieldArray` |
| Список только показывается; меняет его поведение или сервер  | `List`       |

Оба принимают один и тот же узел массива формы (`FormArray<T>`, например `form.alerts`). `List`
читает из него только `length`, `value`, `map` и `keyAt` — изменить массив через `List` нельзя.

## Compound API

```tsx
import type { FormArray } from '@reformer/core';
import { List } from '@reformer/cdk/list';

type Alert = { level: 'info' | 'warning'; text: string };

function AlertsView({ control }: { control: FormArray<Alert> }) {
  return (
    <List.Root control={control}>
      <List.Empty>
        <p>Уведомлений нет</p>
      </List.Empty>
      <List.Items className="space-y-2">
        {/* ключ строки List.Items ставит сам */}
        {({ control: row, index }) => <AlertRow control={row} index={index} />}
      </List.Items>
    </List.Root>
  );
}
```

| Часть        | Что делает                                                                           |
| ------------ | ------------------------------------------------------------------------------------ |
| `List.Root`  | Провайдер контекста, проп `control` — узел массива                                   |
| `List.Items` | Перебирает элементы; `children` — функция `({ control, index, id }) => ReactNode`    |
| `List.Empty` | Рендерит `children`, только когда список пуст                                        |

`<List>` — то же, что `<List.Root>`. Без `className` элементы `List.Items` рендерятся во
фрагменте; с `className` — в контейнере `as` (по умолчанию `div`). `control` элемента —
`FormGroup<T>` строки, `id` — стабильный ключ строки (`control.keyAt(index)`): перестановка и
фильтрация сохраняют состояние элементов. Ключ React у каждого элемента `List.Items` ставит сам.

## useList

```tsx
import { useList } from '@reformer/cdk/list';

function AlertsSummary({ control }: { control: FormArray<Alert> }) {
  const { items, length, isEmpty } = useList(control);
  if (isEmpty) return null;
  return (
    <ul aria-label={`Уведомления: ${length}`}>
      {items.map(({ control: row, id }) => (
        <AlertRow key={id} control={row} />
      ))}
    </ul>
  );
}
```

Хук подписан на длину и значение массива: список перерисовывается при добавлении, удалении и
перестановке строк модели, в том числе из поведения формы.

Контекст для своих частей — `ListContext` / `useListContext()` (внутри `List.Root`) и
`ListItemContext` / `useListItemContext()` (внутри `List.Items`). Вне провайдера хуки бросают
исключение с подсказкой.

## Anti-patterns

- Рисовать через `List` редактируемый список с самодельными кнопками «добавить» и «удалить»:
  у `List` нет ни действий, ни их доступности — для этого `FieldArray`.
- Ключ строки по индексу (`key={index}`): при удалении из середины состояние элементов съедет.
  Ключ — `id` из render-prop или `useList`.
