---
sidebar_position: 2
---

# Массивы и динамические формы

Массивы объектов **принадлежат модели**. Данные лежат в модели, а форма строит поверх массива ноду
`FormArray` — по форме-строке (`FormGroup<Item>`) на каждый элемент — и подхватывает изменения
реактивно. Мутировать массив можно и через модель (`model.items.push(…)`), и через ноду массива
(`form.items.push(…)`): нода тоже пишет в модель, а строки формы перестраиваются сами.

## Узел схемы массива

Массив под-форм описывается узлом `{ model: model.$.items, component: FieldArray, item: (row) => узел }`.
Функция `item` строит разметку **одной строки** из её под-модели (`FormModel<Item>`); поля строки
привязываются через сигнал под-модели `row.$.field`.

```typescript
import {
  arrayOf,
  createForm,
  createModel,
  type FormModel,
  type FormSchemaNode,
} from '@reformer/core';
import { FieldArray, Input, InputNumber } from '@reformer/ui-kit';

type Item = { title: string; amount: number | null };
type OrderForm = { items: Item[] };

// Шаблон новой строки — в модели: его получает push() без аргумента и кнопка «Добавить».
const blankItem = (): Item => ({ title: '', amount: null });

// Разметка одной строки — row.$.field это сигнал под-модели строки
const itemRow = (row: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: row.$.title, component: Input, componentProps: { label: 'Позиция' } },
    { model: row.$.amount, component: InputNumber, componentProps: { label: 'Сумма' } },
  ],
});

const orderSchema = (model: FormModel<OrderForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.items,
      component: FieldArray,
      componentProps: { title: 'Позиции', addButtonLabel: 'Добавить позицию' },
      item: itemRow,
    },
  ],
});

const order = createForm<OrderForm>({
  model: createModel<OrderForm>({ items: arrayOf(blankItem) }),
  schema: orderSchema,
});

order.form.items; // FormArray<Item>
```

:::info Чем станет массив, решает схема
Массив объектов становится нодой `FormArray`, только если в схеме есть его узел с `item`. Массив,
к которому схема привязала компонент без `item`, — одно значение поля (мультивыбор, теги, файлы):
`{ model: model.$.tags, component: SelectMulti }`. Массив без узла в схеме форма пропускает.
:::

:::info Правила строк — отдельный слой, оператор `applyEach`
Узел массива описывает только разметку — валидаторов он **не несёт**. Правила строки — обычная
схема валидации над типом элемента; к каждой строке её подключает `applyEach`:

```typescript
import { applyEach, defineValidation, validate } from '@reformer/core/validation';
import { required, min, minLength } from '@reformer/core/validators';

const itemRules = defineValidation<Item>(({ model }) => {
  validate(model.$.title, [required({ code: 'item.title.required' })]);
  validate(model.$.amount, [required(), min(1)]);
});

const orderRules = defineValidation<OrderForm>(({ model }) => {
  validate(model.$.items, [minLength(1, { code: 'items.minLength' })]); // массив целиком
  applyEach(model.$.items, itemRules); // правила каждой строки
});
```

Внутри схемы строки `cross` получает снимок **строки** — так пишутся сравнения полей одного
элемента. Подробнее — в [Схеме валидации](../core-concepts/schemas/validation-schema).
:::

## Операции

Одни и те же операции есть у массива модели (`model.items`) и у ноды массива (`form.items`). Форма
отражает любую из них реактивно.

| Модель (`ModelArray`)             | Нода (`FormArray`)              | Назначение                                     |
| --------------------------------- | ------------------------------- | ---------------------------------------------- |
| `model.items.push(value?)`        | `form.items.push(value?)`       | добавить в конец; без значения — по шаблону    |
| `model.items.insertAt(i, value?)` | `form.items.insert(i, value?)`  | вставить по индексу                            |
| `model.items.removeAt(i)`         | `form.items.removeAt(i)`        | удалить по индексу                             |
| `model.items.move(from, to)`      | `form.items.move(from, to)`     | переместить элемент                            |
| `model.items.swap(a, b)`          | `form.items.swap(a, b)`         | поменять местами                               |
| `model.items.clear()`             | `form.items.clear()`            | очистить массив                                |
| `model.items.at(i)`               | `form.items.at(i)`              | под-модель строки / форма строки (`FormGroup`) |
| `model.items.length`              | `form.items.length`             | число элементов (реактивно в эффекте)          |
| `model.items.map((it, i) => …)`   | `form.items.map((row, i) => …)` | обход: значения строк / формы строк            |
| —                                 | `form.items.keyAt(i)`           | стабильный ключ строки для React               |

```typescript
model.items.push({ title: 'Book', amount: 100 }); // добавить в конец
model.items.push(); // строка по шаблону arrayOf(blankItem)
model.items.insertAt(0, { title: 'Pen', amount: 5 }); // вставить
order.form.items.removeAt(1); // то же через ноду
order.form.items.move(0, 2); // переместить — формы строк не пересоздаются
model.items.clear(); // очистить всё
```

:::warning `push` принимает плоские значения
В `push` / `insert` передавайте **значения** элемента (`{ title, amount }`), а не узел схемы
(`{ model, component }`). Компонент и его пропсы берутся из `item` схемы автоматически.
:::

## Рендер в React

Готовые компоненты снимают с вас подписки, ключи и кнопки:

- в схеме формы — узел `{ model, component: FieldArray, item }` (ui-kit `FieldArray` рисует
  заголовок, «Добавить», карточки строк, удаление и перестановку);
- в разметке руками — `FieldArraySection` из `@reformer/ui-kit` (`control={form.items}`,
  `itemComponent`) или headless [`FieldArray`](../cdk/field-array) из `@reformer/cdk`.

Своя разметка — через ноду массива. Ключ строки — `keyAt(index)`: он держится за элемент модели и
не меняется при `move` / `swap`, поэтому состояние строки не «переезжает» к соседу.

```tsx
import { useArrayLength } from '@reformer/core/react';
import { FormField, Button } from '@reformer/ui-kit';
import type { FormArray } from '@reformer/core';

function ItemsList({ items }: { items: FormArray<Item> }) {
  const length = useArrayLength(items); // перерисовка на добавление и удаление строк

  return (
    <div>
      {items.map((row, index) => (
        <div key={items.keyAt(index)}>
          <FormField control={row.title} />
          <FormField control={row.amount} />
          <Button type="button" onClick={() => items.removeAt(index)}>
            Удалить
          </Button>
        </div>
      ))}

      {length === 0 && <p>Пока нет ни одной позиции</p>}

      <Button type="button" onClick={() => items.push()}>
        Добавить позицию
      </Button>
    </div>
  );
}
```

`useArrayLength` подписан только на длину. Если строки переставляются (`move` / `swap`), берите
`useFormControl(items)` — он перерисует список и при смене порядка.

## Реактивные агрегаты

Сумма (или любой агрегат) по массиву считается **реактивно** через `compute` в поведении. Читайте
элементы через массив модели `model.items.map(...)` — так отслеживается и длина массива, и правки
внутри элементов.

```typescript
import { defineFormBehavior, compute } from '@reformer/core/behaviors';

type OrderForm = { items: { title: string; amount: number | null }[]; total: number };

const orderBehavior = defineFormBehavior<OrderForm>(({ model }) => {
  compute(model.$.total, () =>
    model.items.map((it) => it.amount ?? 0).reduce((sum, v) => sum + v, 0)
  );
});

createForm<OrderForm>({ model, schema: orderSchema, behavior: orderBehavior });
```

Почему это реактивно: `.map` читает сигнал самого массива (реагирует на `push` / `removeAt` /
перестановку) и внутри колбэка читает `it.amount` каждого элемента (реагирует на правки полей) —
пересчёт срабатывает на оба вида изменений.

:::warning Не агрегируйте через `model.get()`
Внутри `compute` не читайте `model.get()` или `model.items.toArray()` — это нереактивные снимки,
зависимость не отследится и сумма не пересчитается. Агрегируйте через `model.items.map(...)`.
:::

Если нужен только счётчик (пересчёт лишь на изменение длины, без чтения полей элементов) — читайте
`model.items.length`.

## Очистка

Очистить коллекцию — `model.items.clear()`. Типичный случай — сбросить массив при выключении флага.
Делается через `onChange` на сигнале флага: колбэк выполняется **вне** эффекта, поэтому мутировать
модель безопасно.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

type Form = { hasItems: boolean; items: { title: string; amount: number | null }[] };

const behavior = defineFormBehavior<Form>(({ model }) => {
  // при снятии флага — очистить массив
  onChange(model.$.hasItems, (hasItems) => {
    if (!hasItems) model.items.clear();
  });
});
```

:::info Подписки снимает форма
Поведение, переданное в `createForm({ behavior })`, живёт столько же, сколько форма: подписки
`compute` / `onChange` и поведение строк (`applyEach`) снимаются вместе с ней. При `removeAt` /
`clear` формы удалённых строк утилизируются автоматически.
:::

## Дальше

- [Модель данных](../core-concepts/model) — массивы модели и её API.
- [Ноды формы](../core-concepts/nodes) — `FormArray` и доступ к строкам.
- [Вычисляемые поля](../behaviors/computed) — `compute` и агрегаты подробнее.
- [Отправка и сброс](./submit-and-reset) — `bundle.submission.submit` и сброс формы с массивами.
