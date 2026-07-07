---
sidebar_position: 2
---

# Массивы и динамические формы

Массивы объектов **принадлежат модели**. Данные лежат в модели, а форма строит поверх них
под-формы и подхватывает изменения реактивно. Поэтому все мутации — `push` / `removeAt` /
`move` / … — выполняются на модели, а не на нодах формы.

## Узел схемы массива

Массив описывается узлом `{ array: model.<path>, item: (itemModel) => subSchema }`. Функция `item`
строит под-схему **одного элемента** из его под-модели (`FormModel<Item>`); поля привязываются
через сигнал под-модели `item.$.field`.

```typescript
import { createModel, createForm, type FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Item = { title: string; amount: number | null };
type OrderForm = { items: Item[] };

const model = createModel<OrderForm>({ items: [] });

// под-схема одного элемента — item.$.field это сигнал под-модели
const itemSchema = (item: FormModel<Item>) => ({
  title: { value: item.$.title, component: Input, componentProps: { label: 'Позиция' } },
  amount: {
    value: item.$.amount,
    component: Input,
    componentProps: { label: 'Сумма', type: 'number' },
  },
});

const schema = {
  items: { array: model.items, item: itemSchema },
};

const form = createForm<OrderForm>({ model, schema });
```

:::warning Тип элемента — через `type`, не `interface`
Тип `Item` объявляйте `type`-алиасом. Интерпретатору схемы нужна структурная индекс-сигнатура
(`Record<string, …>`): у `type` она есть, у `interface` — нет, поэтому `interface` в под-схему
элемента не подставится.
:::

:::info Массив привязывается через value-proxy
В узле схемы массив связывается через `model.items` (value-proxy, несёт путь `__path`), а **не**
через сигнальный `model.$.items`. Отдельные поля элемента — наоборот, через сигнал `item.$.field`.
:::

:::warning Валидация элементов — второй набор ключей на узле
Узел `{ array, item }` описывает массив для **построения и рендера** формы. Движок **валидации**
(`validateFormModel`) распознаёт секцию массива по другому шейпу —
`componentProps: { control, itemComponent }`. Если у полей элемента есть валидаторы и их нужно
проверять, укажите на узле массива **оба** набора ключей — одна схема обслужит и рендер, и валидацию:

```typescript
const schema = {
  items: {
    array: model.items, // для createForm — построение и рендер
    item: itemSchema,
    componentProps: {
      // для validateFormModel — per-item валидация
      control: model.items,
      itemComponent: itemSchema,
    },
  },
};
```

Только `{ array, item }` → валидаторы элементов молча не запустятся; только `componentProps` →
`createForm` не материализует ноды массива. Подробнее — в
[Схеме валидации](../core-concepts/schemas/validation-schema) и
[Стратегиях валидации](../validation/validation-strategies).
:::

## Операции модели

Мутации выполняются на `ModelArray` (`model.items`). Форма отражает их реактивно.

| Операция                         | Назначение                               |
| -------------------------------- | ---------------------------------------- |
| `model.items.push(value)`        | добавить элемент в конец                 |
| `model.items.insertAt(i, value)` | вставить по индексу                      |
| `model.items.removeAt(i)`        | удалить по индексу                       |
| `model.items.move(from, to)`     | переместить элемент                      |
| `model.items.swap(a, b)`         | поменять местами                         |
| `model.items.clear()`            | очистить массив                          |
| `model.items.at(i)`              | под-модель элемента (`FormModel<Item>`)  |
| `model.items.length`             | реактивная длина                         |
| `model.items.map((it, i) => …)`  | обход элементов как значений (реактивно) |

```typescript
model.items.push({ title: 'Book', amount: 100 }); // добавить в конец
model.items.insertAt(0, { title: 'Pen', amount: 5 }); // вставить
model.items.removeAt(1); // удалить по индексу
model.items.move(0, 2); // переместить
model.items.swap(0, 1); // поменять местами
model.items.clear(); // очистить всё
```

:::warning `push` принимает плоские значения
В `push` / `insertAt` передавайте payload из **плоских значений** (`{ title, amount }`), а не
шаблон поля (`{ value, component }`). Компонент и его пропсы берутся из фабрики `item` схемы
автоматически. Передача FieldConfig-объектов сломает рендер (`[object Object]` в инпутах).
:::

## Реактивная длина в React

Длину массива в компоненте читайте через `useArrayLength(form.<array>)` — хук пере-рендерит только
на добавление/удаление элементов.

```tsx
import { useArrayLength } from '@reformer/core';

const length = useArrayLength(form.items);
// length: number — реактивно обновляется на push / removeAt / reorder
```

## Рендер элементов

Каждый элемент массива — под-форма (`FormProxy<Item>`). Итерируйте через `form.items.map`;
точечный доступ — `form.items.at(i)`. Мутации в обработчиках — на модели.

```tsx
import { useArrayLength } from '@reformer/core';
import { FormField, Button } from '@reformer/ui-kit';
import type { FormProxy, FormModel } from '@reformer/core';

function ItemsList({ form, model }: { form: FormProxy<OrderForm>; model: FormModel<OrderForm> }) {
  const length = useArrayLength(form.items);

  return (
    <div>
      {form.items.map((item, index) => (
        <div key={index}>
          <FormField control={item.title} />
          <FormField control={item.amount} />
          <Button type="button" onClick={() => model.items.removeAt(index)}>
            Удалить
          </Button>
        </div>
      ))}

      {length === 0 && <p>Пока нет ни одной позиции</p>}

      <Button type="button" onClick={() => model.items.push({ title: '', amount: null })}>
        Добавить позицию
      </Button>
    </div>
  );
}
```

:::tip Готовый компонент массива
В `@reformer/ui-kit` есть `FormArraySection` (`control={form.items}`, `itemComponent`,
`initialValue`, add / remove / reorder из коробки) — используйте его, если не нужна своя разметка.
:::

## Реактивные агрегаты

Сумма (или любой агрегат) по массиву считается **реактивно** через `compute` в behavior. Читайте
элементы через value-proxy массива `model.items.map(...)` — так трекается и длина массива, и правки
внутри элементов.

```typescript
import { defineFormBehavior, compute } from '@reformer/core/behaviors';

type OrderForm = { items: { title: string; amount: number | null }[]; total: number };

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  compute(model.$.total, () =>
    model.items.map((it) => it.amount ?? 0).reduce((sum, v) => sum + v, 0)
  );
});

const form = createForm<OrderForm>({ model, schema, behavior });
```

Почему это реактивно: `.map` читает сигнал самого массива (реагирует на `push` / `removeAt` /
reorder) и внутри колбэка читает `it.amount` каждого элемента (реагирует на правки полей) —
пересчёт срабатывает на оба вида изменений.

:::warning Не агрегируйте через `model.get()`
Внутри `compute` не читайте `model.get()` или `model.items.toArray()` — это нереактивные снимки,
зависимость не отследится и сумма не пересчитается. Агрегируйте только через value-proxy
`model.items.map(...)`.
:::

Если нужен только счётчик (пересчёт лишь на изменение длины, без чтения полей элементов) — читайте
`model.items.map(() => null).length`: длина трекается, значения — нет.

## Очистка и cleanup

Очистить коллекцию — `model.items.clear()`. Типичный случай — сбросить массив при выключении флага.
Делается через `onChange` на сигнале флага: колбэк выполняется **вне** effect-контекста, поэтому
мутировать модель безопасно.

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

:::info Cleanup управляется формой
Behavior, переданный в `createForm({ model, schema, behavior })`, сам следит за жизненным циклом:
подписки `compute` / `onChange` и per-item логика снимаются, когда форма уничтожается. Отдельно
чистить подписки массива не нужно — при `removeAt` / `clear` ноды удалённых элементов утилизируются
автоматически.
:::

## Дальше

- [Модель данных](../core-concepts/model) — массивы модели и её API.
- [Ноды и proxy](../core-concepts/nodes) — `ArrayNode` и доступ к элементам.
- [Вычисляемые поля](../behaviors/computed) — `compute` и агрегаты подробнее.
- [Отправка и сброс](./submit-and-reset) — валидация и submit формы с массивами.
