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

## Builder-функции

:::warning Всегда используйте builder-функции
Переиспользуемый фрагмент схемы — это **функция**, возвращающая свежий объект узлов, привязанный к
переданным сигналам модели. Не общий объект-литерал.
:::

```typescript
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

// ✅ Хорошо — builder возвращает свежий фрагмент, привязанный к сигналам под-модели.
export const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input },
  city: { value: s.city, component: Input },
});

// ❌ Плохо — общий объект-литерал: не привязан к модели, переиспользуется по ссылке.
export const addressNodesBad = {
  street: { value: '' },
  city: { value: '' },
};
```

## Переиспользуемые поля

Общие конфигурации полей — builder, принимающий сигнал поля (начальное значение живёт в модели):

```typescript title="schemas/common-fields.ts"
import type { PathAwareSignal } from '@reformer/core';
import { Input, Checkbox } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';

export const emailField = (value: PathAwareSignal<string>) => ({
  value,
  component: Input,
  componentProps: { type: 'email' },
  validators: [required(), email()],
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

**Использование:**

```typescript
import { createModel, createForm } from '@reformer/core';

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

const schema = {
  email: emailField(model.$.email),
  phone: phoneField(model.$.phone),
  birthDate: dateField(model.$.birthDate),
  newsletter: booleanField(model.$.newsletter),
};

const form = createForm<ProfileForm>({ model, schema });
```

## Переиспользуемые группы

Builder для типовых структур данных привязывает каждое поле к сигналам переданной под-модели:

```typescript title="schemas/address-schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
};

export const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input },
  city: { value: s.city, component: Input },
  state: { value: s.state, component: Input },
  zipCode: { value: s.zipCode, component: Input },
});
```

```typescript title="schemas/person-schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Person = {
  firstName: string;
  lastName: string;
  email: string;
};

export const personNodes = (s: ModelSignals<Person>) => ({
  firstName: { value: s.firstName, component: Input },
  lastName: { value: s.lastName, component: Input },
  email: { value: s.email, component: Input },
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
  person: personNodes(model.$.person),
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Переиспользуемые наборы валидаторов

Выносите списки валидаторов в функции:

```typescript title="validators/address-validators.ts"
import { required, pattern } from '@reformer/core/validators';

// Переиспользуемые списки валидаторов — раскрываются в `validators` узла.
export const addressValidators = {
  street: () => [required()],
  city: () => [required()],
  state: () => [required()],
  zipCode: () => [required(), pattern(/^\d{5}(-\d{4})?$/, { message: 'Некорректный индекс' })],
};
```

```typescript title="validators/person-validators.ts"
import { required, email, minLength } from '@reformer/core/validators';

export const personValidators = {
  firstName: () => [required(), minLength(2)],
  lastName: () => [required()],
  email: () => [required(), email()],
};
```

**Использование:**

```typescript
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';
import { addressValidators } from './validators/address-validators';
import { personValidators } from './validators/person-validators';

// Вшиваем переиспользуемые списки валидаторов в builder.
const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input, validators: addressValidators.street() },
  city: { value: s.city, component: Input, validators: addressValidators.city() },
  state: { value: s.state, component: Input, validators: addressValidators.state() },
  zipCode: { value: s.zipCode, component: Input, validators: addressValidators.zipCode() },
});

const personNodes = (s: ModelSignals<Person>) => ({
  firstName: { value: s.firstName, component: Input, validators: personValidators.firstName() },
  lastName: { value: s.lastName, component: Input, validators: personValidators.lastName() },
  email: { value: s.email, component: Input, validators: personValidators.email() },
});

// Одни и те же списки валидаторов применяются к billing и shipping адресам.
const schema = {
  person: personNodes(model.$.person),
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Переиспользуемые наборы behavior

Логику behavior выносят в функцию, принимающую сигналы под-модели, и вызывают по разу на под-модель
внутри `defineFormBehavior`:

```typescript title="behaviors/address-behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { ModelSignals } from '@reformer/core';
import type { Address } from '../schemas/address-schema';

// Переиспользуемый фрагмент behavior — вызывается по разу на адрес внутри defineFormBehavior.
export function addressBehaviors(s: ModelSignals<Address>) {
  // Автоформат индекса (идемпотентно: повторное форматирование — no-op).
  transformValue(s.zipCode, (value) => {
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
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});

const form = createForm<UserForm>({ model, schema, behavior: userBehavior });
```

## Операторы `apply` и `applyEach`

Функция-обёртка выше (`addressBehaviors(model.$.billingAddress)`) инлайнит операторы. Когда переиспользуемый
фрагмент удобнее оформить как **самостоятельную под-схему** `defineFormBehavior`, применяйте её
операторами композиции.

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

Собирайте схему, валидацию и behavior в один модуль:

```
modules/
└── contact-info/
    ├── schema.ts       # Тип + builder схемы
    ├── validators.ts   # Переиспользуемые списки валидаторов
    ├── behaviors.ts    # Реактивная логика
    └── index.ts        # Публичные экспорты
```

```typescript title="modules/contact-info/schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';
import { contactInfoValidators } from './validators';

export type ContactInfo = {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
};

export const contactInfoNodes = (s: ModelSignals<ContactInfo>) => ({
  email: { value: s.email, component: Input, validators: contactInfoValidators.email() },
  phone: { value: s.phone, component: Input, validators: contactInfoValidators.phone() },
  preferredContact: {
    value: s.preferredContact,
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

```typescript title="modules/contact-info/validators.ts"
import { required, email, pattern } from '@reformer/core/validators';

export const contactInfoValidators = {
  email: () => [required(), email()],
  phone: () => [required(), pattern(/^\d{10}$/, { message: 'Нужно 10 цифр' })],
};
```

```typescript title="modules/contact-info/behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { ModelSignals } from '@reformer/core';
import type { ContactInfo } from './schema';

export function contactInfoBehaviors(s: ModelSignals<ContactInfo>) {
  transformValue(s.phone, (value) => {
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
export { contactInfoValidators } from './validators';
export { contactInfoBehaviors } from './behaviors';
```

**Использование:**

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';
import { required } from '@reformer/core/validators';
import { contactInfoNodes, contactInfoBehaviors, type ContactInfo } from './modules/contact-info';

type MyForm = {
  name: string;
  contactInfo: ContactInfo;
};

const model = createModel<MyForm>({
  name: '',
  contactInfo: { email: '', phone: '', preferredContact: 'email' },
});

const schema = {
  name: { value: model.$.name, component: Input, validators: [required()] },
  contactInfo: contactInfoNodes(model.$.contactInfo),
};

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  contactInfoBehaviors(model.$.contactInfo);
});

const form = createForm<MyForm>({ model, schema, behavior });
```

## Конфигурируемые схемы

Builder может принимать опции и выбирать, какие поля выставлять:

```typescript title="schemas/configurable-person.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';

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

// Модель материализует все поля; builder выбирает, какие из них выставить.
export function createPersonNodes(s: ModelSignals<Person>, options: PersonSchemaOptions = {}) {
  const nodes: Record<string, unknown> = {
    firstName: { value: s.firstName, component: Input, validators: [required()] },
    lastName: { value: s.lastName, component: Input, validators: [required()] },
    email: { value: s.email, component: Input, validators: [required(), email()] },
  };

  if (options.includeMiddleName) {
    nodes.middleName = { value: s.middleName, component: Input };
  }

  if (options.includePhone) {
    nodes.phone = { value: s.phone, component: Input };
  }

  return nodes;
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
const basicSchema = createPersonNodes(model.$);

// Полный вариант — со всеми полями.
const detailedSchema = createPersonNodes(model.$, {
  includeMiddleName: true,
  includePhone: true,
});
```

## Рекомендуемая структура папок

:::note Переиспользование на уровне приложения, а не разметка одной формы
Этот layout — про **схемы, переиспользуемые между многими формами**: каталоги `schemas/` /
`validators/` / `behaviors/` ниже — общие строительные блоки, а не файлы одной формы. Как устроены
файлы отдельной формы — см. [Структуру проекта](../../patterns/project-structure).
:::

```
src/
├── forms/                    # Экземпляры форм
│   ├── user-form.ts
│   └── order-form.ts
│
├── schemas/                  # Переиспользуемые схемы
│   ├── common-fields.ts
│   ├── address-schema.ts
│   └── person-schema.ts
│
├── validators/               # Переиспользуемые валидаторы
│   ├── address-validators.ts
│   └── person-validators.ts
│
├── behaviors/                # Переиспользуемые behavior
│   ├── address-behaviors.ts
│   └── format-behaviors.ts
│
└── modules/                  # Готовые модули
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validators.ts
    │   ├── behaviors.ts
    │   └── index.ts
    └── payment-info/
        └── ...
```

## Best practices

| Практика                             | Почему                       |
| ------------------------------------ | ---------------------------- |
| Используйте builder-функции          | Нет общих ссылок на объекты  |
| Экспортируйте типы вместе со схемами | Лучше вывод типов            |
| Собирайте связанные схемы в модуль   | Один импорт на модуль        |
| Понятные имена                       | `personNodes`, а не `nodes1` |
| Тестируйте схемы отдельно            | Проще отлаживать             |

## Дальше

- [Структура проекта](../../patterns/project-structure) — организация файлов формы.
- [Схема behavior](./behavior-schema) — операторы `apply` / `applyEach` в контексте.
