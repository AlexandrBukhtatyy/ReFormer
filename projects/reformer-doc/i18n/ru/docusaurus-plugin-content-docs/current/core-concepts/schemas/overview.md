---
sidebar_position: 1
---

# Обзор схем

ReFormer делит форму на три независимые заботы — **структуру**, **валидацию** и **behavior** — чтобы
код оставался сфокусированным и переиспользуемым. В архитектуре M1 значения живут в **модели**,
**схема формы** привязывает каждое поле к ручке модели и описывает только структуру и UI, правила
корректности выносятся в **отдельную схему валидации**, а реактивная логика описывается отдельно
через `defineFormBehavior`. Все три части собирает один вызов `createForm`.

## Структура, валидация и behavior

| Забота        | Что описывает                    | Где живёт                                                           |
| ------------- | -------------------------------- | ------------------------------------------------------------------- |
| **Структура** | Данные и конфигурация полей      | модель + дерево схемы → `createForm({ schema })`                    |
| **Валидация** | Правила корректности данных      | `defineValidation` → `createForm({ validation })` / `validateModel` |
| **Behavior**  | Реактивная логика и side-эффекты | `defineFormBehavior` → `createForm({ behavior })`                   |

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type Person = { firstName: string; lastName: string; fullName: string; email: string };

// 1. Схема формы — структура + UI. Узел привязывает ручку модели к компоненту; правил здесь нет.
const personSchema = (model: FormModel<Person>): FormSchemaNode => ({
  children: [
    { model: model.$.firstName, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
    { model: model.$.fullName, component: Input, disabled: true },
    { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
  ],
});

// 2. Валидация — отдельная схема-функция над моделью.
const personValidation = defineValidation<Person>(({ model }) => {
  validate(model.$.firstName, [required()]);
  validate(model.$.lastName, [required()]);
  validate(model.$.email, [required(), email()]);
});

// 3. Behavior — реактивная логика, описывается отдельно.
const personBehavior = defineFormBehavior<Person>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

// Сборка одним вызовом: модель, ноды, правила и поведение.
const person = createForm<Person>({
  initial: { firstName: '', lastName: '', fullName: '', email: '' },
  schema: personSchema,
  validation: personValidation,
  behavior: personBehavior,
});

// Проверку запускает сборка: один прогон правил, замечания разнесены по нодам и показаны.
async function submit() {
  const outcome = await person.submit((values) => api.save(values)); // api — ваш слой сохранения
  if (outcome.status === 'invalid') showHint('Проверьте выделенные поля');
}
```

:::info Ноды формы правил не исполняют
Правила живут в схеме валидации, а не на нодах: их прогоняет сборка (`bundle.validate()`,
`bundle.submit(handler)`, шаг потока) или раннер `validateModel(model, rules)`. Методы нод
(`markAsTouched`, `setIssues`, `clearIssues`) управляют только состоянием нод. Схему валидации
хранят в `const` — по её идентичности раннер отменяет устаревшие прогоны. Подробнее — в
[Схеме валидации](./validation-schema).
:::

## Связь модели и схемы

Схема **не хранит значения** — их источник истины это модель. Узел лишь связывает поле с ручкой
модели через `model: model.$.<field>` и добавляет поверх него UI-конфиг (`component`,
`componentProps`). Правил в узле нет — они живут в отдельной [схеме валидации](./validation-schema).

```typescript
const personSchema = (model: FormModel<Person>): FormSchemaNode => ({
  children: [
    // model — ручка модели, а не начальное значение. Значение firstName живёт в модели.
    { model: model.$.firstName, component: Input },
  ],
});
```

Из-за этого запись через ноду (`form.firstName.setValue('Jane')`) и через модель
(`model.firstName = 'Jane'`) — это один и тот же сигнал: изменение в одном месте мгновенно видно в
другом. Та же ручка (`model.$.firstName`) адресует поле и в схеме валидации через
`validate(model.$.firstName, …)`, поэтому замечание доезжает ровно до этой ноды. Подробнее о модели —
в [Модель данных](../model), о нодах — в [Ноды формы](../nodes).

## Зачем разделять заботы?

### Разделение ответственности

У каждой заботы одна зона ответственности:

- **Структура** (модель + схема формы): «какие данные собираем и как их показать?»
- **Валидация** (`defineValidation`): «корректны ли данные?»
- **Behavior** (`defineFormBehavior`): «как данные реагируют на изменения?»

### Переиспользование и декомпозиция

Каждую заботу можно разложить на переиспользуемые части и подключить к группе модели. Для
структуры это **подформа**: часть схемы, написанная над под-моделью группы и подключённая узлом
`{ model: model.$.<группа>, part }`. Правила и поведение группы подключаются оператором `apply`:

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { apply as applyRules, defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { apply, defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import { Input, Section } from '@reformer/ui-kit';

type Address = { street: string; city: string; zip: string };
type OrderForm = { billingAddress: Address; shippingAddress: Address };

// 1. Часть схемы — привязки через `$` полученной под-модели.
const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: m.$.street, component: Input, componentProps: { label: 'Улица' } },
    { model: m.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: m.$.zip, component: Input, componentProps: { label: 'Индекс' } },
  ],
});

// 2. Правила адреса — схема валидации над типом группы.
const addressRules = defineValidation<Address>(({ model }) => {
  validate(model.$.street, [required()]);
  validate(model.$.city, [required()]);
  validate(model.$.zip, [required()]);
});

// 3. Поведение адреса — схема поведения над типом группы.
const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  transformValue(model.$.zip, (value) => (value ?? '').trim());
});

const blankAddress = (): Address => ({ street: '', city: '', zip: '' });

const order = createForm<OrderForm>({
  initial: { billingAddress: blankAddress(), shippingAddress: blankAddress() },
  // Одна часть — две группы.
  schema: (model) => ({
    children: [
      {
        component: Section,
        componentProps: { title: 'Плательщик' },
        children: [{ model: model.$.billingAddress, part: addressPart }],
      },
      {
        component: Section,
        componentProps: { title: 'Доставка' },
        children: [{ model: model.$.shippingAddress, part: addressPart }],
      },
    ],
  }),
  // Одни правила — две группы.
  validation: defineValidation<OrderForm>(({ model }) => {
    applyRules([model.$.billingAddress, model.$.shippingAddress], addressRules);
  }),
  // Одно поведение — две группы.
  behavior: defineFormBehavior<OrderForm>(({ model }) => {
    apply([model.$.billingAddress, model.$.shippingAddress], addressBehavior);
  }),
});
```

:::tip Часть схемы — функция под-модели
Подформа, правила и поведение группы пишутся один раз над её типом и не знают, где стоят. Каждое
подключение привязывается к своей группе — копировать узлы и правила не нужно.
:::

Переиспользование работает и на меньшей гранулярности — например, список правил `Rule[]` — обычное
значение:

```typescript
import type { Rule } from '@reformer/core/validation';
import { required, minLength } from '@reformer/core/validators';

const textRules: Rule<string>[] = [required(), minLength(2)];

const addressTextRules = defineValidation<Address>(({ model }) => {
  validate(model.$.street, textRules); // тот же список — на любое строковое поле
  validate(model.$.city, textRules);
});
```

**Что даёт декомпозиция:**

- **DRY** — написал один раз, используешь везде.
- **Согласованность** — одни и те же правила во всех формах.
- **Поддерживаемость** — правка в одном месте.
- **Тестируемость** — каждую часть можно проверить изолированно.

Полные паттерны и best practices — в [Композиции](./composition).

### Тестируемость

Схему валидации можно проверять изолированно. `runValidation(model, rules)` собирает результат без
формы и без побочных эффектов — замечания лежат в `ValidationResult.issues` по ручке поля:

```typescript
import { createModel } from '@reformer/core';
import { defineValidation, runValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';

const personValidation = defineValidation<Person>(({ model }) => {
  validate(model.$.firstName, [required()]);
});

describe('валидация person', () => {
  it('требует firstName', async () => {
    const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

    const result = await runValidation(model, personValidation);

    expect(result.status).toBe('invalid');
    expect(result.issues.get(model.$.firstName)?.[0]?.code).toBe('required');
  });
});
```

:::tip Проверка вместе с нодами
Если нужно убедиться, что замечание доехало до ноды, соберите форму и вызовите проверку сборки:
`const { form, validate } = createForm({ initial, validation })`, затем `await validate()` и
`form.firstName.issues.value`.
:::

### Типобезопасность

Ручки модели (`model.$.<field>`) полностью типизированы, поэтому привязка несуществующего поля —
ошибка компиляции. Тип узла `FormSchemaNode` закрыт: опечатка в ключе узла тоже не скомпилируется.
Это работает и в схеме формы, и в схеме валидации:

```typescript
const personSchema = (model: FormModel<Person>): FormSchemaNode => ({
  children: [
    { model: model.$.firstName, component: Input }, // ✅ типизированная ручка
    // { model: model.$.middleName, component: Input }, // ❌ поля 'middleName' нет в модели
  ],
});

const personValidation = defineValidation<Person>(({ model }) => {
  validate(model.$.email, [required(), email()]); // ✅ email() ждёт string — тип поля проверяется
  // validate(model.$.email, [min(3)]);           // ❌ min() ждёт number, а email: string
});
```

## Из чего собирается форма

```
createForm({ initial | model, schema, validation, behavior, flow })
├── model: FormModel<T>          → источник истины для значений (или initial — модель из него)
├── schema: (model) => узел      → дерево: { model: model.$.x, component, componentProps }, children
├── validation                   → defineValidation(...) — правила; запуск: validate() / submit()
├── behavior: FormBehavior<T>    → defineFormBehavior(...) — реактивная логика
└── flow: { steps }              → поток шагов: правила каждого шага, next() / previous() / goTo()
```

Без сборки те же части соединяются вручную: `createFormFromModel({ model, schema: дерево, behavior })`
строит ноды, а правила прогоняет раннер `validateModel(model, rules)`.

## Дальше

- [Схема формы](./form-schema) — структура и конфигурация полей.
- [Схема валидации](./validation-schema) — правила корректности и их запуск.
- [Схема behavior](./behavior-schema) — реактивная логика.
- [Композиция](./composition) — переиспользование и декомпозиция.
