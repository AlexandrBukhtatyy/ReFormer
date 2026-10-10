---
sidebar_position: 5
---

# Композиция схем

Раскладывайте схемы на части и переиспользуйте их по всему приложению.

## Зачем композиция?

- **Без дублирования** — описал схему один раз, используешь везде.
- **Согласованность** — одни и те же правила во всех формах.
- **Поддерживаемость** — правка в одном месте.
- **Тестируемость** — каждую часть можно проверить изолированно.

:::info Три независимых оси композиции
Форма собирается из трёх **раздельных** схем, и каждая композируется по-своему:

- **разметка** — функции, возвращающие узлы (`model` / `component` / `componentProps`); часть схемы
  группы подключается узлом-подформой `{ model: model.$.<группа>, part }`, строка массива — `item`;
- **валидация** — схемы `ValidationDefinition<T>` подключаются к группе оператором
  `apply(model.$.<группа>, rules)`, к строкам массива — `applyEach`, а над одной моделью собираются
  `apply(...schemas)`;
- **behavior** — схемы `defineFormBehavior` подключаются операторами `apply` / `applyEach`.

Разметка **не несёт** правил — они живут в отдельной схеме валидации (см.
[Схему валидации](./validation-schema)). Поэтому разметку и валидацию компонуют независимо: вёрстку
можно менять хоть с сервера, правила остаются на месте.
:::

## Функции, а не общие объекты

:::warning Переиспользуемый фрагмент разметки — функция
Фрагмент схемы держит ручки модели, поэтому переиспользуемый фрагмент — это **функция**, которая
принимает ручку (или под-модель) и возвращает свежий узел. Общий объект-литерал привязан к одной
модели и делится по ссылке.
:::

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

// ✅ Хорошо — функция под-модели: каждый вызов привязан к своей группе.
export const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: m.$.street, component: Input },
    { model: m.$.city, component: Input },
  ],
});

// ❌ Плохо — общий объект: ручки одной конкретной модели, переиспользуется по ссылке.
export const addressNodesBad = {
  children: [{ model: someModel.$.street, component: Input }],
};
```

## Переиспользуемые поля

Общие конфигурации полей — функция, принимающая ручку поля (начальное значение живёт в модели).
Она несёт **только разметку** (`model` / `component` / `componentProps`); правил в узле нет — они
переиспользуются отдельно, в схеме валидации:

```typescript title="schemas/common-fields.ts"
import type { FormSchemaNode, PathAwareSignal } from '@reformer/core';
import { Input, CheckboxWithLabel } from '@reformer/ui-kit';

// Только вёрстка поля — никаких правил.
export const emailField = (handle: PathAwareSignal<string>): FormSchemaNode => ({
  model: handle,
  component: Input,
  componentProps: { type: 'email' },
});

export const phoneField = (handle: PathAwareSignal<string>): FormSchemaNode => ({
  model: handle,
  component: Input,
  componentProps: { type: 'tel' },
});

export const booleanField = (handle: PathAwareSignal<boolean>): FormSchemaNode => ({
  model: handle,
  component: CheckboxWithLabel,
});
```

Правила для этих полей выносятся в переиспользуемые списки `Rule[]` — обычные значения (подробнее —
ниже, в разделе «Переиспользуемые наборы валидаторов»):

```typescript title="validation/common-rules.ts"
import type { Rule } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

export const emailRules: Rule<string>[] = [required(), email()];
```

**Использование:**

```typescript
import { createForm } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';

type ProfileForm = { email: string; phone: string; newsletter: boolean };

const profileValidation = defineValidation<ProfileForm>(({ model }) => {
  validate(model.$.email, emailRules);
});

const profile = createForm<ProfileForm>({
  // Значения по умолчанию (напр. newsletter: true) живут в модели, а не в функции поля.
  initial: { email: '', phone: '', newsletter: true },
  schema: (model) => ({
    children: [
      emailField(model.$.email),
      phoneField(model.$.phone),
      booleanField(model.$.newsletter),
    ],
  }),
  validation: profileValidation,
});
```

## Переиспользуемые группы — подформы

Разметку типовой структуры данных пишут **частью схемы** над под-моделью группы. Узел
`{ model: model.$.<группа>, part }` подключает часть к группе; привязки внутри части идут через `$`
полученной под-модели:

```typescript title="schemas/address-schema.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Address = { street: string; city: string; state: string; zipCode: string };

export const addressPart = (m: FormModel<Address>): FormSchemaNode => ({
  children: [
    { model: m.$.street, component: Input, componentProps: { label: 'Улица' } },
    { model: m.$.city, component: Input, componentProps: { label: 'Город' } },
    { model: m.$.state, component: Input, componentProps: { label: 'Регион' } },
    { model: m.$.zipCode, component: Input, componentProps: { label: 'Индекс' } },
  ],
});
```

```typescript title="schemas/person-schema.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Person = { firstName: string; lastName: string; email: string };

export const personPart = (m: FormModel<Person>): FormSchemaNode => ({
  children: [
    { model: m.$.firstName, component: Input, componentProps: { label: 'Имя' } },
    { model: m.$.lastName, component: Input, componentProps: { label: 'Фамилия' } },
    { model: m.$.email, component: Input, componentProps: { label: 'Email' } },
  ],
});
```

**Сборка схемы:**

```typescript
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Section } from '@reformer/ui-kit';

type UserForm = { person: Person; billingAddress: Address; shippingAddress: Address };

// Одна часть — сколько угодно групп той же формы данных.
const userSchema = (model: FormModel<UserForm>): FormSchemaNode => ({
  children: [
    { model: model.$.person, part: personPart },
    {
      component: Section,
      componentProps: { title: 'Адрес плательщика' },
      children: [{ model: model.$.billingAddress, part: addressPart }],
    },
    {
      component: Section,
      componentProps: { title: 'Адрес доставки' },
      children: [{ model: model.$.shippingAddress, part: addressPart }],
    },
  ],
});
```

У каждой подформы своя область: `selector` внутри части не пересекается с корнем и с другими
подключениями той же части.

## Переиспользуемые наборы валидаторов

Правила живут в **отдельной** схеме валидации, а не в узлах разметки (см.
[Схему валидации](./validation-schema)). Переиспользуемых единиц две: список правил `Rule[]` и целая
схема `ValidationDefinition<T>`.

### Списки правил

Массив правил — обычное значение: выносится в `const` и раскрывается в операторе `validate`. Когда
текст замечания должен отличаться от поля к полю — передайте свой `code` (а текст положите в словарь
`defineIssueMessages`):

```typescript title="validation/address-rules.ts"
import type { Rule } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';

export const zipRules: Rule<string>[] = [
  required(),
  pattern(/^\d{5}(-\d{4})?$/, { code: 'zipCode.pattern' }),
];
```

```typescript title="validation/person-rules.ts"
import type { Rule } from '@reformer/core/validation';
import { required, minLength, maxLength } from '@reformer/core/validators';

// Фабрика: код замечания — по имени поля, текст — в словаре формы.
export const nameRules = (field: string): Rule<string>[] => [
  required({ code: `${field}.required` }),
  minLength(2, { code: `${field}.minLength` }),
  maxLength(50, { code: `${field}.maxLength` }),
];
```

### Схемы групп — `apply`

Схема группы (адрес, персона) — обычная `ValidationDefinition<Group>`. К группе модели её
подключает оператор `apply(model.$.<группа>, rules)` — к одной группе или к нескольким сразу; схема
запускается в области группы (`model` — под-модель, `cross` получает снимок группы):

```typescript title="validation/address-validation.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { zipRules } from './address-rules';
import type { Address } from '../schemas/address-schema';

export const addressValidation = defineValidation<Address>(({ model }) => {
  validate(model.$.street, [required()]);
  validate(model.$.city, [required()]);
  validate(model.$.state, [required()]);
  validate(model.$.zipCode, zipRules);
});
```

```typescript title="validation/person-validation.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { nameRules } from './person-rules';
import type { Person } from '../schemas/person-schema';

export const personValidation = defineValidation<Person>(({ model }) => {
  validate(model.$.firstName, nameRules('firstName'));
  validate(model.$.lastName, nameRules('lastName'));
  validate(model.$.email, [required(), email()]);
});
```

**Использование** — одну и ту же схему адреса применяем и к billing, и к shipping:

```typescript
import { apply, defineValidation } from '@reformer/core/validation';
import { addressValidation } from './validation/address-validation';
import { personValidation } from './validation/person-validation';

export const userValidation = defineValidation<UserForm>(({ model }) => {
  apply(model.$.person, personValidation);
  apply([model.$.billingAddress, model.$.shippingAddress], addressValidation);
});
```

### Композиция схем над одной моделью — `apply(...schemas)`

Когда несколько схем работают над **одной и той же** моделью (форма разбита на логические блоки),
их собирают тем же оператором `apply`, передав только схемы. Все они должны быть
`ValidationDefinition<T>` одного типа `T`:

```typescript
import { validate, apply, defineValidation } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

const contactValidation = defineValidation<UserForm>(({ model }) => {
  validate(model.$.person.email, [required(), email()]);
});
const consentValidation = defineValidation<UserForm>(({ model }) => {
  validate(model.$.person.firstName, [required()]);
});

// apply склеивает схемы одной модели в одну.
const fullValidation = defineValidation<UserForm>(() =>
  apply(contactValidation, consentValidation)
);
```

:::info Два вида `apply` в валидации
`apply(...schemas)` объединяет схемы **над одной моделью**. `apply(model.$.<группа>, rules)`
запускает схему **другого** типа в области группы. Для строк массива под-форм —
`applyEach(model.$.<массив>, rowRules)`. Правила шагов пошаговой формы собирать вручную не нужно:
сборка `createForm({ flow })` сама объединяет правила шагов и `extras`.
:::

## Переиспользуемые наборы behavior

Логику behavior группы оформляют самостоятельной схемой `defineFormBehavior` над типом группы:

```typescript title="behaviors/address-behavior.ts"
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import type { Address } from '../schemas/address-schema';

export const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  // Автоформат индекса (идемпотентно: повторное форматирование — no-op).
  transformValue(model.$.zipCode, (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
});
```

## Операторы `apply` и `applyEach`

:::info `apply` валидации и `apply` поведения — разные операторы
`apply` есть и в `@reformer/core/validation`, и в `@reformer/core/behaviors`, и подключают они
разные схемы: правила и поведение соответственно. Сигнатура подключения к группе у них общая —
ручка группы (или список ручек) и схема. Если оба нужны в одном файле, переименуйте один при
импорте: `import { apply as applyRules } from '@reformer/core/validation'`.
:::

### apply — под-схема на группе

`apply(targets, subSchema)` применяет под-схему behavior к одной или нескольким группам. Её область
`model` — под-модель группы, `form` — нода группы, `schema` — узлы подформы:

```typescript
import { defineFormBehavior, apply } from '@reformer/core/behaviors';
import { addressBehavior } from './behaviors/address-behavior';

const userBehavior = defineFormBehavior<UserForm>(({ model }) => {
  // Одна под-схема сразу к обеим группам.
  apply([model.$.billingAddress, model.$.shippingAddress], addressBehavior);
});
```

### applyEach — per-item behavior массива

`applyEach(array, itemSchema)` применяет под-схему к **каждой** строке динамического массива и
реагирует на добавление/удаление строк. Область под-схемы — строка: `model` (под-модель строки,
`row.$.<field>`) и `form` (нода строки):

```typescript
import { defineFormBehavior, applyEach, compute } from '@reformer/core/behaviors';

type Item = { qty: number; price: number; lineTotal: number };
type CartForm = { items: Item[] };

const behavior = defineFormBehavior<CartForm>(({ model }) => {
  applyEach(
    model.$.items,
    defineFormBehavior<Item>(({ model: row }) => {
      // Сумма строки — для каждого элемента.
      compute(row.$.lineTotal, () => (row.qty ?? 0) * (row.price ?? 0));
    })
  );
});
```

:::info Value-операции и node-операции
Value-операции (`compute` / `copyFrom` / `transformValue` на `row.$.*`) в `applyEach` работают
всегда. Node-операции (`enableWhen` / `updateComponentProps` / `reset` через `form.*`) требуют, чтобы
массив был **материализован** в схеме формы узлом `{ model: model.$.items, item }` — иначе доступ к
ноде строки бросит понятную ошибку.
:::

## Полный модуль

Собирайте разметку, валидацию и behavior в один модуль — три раздельные схемы под одной крышей:

```
modules/
└── contact-info/
    ├── schema.ts       # Тип + часть схемы (без правил)
    ├── validation.ts   # Схема валидации группы
    ├── behavior.ts     # Реактивная логика
    └── index.ts        # Публичные экспорты
```

```typescript title="modules/contact-info/schema.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input, SelectAsync } from '@reformer/ui-kit';

export type ContactInfo = {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
};

// Только разметка: model / component / componentProps. Правила — в validation.ts.
export const contactInfoPart = (m: FormModel<ContactInfo>): FormSchemaNode => ({
  children: [
    { model: m.$.email, component: Input, componentProps: { label: 'Email' } },
    { model: m.$.phone, component: Input, componentProps: { label: 'Телефон' } },
    {
      model: m.$.preferredContact,
      component: SelectAsync,
      componentProps: {
        label: 'Способ связи',
        options: [
          { value: 'email', label: 'Email' },
          { value: 'phone', label: 'Телефон' },
        ],
      },
    },
  ],
});
```

```typescript title="modules/contact-info/validation.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, pattern } from '@reformer/core/validators';
import type { ContactInfo } from './schema';

export const contactInfoValidation = defineValidation<ContactInfo>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.phone, [required(), pattern(/^\d{10}$/, { code: 'phone.pattern' })]);
});
```

```typescript title="modules/contact-info/behavior.ts"
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';
import type { ContactInfo } from './schema';

export const contactInfoBehavior = defineFormBehavior<ContactInfo>(({ model }) => {
  transformValue(model.$.phone, (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
});
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoPart, type ContactInfo } from './schema';
export { contactInfoValidation } from './validation';
export { contactInfoBehavior } from './behavior';
```

**Использование** — все три схемы модуля подключаются к одной группе, каждая по своему каналу:

```typescript
import { createForm } from '@reformer/core';
import { apply, defineFormBehavior } from '@reformer/core/behaviors';
import { apply as applyRules, defineValidation, validate } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';
import {
  contactInfoPart,
  contactInfoValidation,
  contactInfoBehavior,
  type ContactInfo,
} from './modules/contact-info';

type MyForm = { name: string; contactInfo: ContactInfo };

const myForm = createForm<MyForm>({
  initial: { name: '', contactInfo: { email: '', phone: '', preferredContact: 'email' } },
  // Разметка: часть модуля — подформой.
  schema: (model) => ({
    children: [
      { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
      { model: model.$.contactInfo, part: contactInfoPart },
    ],
  }),
  // Валидация: схема модуля — в области группы.
  validation: defineValidation<MyForm>(({ model }) => {
    validate(model.$.name, [required()]);
    applyRules(model.$.contactInfo, contactInfoValidation);
  }),
  // Behavior: под-схема модуля — на группе.
  behavior: defineFormBehavior<MyForm>(({ model }) => {
    apply(model.$.contactInfo, contactInfoBehavior);
  }),
});

const outcome = await myForm.submit((values) => api.save(values));
```

## Конфигурируемые схемы

Функция схемы может принимать опции и выбирать, какие поля выставлять. Разметку и валидацию
конфигурируют параллельно — одна и та же опция управляет и узлом, и правилом:

```typescript title="schemas/configurable-person.ts"
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  middleName: string;
  phone: string;
};

type PersonSchemaOptions = { includeMiddleName?: boolean; includePhone?: boolean };

// Модель материализует все поля; часть схемы выбирает, какие из них выставить. Только разметка.
export const createPersonPart =
  (options: PersonSchemaOptions = {}) =>
  (m: FormModel<Person>): FormSchemaNode => ({
    children: [
      { model: m.$.firstName, component: Input },
      { model: m.$.lastName, component: Input },
      ...(options.includeMiddleName ? [{ model: m.$.middleName, component: Input }] : []),
      { model: m.$.email, component: Input },
      ...(options.includePhone ? [{ model: m.$.phone, component: Input }] : []),
    ],
  });
```

Узел по условию вставляется распространением массива прямо в `children` — порядок полей
сохраняется.

```typescript title="validation/configurable-person.ts"
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

// Те же опции гейтят и правила: телефон проверяем, только если поле выставлено.
export const createPersonValidation = (options: PersonSchemaOptions = {}) =>
  defineValidation<Person>(({ model }) => {
    validate(model.$.firstName, [required()]);
    validate(model.$.lastName, [required()]);
    validate(model.$.email, [required(), email()]);
    if (options.includePhone) {
      validate(model.$.phone, [required()]);
    }
  });
```

**Использование:**

```typescript
// Базовый вариант — только обязательные поля.
const basicPart = createPersonPart();
const basicValidation = createPersonValidation();

// Полный вариант — со всеми полями, и разметка, и правила.
const detailedPart = createPersonPart({ includeMiddleName: true, includePhone: true });
const detailedValidation = createPersonValidation({ includePhone: true });
```

:::warning Схему правил создавайте один раз
`createPersonValidation(...)` возвращает новую схему на каждый вызов. Вызывайте её на уровне модуля
и передавайте в сборку готовую константу: по идентичности схемы раннер отменяет устаревшие прогоны.
:::

## Рекомендуемая структура папок

:::note Переиспользование на уровне приложения, а не разметка одной формы
Этот layout — про **схемы, переиспользуемые между многими формами**: каталоги `schemas/` /
`validation/` / `behaviors/` ниже — общие строительные блоки, а не файлы одной формы. Как устроены
файлы отдельной формы — см. [Структуру проекта](../../patterns/project-structure).
:::

```
src/
├── forms/                    # Экземпляры форм
│   ├── user-form.ts
│   └── order-form.ts
│
├── schemas/                  # Переиспользуемые части схем (узлы)
│   ├── common-fields.ts
│   ├── address-schema.ts
│   └── person-schema.ts
│
├── validation/               # Переиспользуемые правила и схемы валидации
│   ├── common-rules.ts
│   ├── address-validation.ts
│   └── person-validation.ts
│
├── behaviors/                # Переиспользуемые behavior
│   ├── address-behavior.ts
│   └── format-behaviors.ts
│
└── modules/                  # Готовые модули (разметка + валидация + behavior)
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validation.ts
    │   ├── behavior.ts
    │   └── index.ts
    └── payment-info/
        └── ...
```

## Best practices

| Практика                                  | Почему                                         |
| ----------------------------------------- | ---------------------------------------------- |
| Пишите фрагменты функциями                | Нет общих ссылок на объекты и чужие ручки      |
| Держите валидацию отдельным слоем         | Разметка без правил, правила независимы        |
| Подключайте группу через `part` / `apply` | Одна схема группы — сколько угодно подключений |
| Экспортируйте типы вместе со схемами      | Лучше вывод типов                              |
| Собирайте связанные схемы в модуль        | Один импорт на модуль                          |
| Понятные имена                            | `addressPart`, а не `nodes1`                   |
| Тестируйте схемы отдельно                 | Проще отлаживать                               |

## Дальше

- [Структура проекта](../../patterns/project-structure) — организация файлов формы.
- [Схема валидации](./validation-schema) — операторы `validate` / `cross` / `apply` / `applyEach` и запуск проверки.
- [Схема behavior](./behavior-schema) — операторы `apply` / `applyEach` в контексте.
