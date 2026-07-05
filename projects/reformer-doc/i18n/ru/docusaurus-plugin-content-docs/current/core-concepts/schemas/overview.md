---
sidebar_position: 1
---

# Обзор схем

ReFormer разделяет форму на три зоны ответственности — структуру, валидацию и поведение — чтобы код
оставался сфокусированным и переиспользуемым. В архитектуре M1 значения живут в **модели**, **схема**
привязывает каждое поле к сигналу модели (и держит его валидаторы), а реактивная логика объявляется
отдельно через `defineFormBehavior`.

## Структура, валидация и поведение

| Зона ответственности | Назначение                           | Где живёт                   |
| -------------------- | ------------------------------------ | --------------------------- |
| **Структура**        | Модель данных и конфигурация полей   | `model` + узлы `schema`     |
| **Валидация**        | Правила валидации                    | `validators` на каждом узле |
| **Поведение**        | Реактивная логика и побочные эффекты | `defineFormBehavior`        |

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

type Person = { firstName: string; lastName: string; fullName: string; email: string };

const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

// 1. Схема — структура + валидация. Каждый узел привязывает сигнал модели к компоненту.
const schema = {
  firstName: { value: model.$.firstName, component: Input, validators: [required()] },
  lastName: { value: model.$.lastName, component: Input, validators: [required()] },
  fullName: { value: model.$.fullName, component: Input },
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};

// 2. Поведение — реактивная логика, объявляется отдельно
const behavior = defineFormBehavior<Person>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

const form = createForm<Person>({ model, schema, behavior });
```

## Зачем разделять ответственность?

### Разделение ответственности

Каждая зона имеет одну ответственность:

- **Структура** (`model` + `schema`): «Какие данные мы собираем?»
- **Валидация** (`validators`): «Корректны ли данные?»
- **Поведение** (`defineFormBehavior`): «Как данные должны реагировать на изменения?»

### Переиспользование и декомпозиция

Каждую зону можно декомпозировать на переиспользуемые части и комбинировать по под-моделям:

```typescript
import { createModel, createForm, type ModelSignals } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

type Address = { street: string; city: string; zip: string };
type OrderForm = { billingAddress: Address; shippingAddress: Address };

// 1. Переиспользуемый builder схемы — узлы, привязанные к сигналам под-модели, валидаторы inline
const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input, validators: [required()] },
  city: { value: s.city, component: Input, validators: [required()] },
  zip: { value: s.zip, component: Input, validators: [required()] },
});

// 2. Переиспользуемый набор поведений — работает с теми же сигналами под-модели
const addressBehaviors = (s: ModelSignals<Address>) => {
  transformValue(s.zip, (value) => (value ?? '').trim());
};

const model = createModel<OrderForm>({
  billingAddress: { street: '', city: '', zip: '' },
  shippingAddress: { street: '', city: '', zip: '' },
});

// Собираем единую схему — переиспользуем builder для обоих адресов
const schema = {
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

// Собираем одно поведение — применяем один набор к обеим под-моделям
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});

const orderForm = createForm<OrderForm>({ model, schema, behavior });
```

Переиспользование работает на нескольких уровнях гранулярности:

```typescript
// Один список валидаторов — на много полей
const emailRules = [required(), email()];
const schema = {
  email: { value: model.$.email, component: Input, validators: emailRules },
  backupEmail: { value: model.$.backupEmail, component: Input, validators: emailRules },
};

// Один builder узлов — на много под-моделей
const addressSchema = {
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

// Один набор поведений — на много под-моделей (внутри defineFormBehavior)
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});
```

:::tip Builder-функции
Предпочитайте builder-функции, принимающие сигналы под-модели (`addressNodes(model.$.billingAddress)`),
вместо ручного дублирования объектов узлов. Каждый вызов привязывается к нужным сигналам и держит
определения DRY.
:::

**Преимущества декомпозиции:**

- **DRY** — Пишем один раз, используем везде
- **Консистентность** — Одинаковые правила во всех формах
- **Поддерживаемость** — Обновляем в одном месте
- **Тестируемость** — Тестируем каждую часть изолированно

Подробнее см. [Композиция](./composition).

### Тестируемость

Тестируйте валидацию изолированно с помощью `validateModelSync`:

```typescript
import { createModel, validateModelSync } from '@reformer/core';
import { required } from '@reformer/core/validators';

describe('валидация person', () => {
  it('требует firstName', () => {
    const model = createModel<Person>({ firstName: '', lastName: '' });
    const schema = {
      firstName: { value: model.$.firstName, validators: [required()] },
      lastName: { value: model.$.lastName },
    };

    const { valid, errors } = validateModelSync(model, schema);

    expect(valid).toBe(false);
    expect(errors.firstName?.[0]?.code).toBe('required');
  });
});
```

### Типобезопасность

Сигналы модели (`model.$.<field>`) полностью типизированы, поэтому привязка несуществующего поля —
ошибка на этапе компиляции:

```typescript
const schema = {
  firstName: { value: model.$.firstName, validators: [required()] }, // ✅ типизированный сигнал
  // middleName: { value: model.$.middleName }, // ❌ Ошибка: 'middleName' не существует в модели
};
```

## Структура схем

```
createForm({ model, schema, behavior })
├── model: FormModel<T>        → источник истины для значений
├── schema                     → узлы: { value: signal, component?, validators? }
└── behavior: FormBehavior<T>  → defineFormBehavior(...) — реактивная логика
```

## Следующие шаги

- [Схема формы](./form-schema) — Структура и конфигурация полей
- [Схема валидации](./validation-schema) — Правила валидации
- [Схема поведений](./behavior-schema) — Реактивная логика
- [Композиция](./composition) — Паттерны переиспользования и декомпозиции
  </content>
