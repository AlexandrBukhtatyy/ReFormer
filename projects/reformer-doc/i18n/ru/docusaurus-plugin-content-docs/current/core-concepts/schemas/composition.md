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

- **layout** — builder-функции возвращают фрагменты узлов (`value` / `component` / `componentProps`),
  собираются в объект схемы формы;
- **валидация** — фрагменты `ValidationSchema<T>` собираются оператором `apply(...schemas)` или прямым
  вызовом над под-моделью;
- **behavior** — фрагменты `defineFormBehavior` собираются операторами `apply` / `applyEach`.

Layout **не несёт** `validators` — правила живут в отдельной схеме валидации (см.
[Схему валидации](./validation-schema)). Поэтому layout и валидацию компонуют независимо: вёрстку можно
менять хоть с сервера, правила остаются на месте.
:::

## Builder-функции

:::warning Всегда используйте builder-функции
Переиспользуемый фрагмент схемы — это **функция**, возвращающая свежий объект узлов, привязанный к
переданным сигналам модели. Не общий объект-литерал.
:::

```typescript
import type { FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

// ✅ Хорошо — builder возвращает свежий фрагмент, привязанный к сигналам под-модели.
export const addressNodes = (m: FormModel<Address>) => ({
  street: { value: m.$.street, component: Input },
  city: { value: m.$.city, component: Input },
});

// ❌ Плохо — общий объект-литерал: не привязан к модели, переиспользуется по ссылке.
export const addressNodesBad = {
  street: { value: '' },
  city: { value: '' },
};
```

## Переиспользуемые поля

Общие конфигурации полей — builder, принимающий сигнал поля (начальное значение живёт в модели). Builder
несёт **только layout** (`value` / `component` / `componentProps`); правил в узле нет — они переиспользуются
отдельно, в схеме валидации:

```typescript title="schemas/common-fields.ts"
import type { PathAwareSignal } from '@reformer/core';
import { Input, Checkbox } from '@reformer/ui-kit';

// Только вёрстка поля — никаких validators.
export const emailField = (value: PathAwareSignal<string>) => ({
  value,
  component: Input,
  componentProps: { type: 'email' },
});

export const phoneField = (value: PathAwareSignal<string>) => ({
  value,
  component: Input,
  componentProps: { type: 'tel' },
});

export const dateField = (value: PathAwareSignal<Date | null>) => ({
  value,
  component: Input,
  componentProps: { type: 'date' },
});

export const booleanField = (value: PathAwareSignal<boolean>) => ({
  value,
  component: Checkbox,
});
```

Правила для этих полей выносятся в переиспользуемые списки `Rule[]` — обычные значения (подробнее — ниже,
в разделе «Переиспользуемые наборы валидаторов»):

```typescript title="validation/common-rules.ts"
import type { Rule } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

// Переиспользуемый список правил — обычный массив.
export const emailRules: Rule<string>[] = [required(), email()];
```

**Использование:**

```typescript
import { createModel, createForm } from '@reformer/core';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';

type ProfileForm = {
  email: string;
  phone: string;
  birthDate: Date | null;
  newsletter: boolean;
};

// Значения по умолчанию (напр. newsletter: true) живут в модели, а не в builder поля.
const model = createModel<ProfileForm>({
  email: '',
  phone: '',
  birthDate: null,
  newsletter: true,
});

// Layout-схема — из builder'ов полей, без validators.
const schema = {
  email: emailField(model.$.email),
  phone: phoneField(model.$.phone),
  birthDate: dateField(model.$.birthDate),
  newsletter: booleanField(model.$.newsletter),
};

const form = createForm<ProfileForm>({ model, schema });

// Валидация — отдельная схема, переиспользует те же списки правил.
const profileValidation = defineValidationSchema<ProfileForm>(({ model }) => {
  validate(model.$.email, emailRules);
});

const ok = await validateModel(model, profileValidation);
```

## Переиспользуемые группы

Builder для типовых структур данных привязывает каждое поле к сигналам переданной под-модели:

```typescript title="schemas/address-schema.ts"
import type { FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
};

export const addressNodes = (m: FormModel<Address>) => ({
  street: { value: m.$.street, component: Input },
  city: { value: m.$.city, component: Input },
  state: { value: m.$.state, component: Input },
  zipCode: { value: m.$.zipCode, component: Input },
});
```

```typescript title="schemas/person-schema.ts"
import type { FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Person = {
  firstName: string;
  lastName: string;
  email: string;
};

export const personNodes = (m: FormModel<Person>) => ({
  firstName: { value: m.$.firstName, component: Input },
  lastName: { value: m.$.lastName, component: Input },
  email: { value: m.$.email, component: Input },
});
```

**Сборка схемы:**

```typescript
type UserForm = {
  person: Person;
  billingAddress: Address;
  shippingAddress: Address;
};

const model = createModel<UserForm>({
  person: { firstName: '', lastName: '', email: '' },
  billingAddress: { street: '', city: '', state: '', zipCode: '' },
  shippingAddress: { street: '', city: '', state: '', zipCode: '' },
});

// Каждый вызов builder возвращает свежий фрагмент, привязанный к своей под-модели.
const schema = {
  person: personNodes(model.person),
  billingAddress: addressNodes(model.billingAddress),
  shippingAddress: addressNodes(model.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Переиспользуемые наборы валидаторов

Правила живут в **отдельной** схеме валидации, а не в layout-узлах (узел не несёт `validators`; см.
[Схему валидации](./validation-schema)). Переиспользуемых единиц две: список правил `Rule[]` и целая
под-схема `ValidationSchema<T>`.

### Списки правил

Массив правил — обычное значение: выносится в `const` и раскрывается в операторе `validate`. Когда сообщение
зависит от контекста (label и т.п.) — используйте фабрику, возвращающую список:

```typescript title="validation/address-rules.ts"
import type { Rule } from '@reformer/core/validation';
import { required, pattern } from '@reformer/core/validators';

// Готовый список правил для индекса.
export const zipRules: Rule<string>[] = [
  required(),
  pattern(/^\d{5}(-\d{4})?$/, { message: 'Некорректный индекс' }),
];
```

```typescript title="validation/person-rules.ts"
import type { Rule } from '@reformer/core/validation';
import { required, minLength, maxLength } from '@reformer/core/validators';

// Фабрика: параметризуем сообщение, переиспользуем в разных полях.
export const nameRules = (label: string): Rule<string>[] => [
  required({ message: `${label} обязательно` }),
  minLength(2, { message: 'Минимум 2 символа' }),
  maxLength(50, { message: 'Максимум 50 символов' }),
];
```

### Под-схемы групп — прямой вызов

Под-схема группы (адрес, персона) — обычная `ValidationSchema<Group>`. Схема — это функция, поэтому её
переиспользуют **прямым вызовом** над под-моделью нужной группы (`{ model: model.<group> }`), а не через
layout:

```typescript title="validation/address-validation.ts"
import { validate, type ValidationSchema } from '@reformer/core/validation';
import { required } from '@reformer/core/validators';
import { zipRules } from './address-rules';
import type { Address } from '../schemas/address-schema';

export const addressValidation: ValidationSchema<Address> = ({ model }) => {
  validate(model.$.street, [required()]);
  validate(model.$.city, [required()]);
  validate(model.$.state, [required()]);
  validate(model.$.zipCode, zipRules);
};
```

```typescript title="validation/person-validation.ts"
import { validate, type ValidationSchema } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { nameRules } from './person-rules';
import type { Person } from '../schemas/person-schema';

export const personValidation: ValidationSchema<Person> = ({ model }) => {
  validate(model.$.firstName, nameRules('Имя'));
  validate(model.$.lastName, nameRules('Фамилия'));
  validate(model.$.email, [required(), email()]);
};
```

**Использование** — одну и ту же под-схему адреса применяем и к billing, и к shipping:

```typescript
import { defineValidationSchema, validateModel } from '@reformer/core/validation';
import { addressValidation } from './validation/address-validation';
import { personValidation } from './validation/person-validation';

// Каждый прямой вызов сужает scope на свою под-модель.
const userValidation = defineValidationSchema<UserForm>(({ model }) => {
  personValidation({ model: model.person });
  addressValidation({ model: model.billingAddress });
  addressValidation({ model: model.shippingAddress });
});

const ok = await validateModel(model, userValidation);
```

### Композиция под-схем — `apply`

Когда несколько под-схем работают над **одной и той же** моделью scope (например, форма разбита на
логические блоки одного типа), их собирают оператором `apply(...schemas)` из `@reformer/core/validation`.
Все переданные схемы должны быть `ValidationSchema<T>` одного типа `T` — это тот же scope, а не под-модель:

```typescript
import { validate, apply, defineValidationSchema } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import type { ValidationSchema } from '@reformer/core/validation';

// Два блока над одной моделью UserForm.
const contactValidation: ValidationSchema<UserForm> = ({ model }) => {
  validate(model.$.person.email, [required(), email()]);
};
const consentValidation: ValidationSchema<UserForm> = ({ model }) => {
  validate(model.$.person.firstName, [required()]);
};

// apply склеивает схемы одного scope в одну.
const fullValidation = defineValidationSchema<UserForm>(() =>
  apply(contactValidation, consentValidation)
);
```

:::info `apply` (тот же scope) vs прямой вызов (под-модель)
`apply(...schemas)` объединяет схемы **над одной моделью** — так собирают шаги wizard'а в полную форму
(`apply(...STEP_SCHEMAS)`). Под-схему **другого** типа (адрес внутри формы) нельзя передать в `apply` — её
применяют прямым вызовом с суженной моделью: `addressValidation({ model: model.billingAddress })`. Для
массивов — оператор `each(model.<array>, itemFn)` (см. [Схему валидации](./validation-schema)).
:::

## Переиспользуемые наборы behavior

Логику behavior выносят в функцию, принимающую сигналы под-модели, и вызывают по разу на под-модель
внутри `defineFormBehavior`:

```typescript title="behaviors/address-behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { FormModel } from '@reformer/core';
import type { Address } from '../schemas/address-schema';

// Переиспользуемый фрагмент behavior — вызывается по разу на адрес внутри defineFormBehavior.
export function addressBehaviors(m: FormModel<Address>) {
  // Автоформат индекса (идемпотентно: повторное форматирование — no-op).
  transformValue(m.$.zipCode, (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}
```

**Использование:**

```typescript
import { defineFormBehavior } from '@reformer/core/behaviors';
import { addressBehaviors } from './behaviors/address-behaviors';

const userBehavior = defineFormBehavior<UserForm>(({ model }) => {
  addressBehaviors(model.billingAddress);
  addressBehaviors(model.shippingAddress);
});

const form = createForm<UserForm>({ model, schema, behavior: userBehavior });
```

## Операторы `apply` и `applyEach`

Функция-обёртка выше (`addressBehaviors(model.billingAddress)`) инлайнит операторы. Когда переиспользуемый
фрагмент behavior удобнее оформить как **самостоятельную под-схему** `defineFormBehavior`, применяйте её
операторами композиции.

:::info Два оператора `apply` — разные модули, разные сигнатуры
`apply` есть и в валидации, и в поведении, но это **разные** операторы:

- **Валидация** — `apply(...schemas)` из `@reformer/core/validation`: композиция под-схем над **одной**
  моделью scope (см. раздел «Переиспользуемые наборы валидаторов» выше).
- **Поведение** — `apply(targets, subSchema)` из `@reformer/core/behaviors`: применяет **одну** под-схему к
  одной или нескольким группам (ниже).
  :::

### apply — под-схема на группе

`apply(targets, subSchema)` применяет под-схему behavior к одной или нескольким группам. Под-схема —
обычный `defineFormBehavior` над типом группы; её scope `model` — это под-модель группы:

```typescript
import { defineFormBehavior, apply, transformValue } from '@reformer/core/behaviors';

// Самостоятельная под-схема behavior для адреса.
const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  transformValue(model.$.zipCode, (value) => (value ?? '').trim());
});

const behavior = defineFormBehavior<UserForm>(({ model }) => {
  // Применяем одну под-схему сразу к обеим группам.
  apply([model.$.billingAddress, model.$.shippingAddress], addressBehavior);
});
```

### applyEach — per-item behavior массива

`applyEach(array, itemSchema)` применяет под-схему к **каждому** элементу динамического массива и
реагирует на добавление/удаление строк. Scope под-схемы — строка: `model` (под-модель строки,
`row.$.<field>`) и `form` (нода строки):

```typescript
import { defineFormBehavior, applyEach, compute } from '@reformer/core/behaviors';

type Item = { qty: number; price: number; lineTotal: number };
type CartForm = { items: Item[] };

const behavior = defineFormBehavior<CartForm>(({ model }) => {
  applyEach(
    model.$.items,
    defineFormBehavior<Item>(({ model: row }) => {
      // Считаем сумму строки для каждого элемента.
      compute(row.$.lineTotal, () => (row.qty ?? 0) * (row.price ?? 0));
    })
  );
});
```

:::info Value-операции и node-операции
Value-операции (`compute` / `copyFrom` / `transformValue` на `row.$.*`) в `applyEach` работают
всегда. Node-операции (`enableWhen` / `updateComponentProps` / `reset` через `form.*`) требуют, чтобы
массив был **материализован** в схеме формы узлом `{ array, item }` — иначе доступ к ноде строки
бросит понятную ошибку.
:::

## Полный модуль

Собирайте layout, валидацию и behavior в один модуль — три раздельные схемы под одной крышей:

```
modules/
└── contact-info/
    ├── schema.ts       # Тип + builder layout-схемы (без validators)
    ├── validation.ts   # Под-схема ValidationSchema
    ├── behaviors.ts    # Реактивная логика
    └── index.ts        # Публичные экспорты
```

```typescript title="modules/contact-info/schema.ts"
import type { FormModel } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';

export type ContactInfo = {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
};

// Только layout: value / component / componentProps. Правила — в validation.ts.
export const contactInfoNodes = (m: FormModel<ContactInfo>) => ({
  email: { value: m.$.email, component: Input },
  phone: { value: m.$.phone, component: Input },
  preferredContact: {
    value: m.$.preferredContact,
    component: Select,
    componentProps: {
      options: [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Телефон' },
      ],
    },
  },
});
```

```typescript title="modules/contact-info/validation.ts"
import { validate, type ValidationSchema } from '@reformer/core/validation';
import { required, email, pattern } from '@reformer/core/validators';
import type { ContactInfo } from './schema';

// Под-схема валидации группы — переиспользуется прямым вызовом над под-моделью.
export const contactInfoValidation: ValidationSchema<ContactInfo> = ({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.phone, [required(), pattern(/^\d{10}$/, { message: 'Нужно 10 цифр' })]);
};
```

```typescript title="modules/contact-info/behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { FormModel } from '@reformer/core';
import type { ContactInfo } from './schema';

export function contactInfoBehaviors(m: FormModel<ContactInfo>) {
  transformValue(m.$.phone, (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
}
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoNodes, type ContactInfo } from './schema';
export { contactInfoValidation } from './validation';
export { contactInfoBehaviors } from './behaviors';
```

**Использование** — все три схемы модуля подключаются по своим каналам:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior } from '@reformer/core/behaviors';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { Input } from '@reformer/ui-kit';
import { required } from '@reformer/core/validators';
import {
  contactInfoNodes,
  contactInfoValidation,
  contactInfoBehaviors,
  type ContactInfo,
} from './modules/contact-info';

type MyForm = {
  name: string;
  contactInfo: ContactInfo;
};

const model = createModel<MyForm>({
  name: '',
  contactInfo: { email: '', phone: '', preferredContact: 'email' },
});

// Layout: узлы без validators.
const schema = {
  name: { value: model.$.name, component: Input },
  contactInfo: contactInfoNodes(model.contactInfo),
};

// Behavior: createForm владеет lifecycle.
const behavior = defineFormBehavior<MyForm>(({ model }) => {
  contactInfoBehaviors(model.contactInfo);
});

const form = createForm<MyForm>({ model, schema, behavior });

// Валидация: под-схему модуля вызываем прямым вызовом над под-моделью, прогон — по требованию.
const myFormValidation = defineValidationSchema<MyForm>(({ model }) => {
  validate(model.$.name, [required()]);
  contactInfoValidation({ model: model.contactInfo });
});

const ok = await validateModel(model, myFormValidation);
```

## Конфигурируемые схемы

Builder может принимать опции и выбирать, какие поля выставлять. Layout и валидацию конфигурируют
параллельно — одна и та же опция управляет и узлом, и правилом:

```typescript title="schemas/configurable-person.ts"
import type { FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  middleName: string;
  phone: string;
};

type PersonSchemaOptions = {
  includeMiddleName?: boolean;
  includePhone?: boolean;
};

// Модель материализует все поля; builder выбирает, какие из них выставить. Только layout.
export function createPersonNodes(m: FormModel<Person>, options: PersonSchemaOptions = {}) {
  const nodes: Record<string, unknown> = {
    firstName: { value: m.$.firstName, component: Input },
    lastName: { value: m.$.lastName, component: Input },
    email: { value: m.$.email, component: Input },
  };

  if (options.includeMiddleName) {
    nodes.middleName = { value: m.$.middleName, component: Input };
  }

  if (options.includePhone) {
    nodes.phone = { value: m.$.phone, component: Input };
  }

  return nodes;
}
```

```typescript title="validation/configurable-person.ts"
import { validate, type ValidationSchema } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';

// Те же опции гейтят и правила: телефон проверяем, только если поле выставлено.
export function createPersonValidation(
  options: PersonSchemaOptions = {}
): ValidationSchema<Person> {
  return ({ model }) => {
    validate(model.$.firstName, [required()]);
    validate(model.$.lastName, [required()]);
    validate(model.$.email, [required(), email()]);

    if (options.includePhone) {
      validate(model.$.phone, [required()]);
    }
  };
}
```

**Использование:**

```typescript
// Модель обязана материализовать все поля, которые builder может выставить.
const model = createModel<Person>({
  firstName: '',
  lastName: '',
  email: '',
  middleName: '',
  phone: '',
});

// Базовый вариант — только три обязательных поля.
const basicSchema = createPersonNodes(model);
const basicValidation = createPersonValidation();

// Полный вариант — со всеми полями, и layout, и правила.
const detailedSchema = createPersonNodes(model, {
  includeMiddleName: true,
  includePhone: true,
});
const detailedValidation = createPersonValidation({ includePhone: true });
```

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
├── schemas/                  # Переиспользуемые layout-схемы (узлы)
│   ├── common-fields.ts
│   ├── address-schema.ts
│   └── person-schema.ts
│
├── validation/               # Переиспользуемые правила и под-схемы валидации
│   ├── common-rules.ts
│   ├── address-validation.ts
│   └── person-validation.ts
│
├── behaviors/                # Переиспользуемые behavior
│   ├── address-behaviors.ts
│   └── format-behaviors.ts
│
└── modules/                  # Готовые модули (layout + validation + behavior)
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validation.ts
    │   ├── behaviors.ts
    │   └── index.ts
    └── payment-info/
        └── ...
```

## Best practices

| Практика                             | Почему                                   |
| ------------------------------------ | ---------------------------------------- |
| Используйте builder-функции          | Нет общих ссылок на объекты              |
| Держите валидацию отдельным слоем    | Layout без правил, правила независимы    |
| Компонуйте `apply` / прямым вызовом  | `apply` — один scope, вызов — под-модель |
| Экспортируйте типы вместе со схемами | Лучше вывод типов                        |
| Собирайте связанные схемы в модуль   | Один импорт на модуль                    |
| Понятные имена                       | `personNodes`, а не `nodes1`             |
| Тестируйте схемы отдельно            | Проще отлаживать                         |

## Дальше

- [Структура проекта](../../patterns/project-structure) — организация файлов формы.
- [Схема валидации](./validation-schema) — операторы `validate` / `cross` / `each` / `apply` и раннер `validateModel`.
- [Схема behavior](./behavior-schema) — операторы `apply` / `applyEach` в контексте.
