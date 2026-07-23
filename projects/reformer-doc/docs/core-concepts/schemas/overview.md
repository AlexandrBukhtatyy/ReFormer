---
sidebar_position: 1
---

# Обзор схем

ReFormer делит форму на три независимые заботы — **структуру**, **валидацию** и **behavior** — чтобы
код оставался сфокусированным и переиспользуемым. В архитектуре M1 значения живут в **модели**,
**layout-схема** привязывает каждое поле к сигналу модели и описывает только структуру и UI, правила
корректности выносятся в **отдельную схему валидации** и прогоняются по требованию раннером
`validateModel`, а реактивная логика описывается отдельно через `defineFormBehavior`.

## Структура, валидация и behavior

| Забота        | Что описывает                    | Где живёт                                             |
| ------------- | -------------------------------- | ----------------------------------------------------- |
| **Структура** | Данные и конфигурация полей      | `model` + узлы layout-`schema`                        |
| **Валидация** | Правила корректности данных      | отдельная `ValidationSchema` → раннер `validateModel` |
| **Behavior**  | Реактивная логика и side-эффекты | `defineFormBehavior`                                  |

```typescript
import { createModel, createForm } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type Person = { firstName: string; lastName: string; fullName: string; email: string };

const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

// 1. Layout-схема — структура + UI. Узел привязывает сигнал модели к компоненту; валидаторов здесь нет.
const schema = {
  firstName: { value: model.$.firstName, component: Input },
  lastName: { value: model.$.lastName, component: Input },
  fullName: { value: model.$.fullName, component: Input },
  email: { value: model.$.email, component: Input },
};

// 2. Валидация — отдельная схема-функция над моделью. Прогоняется по требованию (не формой).
const personValidation = defineValidationSchema<Person>(({ model }) => {
  validate(model.$.firstName, [required()]);
  validate(model.$.lastName, [required()]);
  validate(model.$.email, [required(), email()]);
});

// 3. Behavior — реактивная логика, описывается отдельно.
const behavior = defineFormBehavior<Person>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

const form = createForm<Person>({ model, schema, behavior });

// Валидацию запускает приложение (на submit / шаге wizard), а не форма:
async function submit() {
  form.markAsTouched(); // раскрыть ошибки в UI
  if (!(await validateModel(model, personValidation))) return; // ошибки уже разведены по нодам
  await api.save(model.get()); // api — ваш слой сохранения
}
```

:::info Форма больше не валидирует схему сама
`createForm` собирает структуру и behavior, но **не** прогоняет правила валидации: вердикт даёт
приложение вызовом `validateModel(model, validation)`. Методы формы (`markAsTouched`, `clearErrors`)
управляют только UI-состоянием нод. Поэтому валидация — отдельное значение, которое хранят в `const`
и кормят раннеру по разным каналам. Подробнее — в [Схеме валидации](./validation-schema).
:::

## Связь модели и схемы

Схема **не хранит значения** — их источник истины это модель. Узел лишь связывает поле с сигналом
модели через `value: model.$.<field>` и добавляет поверх него UI-конфиг (`component`,
`componentProps`). Валидаторов в узле нет — правила живут в отдельной [схеме валидации](./validation-schema).

```typescript
const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

const schema = {
  // value — сигнал модели, а не начальное значение. Значение 'firstName' живёт в модели.
  firstName: { value: model.$.firstName, component: Input },
};
```

Из-за этого запись через ноду (`form.firstName.setValue('Jane')`) и через модель
(`model.firstName = 'Jane'`) — это один и тот же сигнал: изменение в одном месте мгновенно видно в
другом. Тот же сигнал (`model.$.firstName`) адресует поле и в схеме валидации через
`validate(model.$.firstName, …)`, поэтому ошибка доезжает ровно до этой ноды. Подробнее о модели — в
[Модель данных](../model), о нодах — в [Ноды и proxy](../nodes).

## Зачем разделять заботы?

### Разделение ответственности

У каждой заботы одна зона ответственности:

- **Структура** (`model` + layout-`schema`): «какие данные собираем и как их показать?»
- **Валидация** (`defineValidationSchema` + `validateModel`): «корректны ли данные?»
- **Behavior** (`defineFormBehavior`): «как данные реагируют на изменения?»

### Переиспользование и декомпозиция

Каждую заботу можно разложить на переиспользуемые части и собрать поверх под-моделей. Ключевой
приём — **builder / под-схема**, принимающие под-модель (`FormModel<Sub>`):

```typescript
import { createModel, createForm, type FormModel } from '@reformer/core';
import { validate, defineValidationSchema, type ValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type Address = { street: string; city: string; zip: string };
type OrderForm = { billingAddress: Address; shippingAddress: Address };

// 1. Layout-builder — узлы привязаны к сигналам под-модели (без валидаторов).
const addressNodes = (m: FormModel<Address>) => ({
  street: { value: m.$.street, component: Input },
  city: { value: m.$.city, component: Input },
  zip: { value: m.$.zip, component: Input },
});

// 2. Под-схема валидации адреса — обычная функция над FormModel<Address>, reuse прямым вызовом.
const addressValidation: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.street, [required()]);
  validate(model.$.city, [required()]);
  validate(model.$.zip, [required()]);
};

// 3. Переиспользуемый набор behavior — работает с теми же сигналами под-модели.
const addressBehaviors = (m: FormModel<Address>) => {
  transformValue(m.$.zip, (value) => (value ?? '').trim());
};

const model = createModel<OrderForm>({
  billingAddress: { street: '', city: '', zip: '' },
  shippingAddress: { street: '', city: '', zip: '' },
});

// Layout — переиспользуем builder для обоих адресов.
const schema = {
  billingAddress: addressNodes(model.billingAddress),
  shippingAddress: addressNodes(model.shippingAddress),
};

// Валидация — одна под-схема, прямой вызов над каждой под-моделью.
const orderValidation = defineValidationSchema<OrderForm>(({ model }) => {
  addressValidation({ model: model.billingAddress });
  addressValidation({ model: model.shippingAddress });
});

// Behavior — один набор к обеим под-моделям (внутри defineFormBehavior).
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.billingAddress);
  addressBehaviors(model.shippingAddress);
});

const orderForm = createForm<OrderForm>({ model, schema, behavior });
```

Переиспользование работает на разной гранулярности:

```typescript
import type { Rule } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';

// Один список правил — много полей (в схеме валидации).
const textRules: Rule<string>[] = [required(), minLength(2)];
const addressTextValidation = defineValidationSchema<Address>(({ model }) => {
  validate(model.$.street, textRules); // тот же список — на любое строковое поле
  validate(model.$.city, textRules);
});

// Один layout-builder — много под-моделей.
const schema = {
  billingAddress: addressNodes(model.billingAddress),
  shippingAddress: addressNodes(model.shippingAddress),
};

// Одна под-схема валидации — над многими под-моделями (прямой вызов).
const orderValidation = defineValidationSchema<OrderForm>(({ model }) => {
  addressValidation({ model: model.billingAddress });
  addressValidation({ model: model.shippingAddress });
});

// Один набор behavior — много под-моделей (внутри defineFormBehavior).
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.billingAddress);
  addressBehaviors(model.shippingAddress);
});
```

:::tip Builder-функции, а не общие объекты
Предпочитайте builder / под-схему, принимающие под-модель (`addressNodes(model.billingAddress)`,
`addressValidation({ model: model.billingAddress })`), ручному дублированию объектов и правил. Каждый
вызов привязывается к нужным сигналам и держит определения DRY.
:::

**Что даёт декомпозиция:**

- **DRY** — написал один раз, используешь везде.
- **Согласованность** — одни и те же правила во всех формах.
- **Поддерживаемость** — правка в одном месте.
- **Тестируемость** — каждую часть можно проверить изолированно.

Полные паттерны и best practices — в [Композиции](./composition).

### Тестируемость

Схему валидации можно проверять изолированно через раннер `validateModel` — он возвращает вердикт
`Promise<boolean>` и сам разносит ошибки по нодам формы. Достаточно модели, схемы валидации и
(чтобы прочитать ошибку конкретного поля) формы:

```typescript
import { createModel, createForm } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const personValidation = defineValidationSchema<Person>(({ model }) => {
  validate(model.$.firstName, [required()]);
});

describe('валидация person', () => {
  it('требует firstName', async () => {
    const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });
    const schema = {
      firstName: { value: model.$.firstName, component: Input },
      lastName: { value: model.$.lastName, component: Input },
    };
    const form = createForm<Person>({ model, schema });

    // validateModel сам разносит ошибки по нодам формы и возвращает вердикт.
    const valid = await validateModel(model, personValidation);

    expect(valid).toBe(false);
    expect(form.firstName.errors.value[0]?.code).toBe('required');
  });
});
```

:::tip Нужен только вердикт — форму строить необязательно
Если проверяете лишь `boolean`-результат, ноды можно не создавать: `await validateModel(model,
personValidation)` вернёт вердикт и без формы — роутинг ошибок в этом случае просто становится
no-op.
:::

### Типобезопасность

Сигналы модели (`model.$.<field>`) полностью типизированы, поэтому привязка несуществующего поля —
ошибка компиляции. Это работает и в layout-схеме, и в схеме валидации:

```typescript
const schema = {
  firstName: { value: model.$.firstName, component: Input }, // ✅ типизированный сигнал
  // middleName: { value: model.$.middleName },              // ❌ Ошибка: поля 'middleName' нет в модели
};

const personValidation = defineValidationSchema<Person>(({ model }) => {
  validate(model.$.email, [required(), email()]); // ✅ email() ждёт string — тип поля проверяется
  // validate(model.$.email, [min(3)]);           // ❌ Ошибка: min() ждёт number, а email: string
});
```

## Из чего собирается форма

```
createForm({ model, schema, behavior })
├── model: FormModel<T>        → источник истины для значений
├── schema                     → layout-узлы: { value: signal, component?, componentProps? }
└── behavior: FormBehavior<T>  → defineFormBehavior(...) — реактивная логика

validateModel(model, validation) → отдельный канал: правила из defineValidationSchema, по требованию
```

## Дальше

- [Схема формы](./form-schema) — структура и конфигурация полей.
- [Схема валидации](./validation-schema) — правила корректности и раннер `validateModel`.
- [Схема behavior](./behavior-schema) — реактивная логика.
- [Композиция](./composition) — переиспользование и декомпозиция.
  </content>
  </invoke>
