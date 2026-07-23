---
sidebar_position: 2
---

# Схема формы

Схема описывает **структуру** формы: какие поля в ней есть, к какому сигналу модели привязано каждое
из них и каким компонентом оно рендерится. В M1 схема — это обычный объект, где каждый ключ —
узел, а не хранилище значений: значения живут в [модели](../model).

## Узел поля

Лист схемы — **узел поля**. Он привязывает поле к сигналу модели (`value: model.$.<field>`) и держит
его UI-конфиг. Валидаторов узел **не несёт**: layout описывает только структуру и вёрстку, а правила
корректности живут в отдельной [схеме валидации](./validation-schema) и прогоняются раннером
`validateModel`.

```typescript
{
  value: model.$.fieldName,   // сигнал модели (PathAwareSignal) — обязателен
  component: Input,           // React-компонент поля
  componentProps?: object,    // пропсы компонента (label, placeholder, options, type, ...)
  disabled?: boolean,         // начальное состояние «поле отключено»
  updateOn?: 'change' | 'blur' | 'submit',
}
```

| Поле             | Тип                              | Назначение                                                       |
| ---------------- | -------------------------------- | ---------------------------------------------------------------- |
| `value`          | `PathAwareSignal<T>`             | Привязка к сигналу модели (`model.$.<field>`) — обязателен       |
| `component`      | React-компонент                  | Чем рендерится поле                                              |
| `componentProps` | `object`                         | Пропсы компонента (`label`, `placeholder`, `options`, `type`, …) |
| `disabled`       | `boolean`                        | Начальное состояние «отключено»                                  |
| `updateOn`       | `'change' \| 'blur' \| 'submit'` | Когда обновлять значение из ввода                                |

:::info Узел не несёт валидаторов
Правила корректности не хранятся на узле layout-схемы (нет ни `validators`, ни `asyncValidators`). Они
объявляются **отдельной** функцией `defineValidationSchema<T>(({ model }) => …)` операторами из
`@reformer/core/validation` и прогоняются по требованию раннером `validateModel(model, schema)` — на
submit, на шаге wizard'а или по реакции behavior. Layout-схему и схему валидации можно менять
независимо: вёрстка приходит хоть с сервера, а правила пишутся один раз. См.
[Схему валидации](./validation-schema).
:::

:::warning `disabled` узла ≠ `componentProps.disabled`
`disabled` — это **поле узла** (начальное состояние ноды); дальше состоянием управляют методы
`form.field.disable()` / `enable()` и оператор `enableWhen`. `componentProps.disabled` — это UI-проп
компонента, и на состояние ноды он **не влияет** (частая причина «вычисляемое поле остаётся
редактируемым»).
:::

## Примитивные поля

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input, Select, Checkbox } from '@reformer/ui-kit';

type MyForm = { name: string; age: number | null; agree: boolean; status: string };

const model = createModel<MyForm>({ name: '', age: null, agree: false, status: 'active' });

const schema = {
  name: {
    value: model.$.name,
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Введите имя' },
  },
  age: {
    value: model.$.age,
    component: Input,
    componentProps: { type: 'number', label: 'Возраст' },
  },
  agree: {
    value: model.$.agree,
    component: Checkbox,
    componentProps: { label: 'Согласен с условиями' },
  },
  status: {
    value: model.$.status,
    component: Select,
    componentProps: {
      label: 'Статус',
      options: [
        { value: 'active', label: 'Активен' },
        { value: 'inactive', label: 'Неактивен' },
      ],
    },
  },
};

const form = createForm<MyForm>({ model, schema });
```

Правила для этих полей (`required()`, `email()`, …) в узлах не задаются — они пишутся в отдельной схеме
валидации над той же моделью (`validate(model.$.name, [required()])`) и прогоняются `validateModel`.
См. [Схему валидации](./validation-schema).

:::info Схема верхнего уровня — именованный объект
Узлы описываются как именованные ключи объекта (`{ name: {...}, age: {...} }`), а не как массив
`{ children: [...] }`. Ключ узла = имя поля модели, к которому он привязан.
:::

## Вложенные группы

Вложенная группа — сама по себе под-модель `FormModel<Sub>`: доступна как `model.address`, несёт `.$`
(сигналы) и API (`get`/`set`/`patch`/`isDirty`/`reset`), а её узлы привязаны к сигналам под-модели
(`model.$.address.city`). Такую группу удобно вынести в **builder**, принимающий `FormModel<Sub>`:

```typescript
import type { FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Address = { street: string; city: string; zip: string };

const addressNodes = (m: FormModel<Address>) => ({
  street: { value: m.$.street, component: Input, componentProps: { label: 'Улица' } },
  city: { value: m.$.city, component: Input, componentProps: { label: 'Город' } },
  zip: { value: m.$.zip, component: Input, componentProps: { label: 'Индекс' } },
});

const schema = {
  address: addressNodes(model.address),
};
```

Builder привязывает каждое поле к сигналам переданной под-модели, поэтому один и тот же builder можно
применить к нескольким адресам — см. [Композицию](./composition).

## Массивы — узел `{ array, item }`

Массивы объектов принадлежат модели. В схеме массив объявляется узлом
`{ array: model.<path>, item: (itemModel) => subSchema }`, где `item` строит под-схему одного
элемента из его под-модели (`FormModel<Item>`):

```typescript
import { createModel, createForm, type FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Item = { id: string; name: string; price: number };
type MyForm = { items: Item[] };

const model = createModel<MyForm>({ items: [] });

// Под-схема одного элемента (item.$.field — сигнал под-модели элемента).
const itemSchema = (item: FormModel<Item>) => ({
  id: { value: item.$.id, component: Input },
  name: { value: item.$.name, component: Input },
  price: { value: item.$.price, component: Input, componentProps: { type: 'number' } },
});

const schema = {
  items: { array: model.items, item: itemSchema },
};

const form = createForm<MyForm>({ model, schema });
```

Массив в узле связывается через **value-proxy** `model.items` (он несёт путь), а не через сигнальный
`model.$.items`. Операции над коллекцией (`push`/`removeAt`/`move`/…) выполняются на модели:

```typescript
model.items.push({ id: '1', name: '', price: 0 }); // плоские значения, без { value, component }
model.items.removeAt(0);
model.items.length; // реактивная длина
```

:::tip Тип элемента — через `type`
Тип элемента массива объявляйте через `type`-alias, а не `interface` — иначе он не совместим с
`Record<string, FormValue>`, и узел массива его отвергнет.
:::

Подробнее о динамических списках — в [Композиции](./composition) и разделе про [ноды массива](../nodes).

## Тип схемы в M1 — `unknown`

Схема в M1 типизирована как `unknown`, а не как строгий `FormSchema<T>`. Это сделано намеренно:
интерпретатор `createForm` **обходит произвольную структуру** и собирает листья
`{ value: signal, component?, ... }`. Благодаря этому в схеме допустимы обёртки (шаги wizard, секции,
группировки) — они не ломают компиляцию.

Типобезопасность при этом не теряется: её обеспечивают сами сигналы модели. Привязка `value:
model.$.<field>` типизирована, поэтому опечатка в имени поля — ошибка компиляции.

## Доступ через proxy

`createForm` возвращает **proxy**: к полям обращаются по имени, к вложенным — цепочкой, к элементам
массива — через `.at(i)`:

```typescript
const form = createForm<MyForm>({ model, schema });

form.name; // FieldNode<string> — TypeScript знает тип
form.address.city; // FieldNode<string> — вложенный доступ
form.items.at(0); // FormProxy<Item> — элемент массива

form.name.setValue('John');
form.name.value.value; // текущее значение (через сигнал)
```

:::warning Proxy не проходит `instanceof`
Не проверяйте тип ноды через `node instanceof FieldNode` — proxy это не пройдёт. Используйте
type-guards.
:::

```typescript
import { isFieldNode, isGroupNode, isArrayNode } from '@reformer/core';

if (isFieldNode(node)) {
  /* лист */
}
if (isGroupNode(node)) {
  /* группа */
}
if (isArrayNode(node)) {
  /* массив */
}
```

Подробнее о нодах, их сигналах и методах — в [Ноды и proxy](../nodes).

## Дальше

- [Схема валидации](./validation-schema) — отдельный слой правил корректности.
- [Схема behavior](./behavior-schema) — реактивная логика.
- [Композиция](./composition) — переиспользование схем.
