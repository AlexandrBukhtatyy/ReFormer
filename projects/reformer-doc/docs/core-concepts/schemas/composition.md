---
sidebar_position: 5
---

# Повторяющиеся группы и строки массива

Если группа полей встречается в форме несколько раз — адрес регистрации и адрес проживания, строки
списка, — её описывают один раз над типом группы и подключают к каждому месту. Разметка, правила и
поведение группы подключаются каждое своим оператором.

## Когда нужно

- В форме два и больше одинаковых блока: адреса, контакты, участники.
- Массив объектов, и у каждой строки свои поля, правила и расчёты.

Если общий кусок нужен в разных формах, а не в одной, — см.
[Общие поля и правила](./shared-parts.md) и [Модуль группы](./modules.md).

## Минимальный пример

Один адрес — две группы формы:

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { apply, defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import { apply as applyRules, defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Input, Section } from '@reformer/ui-kit';

type Address = { city: string; zip: string };
type Order = { billing: Address; shipping: Address };

// Разметка группы — функция от модели группы.
const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: m.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: m.$.zip, component: Input, componentProps: { label: 'Индекс' } },
  ],
});

// Правила группы — схема валидации над её типом.
const addressRules = defineValidation<Address>(({ model }) => {
  validate(model.$.city, [required()]);
  validate(model.$.zip, [required()]);
});

// Поведение группы — схема поведения над её типом.
const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  transformValue(model.$.zip, (value) => value.trim());
});

const blankAddress = (): Address => ({ city: '', zip: '' });

const order = createForm<Order>({
  initial: { billing: blankAddress(), shipping: blankAddress() },
  schema: (model) => ({
    children: [
      {
        component: Section,
        componentProps: { title: 'Плательщик' },
        children: [{ model: model.$.billing, part: addressPart }],
      },
      {
        component: Section,
        componentProps: { title: 'Доставка' },
        children: [{ model: model.$.shipping, part: addressPart }],
      },
    ],
  }),
  validation: defineValidation<Order>(({ model }) => {
    applyRules([model.$.billing, model.$.shipping], addressRules);
  }),
  behavior: defineFormBehavior<Order>(({ model }) => {
    apply([model.$.billing, model.$.shipping], addressBehavior);
  }),
});

order.form.shipping.city; // ноды подключённой части — обычные ноды формы
```

## Три подключения

|           | Группа                                | Строка массива                                               |
| --------- | ------------------------------------- | ------------------------------------------------------------ |
| Разметка  | узел `{ model: model.$.group, part }` | узел `{ model: model.$.items, component: FieldArray, item }` |
| Правила   | `apply(model.$.group, rules)`         | `applyEach(model.$.items, rowRules)`                         |
| Поведение | `apply(model.$.group, behavior)`      | `applyEach(model.$.items, rowBehavior)`                      |

`apply` принимает одну группу или список групп: `apply([model.$.billing, model.$.shipping], rules)`.
Оператор `apply` есть и в `@reformer/core/validation`, и в `@reformer/core/behaviors`. Если нужны
оба, переименуйте один при импорте: `import { apply as applyRules } from '@reformer/core/validation'`.

## Область подключения

Каждое подключение части — своя область. Внутри неё:

- `model` — модель группы или строки, а не всей формы;
- `cross` в правилах получает значения группы;
- `form` в поведении — нода группы или строки;
- `schema.node(selector)` ищет узлы только внутри части;
- `selector` должен быть уникален в своей области, но может повторяться в разных подключениях
  одной части.

Поэтому часть не знает, где стоит, и одну её можно подключить сколько угодно раз.

## Строки массива

Строка массива описывается так же — функцией над моделью строки. Пример: корзина, где у каждой
строки своя сумма и своё правило.

```typescript
import { arrayOf, createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { applyEach, compute, defineFormBehavior } from '@reformer/core/behaviors';
import { applyEach as applyEachRules, defineValidation, validate } from '@reformer/core/validation';
import { min } from '@reformer/core/validators';
import { FieldArray, InputNumber } from '@reformer/ui-kit';

type Item = { qty: number; price: number; lineTotal: number };
type Cart = { items: Item[] };

const itemRow = (row: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: row.$.qty, component: InputNumber, componentProps: { label: 'Количество' } },
    { model: row.$.price, component: InputNumber, componentProps: { label: 'Цена' } },
    { model: row.$.lineTotal, component: InputNumber, disabled: true },
  ],
});

const itemRules = defineValidation<Item>(({ model }) => {
  validate(model.$.qty, [min(1)]);
});

const itemBehavior = defineFormBehavior<Item>(({ model }) => {
  compute(model.$.lineTotal, () => model.qty * model.price);
});

const cart = createForm<Cart>({
  initial: { items: arrayOf((): Item => ({ qty: 1, price: 0, lineTotal: 0 })) },
  schema: (model) => ({
    children: [{ model: model.$.items, component: FieldArray, item: itemRow }],
  }),
  validation: defineValidation<Cart>(({ model }) => applyEachRules(model.$.items, itemRules)),
  behavior: defineFormBehavior<Cart>(({ model }) => applyEach(model.$.items, itemBehavior)),
});
```

Новые строки получают правила и поведение сами, у удалённых они снимаются.

## Подводные камни

- **Часть — функция, а не общий объект.** Узлы держат сигналы конкретной модели. Объект-литерал,
  собранный из сигналов одной модели, к другой группе не подключить.

  ```typescript
  // ✅ функция: каждый вызов получает свою группу
  const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
    children: [{ model: m.$.city, component: Input }],
  });

  // ❌ объект: сигналы одной модели, к другой группе не подключить
  const addressNodes = { children: [{ model: someModel.$.city, component: Input }] };
  ```

- **Группа полем не бывает.** `{ model: model.$.address, component: Input }` без `part` — ошибка:
  у группы нет одного значения для компонента.
- **Ноды строк нужны схеме.** `applyEach` поведения работает со значениями строки (`compute`,
  `copyFrom`) всегда. Операции с нодами строки (`enableWhen`, `form.updateComponentProps`) требуют,
  чтобы схема описала массив узлом с `item`. Иначе обращение к `form` строки бросит ошибку.

## См. также

- [Общие поля и правила](./shared-parts.md) — куски схем для разных форм.
- [Модуль группы](./modules.md) — разметка, правила и поведение группы в одной папке.
- [Массивы и динамические формы](/docs/patterns/arrays) — добавление, удаление и рендер строк.
- [Схема формы](./form-schema.md) — узлы `part` и `item`.
