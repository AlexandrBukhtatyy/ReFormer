---
sidebar_position: 1
---

# Обзор схем

ReFormer делит форму на три независимые заботы — **структуру**, **валидацию** и **behavior** — чтобы
код оставался сфокусированным и переиспользуемым. В архитектуре M1 значения живут в **модели**,
**схема** привязывает каждое поле к сигналу модели (и несёт его валидаторы), а реактивная логика
описывается отдельно через `defineFormBehavior`.

## Структура, валидация и behavior

| Забота        | Что описывает                    | Где живёт                   |
| ------------- | -------------------------------- | --------------------------- |
| **Структура** | Данные и конфигурация полей      | `model` + узлы `schema`     |
| **Валидация** | Правила корректности данных      | `validators` на узлах схемы |
| **Behavior**  | Реактивная логика и side-эффекты | `defineFormBehavior`        |

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type Person = { firstName: string; lastName: string; fullName: string; email: string };

const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

// 1. Схема — структура + валидация. Каждый узел привязывает сигнал модели к компоненту.
const schema = {
  firstName: { value: model.$.firstName, component: Input, validators: [required()] },
  lastName: { value: model.$.lastName, component: Input, validators: [required()] },
  fullName: { value: model.$.fullName, component: Input },
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};

// 2. Behavior — реактивная логика, описывается отдельно.
const behavior = defineFormBehavior<Person>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

const form = createForm<Person>({ model, schema, behavior });
```

## Связь модели и схемы

Схема **не хранит значения** — их источник истины это модель. Узел лишь связывает поле с сигналом
модели через `value: model.$.<field>` и добавляет поверх него UI-конфиг (`component`,
`componentProps`) и валидаторы.

```typescript
const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

const schema = {
  // value — сигнал модели, а не начальное значение. Значение 'firstName' живёт в модели.
  firstName: { value: model.$.firstName, component: Input, validators: [required()] },
};
```

Из-за этого запись через ноду (`form.firstName.setValue('Jane')`) и через модель
(`model.firstName = 'Jane'`) — это один и тот же сигнал: изменение в одном месте мгновенно видно в
другом. Подробнее о модели — в [Модель данных](../model), о нодах — в [Ноды и proxy](../nodes).

## Зачем разделять заботы?

### Разделение ответственности

У каждой заботы одна зона ответственности:

- **Структура** (`model` + `schema`): «какие данные собираем?»
- **Валидация** (`validators`): «корректны ли данные?»
- **Behavior** (`defineFormBehavior`): «как данные реагируют на изменения?»

### Переиспользование и декомпозиция

Каждую заботу можно разложить на переиспользуемые части и собрать поверх под-моделей. Ключевой
приём — **builder**, принимающий сигналы под-модели (`ModelSignals<Sub>`):

```typescript
import { createModel, createForm, type ModelSignals } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type Address = { street: string; city: string; zip: string };
type OrderForm = { billingAddress: Address; shippingAddress: Address };

// 1. Переиспользуемый builder схемы — узлы привязаны к сигналам под-модели, валидаторы inline.
const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input, validators: [required()] },
  city: { value: s.city, component: Input, validators: [required()] },
  zip: { value: s.zip, component: Input, validators: [required()] },
});

// 2. Переиспользуемый набор behavior — работает с теми же сигналами под-модели.
const addressBehaviors = (s: ModelSignals<Address>) => {
  transformValue(s.zip, (value) => (value ?? '').trim());
};

const model = createModel<OrderForm>({
  billingAddress: { street: '', city: '', zip: '' },
  shippingAddress: { street: '', city: '', zip: '' },
});

// Собираем схему — переиспользуем builder для обоих адресов.
const schema = {
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

// Собираем один behavior — применяем один набор к обеим под-моделям.
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});

const orderForm = createForm<OrderForm>({ model, schema, behavior });
```

Переиспользование работает на разной гранулярности:

```typescript
// Один список валидаторов — много полей.
const emailRules = [required(), email()];
const schema = {
  email: { value: model.$.email, component: Input, validators: emailRules },
  backupEmail: { value: model.$.backupEmail, component: Input, validators: emailRules },
};

// Один builder узлов — много под-моделей.
const addressSchema = {
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

// Один набор behavior — много под-моделей (внутри defineFormBehavior).
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});
```

:::tip Builder-функции, а не общие объекты
Предпочитайте builder, принимающий сигналы под-модели (`addressNodes(model.$.billingAddress)`),
ручному дублированию объектов узлов. Каждый вызов привязывается к нужным сигналам и держит
определения DRY.
:::

**Что даёт декомпозиция:**

- **DRY** — написал один раз, используешь везде.
- **Согласованность** — одни и те же правила во всех формах.
- **Поддерживаемость** — правка в одном месте.
- **Тестируемость** — каждую часть можно проверить изолированно.

Полные паттерны и best practices — в [Композиции](./composition).

### Тестируемость

Валидацию можно проверять изолированно через `validateModelSync` — без нод и UI:

```typescript
import { createModel, validateModelSync } from '@reformer/core';
import { required } from '@reformer/core/validators';

describe('валидация person', () => {
  it('требует firstName', () => {
    const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });
    const schema = {
      firstName: { value: model.$.firstName, validators: [required()] },
      lastName: { value: model.$.lastName },
    };

    const { valid, errors } = validateModelSync(model, schema);

    expect(valid).toBe(false);
    expect(errors['firstName']?.[0]?.code).toBe('required');
  });
});
```

### Типобезопасность

Сигналы модели (`model.$.<field>`) полностью типизированы, поэтому привязка несуществующего поля —
ошибка компиляции:

```typescript
const schema = {
  firstName: { value: model.$.firstName, validators: [required()] }, // ✅ типизированный сигнал
  // middleName: { value: model.$.middleName }, // ❌ Ошибка: поля 'middleName' нет в модели
};
```

## Из чего собирается форма

```
createForm({ model, schema, behavior })
├── model: FormModel<T>        → источник истины для значений
├── schema                     → узлы: { value: signal, component?, validators? }
└── behavior: FormBehavior<T>  → defineFormBehavior(...) — реактивная логика
```

## Дальше

- [Схема формы](./form-schema) — структура и конфигурация полей.
- [Схема валидации](./validation-schema) — правила корректности.
- [Схема behavior](./behavior-schema) — реактивная логика.
- [Композиция](./composition) — переиспользование и декомпозиция.
