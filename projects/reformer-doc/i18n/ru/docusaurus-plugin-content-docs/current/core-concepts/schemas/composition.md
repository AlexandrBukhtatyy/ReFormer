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
Используйте функции, возвращающие схемы, а не объекты напрямую.
:::

```typescript
// ✅ Правильно — фабричная функция (новый объект каждый раз)
export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
});

// ❌ Неправильно — общая ссылка (формы разделяют один объект)
export const addressSchema = {
  street: { value: '' },
  city: { value: '' },
};
```

## Переиспользуемые схемы полей

Создавайте общие конфигурации полей:

```typescript title="schemas/common-fields.ts"
import { FieldConfig } from 'reformer';

export const emailField = (): FieldConfig<string> => ({
  value: '',
});

export const phoneField = (): FieldConfig<string> => ({
  value: '',
});

export const dateField = (): FieldConfig<Date | null> => ({
  value: null,
});

export const booleanField = (defaultValue = false): FieldConfig<boolean> => ({
  value: defaultValue,
});
```

**Использование:**

```typescript
const form = new GroupNode({
  form: {
    email: emailField(),
    phone: phoneField(),
    birthDate: dateField(),
    newsletter: booleanField(true),
  },
});
```

## Переиспользуемые схемы групп

Создавайте схемы для общих структур данных:

```typescript title="schemas/address-schema.ts"
import { FormSchema } from 'reformer';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
  state: { value: '' },
  zipCode: { value: '' },
});
```

```typescript title="schemas/person-schema.ts"
import { FormSchema } from 'reformer';

export interface Person {
  firstName: string;
  lastName: string;
  email: string;
}

export const personSchema = (): FormSchema<Person> => ({
  firstName: { value: '' },
  lastName: { value: '' },
  email: { value: '' },
});
```

**Композиция схем:**

```typescript
interface UserForm {
  person: Person;
  billingAddress: Address;
  shippingAddress: Address;
}

const form = new GroupNode<UserForm>({
  form: {
    person: personSchema(),
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
});
```

## Переиспользуемые наборы валидации

Извлекайте логику валидации в функции:

```typescript title="validators/address-validators.ts"
import { FieldPath } from 'reformer';
import { required, pattern } from 'reformer/validators';
import { Address } from '../schemas/address-schema';

export function validateAddress(path: FieldPath<Address>) {
  required(path.street);
  required(path.city);
  required(path.state);
  required(path.zipCode);
  pattern(path.zipCode, /^\d{5}(-\d{4})?$/, 'Некорректный почтовый индекс');
}
```

```typescript title="validators/person-validators.ts"
import { FieldPath } from 'reformer';
import { required, email, minLength } from 'reformer/validators';
import { Person } from '../schemas/person-schema';

export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  minLength(path.firstName, 2);
  required(path.lastName);
  required(path.email);
  email(path.email);
}
```

**Использование:**

```typescript
const form = new GroupNode<UserForm>({
  form: {
    person: personSchema(),
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
  validation: (path) => {
    validatePerson(path.person);
    validateAddress(path.billingAddress);
    validateAddress(path.shippingAddress);
  },
});
```

## Переиспользуемые наборы поведений

Извлекайте логику поведений в функции:

```typescript title="behaviors/address-behaviors.ts"
import { FieldPath } from 'reformer';
import { transformValue } from 'reformer/behaviors';
import { Address } from '../schemas/address-schema';

export function addressBehaviors(path: FieldPath<Address>) {
  // Автоформатирование почтового индекса
  transformValue(path.zipCode, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}
```

**Использование:**

```typescript
const form = new GroupNode<UserForm>({
  form: {
    person: personSchema(),
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
  behavior: (path) => {
    addressBehaviors(path.billingAddress);
    addressBehaviors(path.shippingAddress);
  },
});
```

## Паттерн полного модуля

Объединяйте схему, валидацию и поведения вместе:

```
modules/
└── contact-info/
    ├── schema.ts       # Тип + схема формы
    ├── validators.ts   # Правила валидации
    ├── behaviors.ts    # Реактивная логика
    └── index.ts        # Публичные экспорты
```

```typescript title="modules/contact-info/schema.ts"
import { FormSchema } from 'reformer';

export interface ContactInfo {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
}

export const contactInfoSchema = (): FormSchema<ContactInfo> => ({
  email: { value: '' },
  phone: { value: '' },
  preferredContact: { value: 'email' },
});
```

```typescript title="modules/contact-info/validators.ts"
import { FieldPath } from 'reformer';
import { required, email, pattern } from 'reformer/validators';
import { ContactInfo } from './schema';

export function validateContactInfo(path: FieldPath<ContactInfo>) {
  required(path.email);
  email(path.email);
  required(path.phone);
  pattern(path.phone, /^\d{10}$/, 'Должно быть 10 цифр');
}
```

```typescript title="modules/contact-info/behaviors.ts"
import { FieldPath } from 'reformer';
import { transformValue } from 'reformer/behaviors';
import { ContactInfo } from './schema';

export function contactInfoBehaviors(path: FieldPath<ContactInfo>) {
  transformValue(path.phone, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
}
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoSchema, type ContactInfo } from './schema';
export { validateContactInfo } from './validators';
export { contactInfoBehaviors } from './behaviors';
```

**Использование:**

```typescript
import {
  contactInfoSchema,
  validateContactInfo,
  contactInfoBehaviors,
  type ContactInfo,
} from './modules/contact-info';

interface MyForm {
  name: string;
  contactInfo: ContactInfo;
}

const form = new GroupNode<MyForm>({
  form: {
    name: { value: '' },
    contactInfo: contactInfoSchema(),
  },
  validation: (path) => {
    required(path.name);
    validateContactInfo(path.contactInfo);
  },
  behavior: (path) => {
    contactInfoBehaviors(path.contactInfo);
  },
});
```

## Конфигурируемые схемы

Создавайте фабрики схем с опциями:

```typescript title="schemas/configurable-person.ts"
interface PersonSchemaOptions {
  includeMiddleName?: boolean;
  includePhone?: boolean;
}

export function createPersonSchema(
  options: PersonSchemaOptions = {}
): FormSchema<Person> {
  const schema: FormSchema<Person> = {
    firstName: { value: '' },
    lastName: { value: '' },
    email: { value: '' },
  };

  if (options.includeMiddleName) {
    schema.middleName = { value: '' };
  }

  if (options.includePhone) {
    schema.phone = { value: '' };
  }

  return schema;
}
```

**Использование:**

```typescript
// Базовая персона
const simple = createPersonSchema();

// Персона со всеми полями
const detailed = createPersonSchema({
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

| Практика | Почему |
|----------|--------|
| Используйте фабричные функции | Избежание общих ссылок |
| Экспортируйте типы со схемами | Лучший вывод типов |
| Объединяйте связанные схемы | Один импорт для модуля |
| Используйте описательные имена | `validatePerson` вместо `validate1` |
| Тестируйте схемы отдельно | Упрощение отладки |

## Следующие шаги

- [Структура проекта](/docs/patterns/project-structure) — Советы по организации
