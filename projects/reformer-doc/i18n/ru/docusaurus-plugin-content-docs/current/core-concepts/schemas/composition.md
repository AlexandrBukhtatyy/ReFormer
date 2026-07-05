---
sidebar_position: 5
---

# Композиция схем

Декомпозируйте и переиспользуйте схемы по всему приложению.

## Зачем композиция?

- **Избежание дублирования** — Пишите схемы один раз, используйте везде
- **Консистентность** — Одинаковые правила валидации во всех формах
- **Поддерживаемость** — Обновляйте в одном месте
- **Тестирование** — Тестируйте схемы изолированно

## Фабричные функции

:::warning Всегда используйте фабричные функции
Используйте функции, возвращающие фрагменты схемы, а не объекты напрямую.
:::

```typescript
// ✅ Правильно — билдер возвращает свежий фрагмент, привязанный к сигналам модели
export const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input },
  city: { value: s.city, component: Input },
});

// ❌ Неправильно — общий объектный литерал: не привязан к модели, переиспользуется по ссылке
export const addressNodes = {
  street: { value: '' },
  city: { value: '' },
};
```

## Переиспользуемые схемы полей

Создавайте общие конфигурации полей:

```typescript title="schemas/common-fields.ts"
import type { PathAwareSignal } from '@reformer/core';
import { Input, Checkbox } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';

// Билдеры полей принимают сигнал модели; начальное значение живёт в модели
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

// Значения по умолчанию (например newsletter: true) живут в модели, а не в билдере поля
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

## Переиспользуемые схемы групп

Создавайте схемы для общих структур данных:

```typescript title="schemas/address-schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
};

// Билдер привязывает каждое поле к сигналам переданной под-модели
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

**Композиция схем:**

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

// Каждый вызов билдера возвращает свежий фрагмент, привязанный к своей под-модели
const schema = {
  person: personNodes(model.$.person),
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Переиспользуемые наборы валидации

Извлекайте логику валидации в функции:

```typescript title="validators/address-validators.ts"
import { required, pattern } from '@reformer/core/validators';

// Переиспользуемые списки валидаторов — раскрываются в `validators` узла схемы
export const addressValidators = {
  street: () => [required()],
  city: () => [required()],
  state: () => [required()],
  zipCode: () => [
    required(),
    pattern(/^\d{5}(-\d{4})?$/, { message: 'Некорректный почтовый индекс' }),
  ],
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

// Встраиваем переиспользуемые списки валидаторов прямо в билдеры
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

// Одни и те же списки валидаторов применяются к адресу выставления счёта и доставки
const schema = {
  person: personNodes(model.$.person),
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Переиспользуемые наборы поведений

Извлекайте логику поведений в функции:

```typescript title="behaviors/address-behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { ModelSignals } from '@reformer/core';
import type { Address } from '../schemas/address-schema';

// Переиспользуемый фрагмент поведения — вызывается по разу на адрес внутри defineFormBehavior
export function addressBehaviors(s: ModelSignals<Address>) {
  // Автоформатирование почтового индекса (идемпотентно: повторное форматирование — no-op)
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

## Паттерн полного модуля

Объединяйте схему, валидацию и поведения вместе:

```
modules/
└── contact-info/
    ├── schema.ts       # Тип + билдер схемы
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
  phone: () => [required(), pattern(/^\d{10}$/, { message: 'Должно быть 10 цифр' })],
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

Создавайте фабрики схем с опциями:

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

// Модель материализует все поля; билдер выбирает, какие из них показать
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
// Модель обязана материализовать каждое поле, которое билдер может показать
const model = createModel<Person>({
  firstName: '',
  lastName: '',
  email: '',
  middleName: '',
  phone: '',
});

// Базовая персона — показываются только три обязательных поля
const basicSchema = createPersonNodes(model.$);

// Персона со всеми полями
const detailedSchema = createPersonNodes(model.$, {
  includeMiddleName: true,
  includePhone: true,
});
```

## Рекомендуемая структура папок

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
├── behaviors/                # Переиспользуемые поведения
│   ├── address-behaviors.ts
│   └── format-behaviors.ts
│
└── modules/                  # Полные модули
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validators.ts
    │   ├── behaviors.ts
    │   └── index.ts
    └── payment-info/
        └── ...
```

## Лучшие практики

| Практика                       | Почему                              |
| ------------------------------ | ----------------------------------- |
| Используйте фабричные функции  | Избежание общих ссылок              |
| Экспортируйте типы со схемами  | Лучший вывод типов                  |
| Объединяйте связанные схемы    | Один импорт для модуля              |
| Используйте описательные имена | `validatePerson` вместо `validate1` |
| Тестируйте схемы отдельно      | Упрощение отладки                   |

## Следующие шаги

- [Структура проекта](/docs/patterns/project-structure) — Советы по организации
