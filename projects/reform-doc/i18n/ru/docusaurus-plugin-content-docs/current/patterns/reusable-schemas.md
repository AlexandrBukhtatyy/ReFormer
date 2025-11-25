---
sidebar_position: 2
---

# Переиспользуемые Схемы

Создавайте переиспользуемые схемы форм, валидаторы и поведения для совместного использования в приложении.

## Зачем Переиспользовать Схемы?

Переиспользуемые схемы помогают:
- Избежать дублирования кода
- Поддерживать согласованность между формами
- Централизовать логику валидации
- Ускорить разработку
- Упростить тестирование

## Переиспользуемые Схемы Полей

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

export const numberField = (defaultValue = 0): FieldConfig<number> => ({
  value: defaultValue,
});
```

### Использование

```typescript
import { GroupNode } from 'reformer';
import { emailField, phoneField } from './schemas/common-fields';

const form = new GroupNode({
  form: {
    email: emailField(),
    phone: phoneField(),
  },
});
```

## Переиспользуемые Схемы Групп

Создавайте схемы для общих структур данных:

```typescript title="schemas/address-schema.ts"
import { FormSchema } from 'reformer';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
  state: { value: '' },
  zipCode: { value: '' },
  country: { value: 'RU' },
});
```

```typescript title="schemas/phone-schema.ts"
import { FormSchema } from 'reformer';

export interface Phone {
  type: 'mobile' | 'home' | 'work';
  number: string;
  extension?: string;
}

export const phoneSchema = (): FormSchema<Phone> => ({
  type: { value: 'mobile' },
  number: { value: '' },
  extension: { value: '' },
});
```

```typescript title="schemas/person-schema.ts"
import { FormSchema } from 'reformer';

export interface Person {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: Date | null;
}

export const personSchema = (): FormSchema<Person> => ({
  firstName: { value: '' },
  lastName: { value: '' },
  email: { value: '' },
  birthDate: { value: null },
});
```

### Композиция Схем

Комбинируйте схемы для создания сложных форм:

```typescript title="forms/user-form.ts"
import { GroupNode } from 'reformer';
import { personSchema, Person } from '../schemas/person-schema';
import { addressSchema, Address } from '../schemas/address-schema';
import { phoneSchema, Phone } from '../schemas/phone-schema';

interface UserForm {
  person: Person;
  address: Address;
  phones: Phone[];
}

export const createUserForm = () =>
  new GroupNode<UserForm>({
    form: {
      person: personSchema(),
      address: addressSchema(),
      phones: [phoneSchema()],
    },
  });
```

## Переиспользуемые Наборы Валидации

Создавайте наборы валидации для общих паттернов:

```typescript title="validators/address-validators.ts"
import { required, pattern } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { Address } from '../schemas/address-schema';

export function validateAddress(path: FieldPath<Address>) {
  required(path.street);
  required(path.city);
  required(path.state);
  required(path.zipCode);
  pattern(path.zipCode, /^\d{6}$/, 'Неверный почтовый индекс');
  required(path.country);
}
```

```typescript title="validators/person-validators.ts"
import { required, email, minLength } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { Person } from '../schemas/person-schema';

export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  minLength(path.firstName, 2);
  required(path.lastName);
  minLength(path.lastName, 2);
  required(path.email);
  email(path.email);
}
```

```typescript title="validators/phone-validators.ts"
import { required, pattern } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { Phone } from '../schemas/phone-schema';

export function validatePhone(path: FieldPath<Phone>) {
  required(path.type);
  required(path.number);
  pattern(path.number, /^\d{10}$/, 'Должно быть 10 цифр');
}
```

### Использование Наборов Валидации

```typescript
import { GroupNode } from 'reformer';
import { personSchema } from './schemas/person-schema';
import { addressSchema } from './schemas/address-schema';
import { validatePerson } from './validators/person-validators';
import { validateAddress } from './validators/address-validators';

const form = new GroupNode({
  form: {
    person: personSchema(),
    address: addressSchema(),
  },
  validation: (path) => {
    validatePerson(path.person);
    validateAddress(path.address);
  },
});
```

## Переиспользуемые Поведения

Создавайте наборы поведений для общих паттернов:

```typescript title="behaviors/address-behaviors.ts"
import { FieldPath, Behavior } from 'reformer';
import { Address } from '../schemas/address-schema';

/**
 * Автоформатирование почтового индекса при вводе
 */
export function addressBehaviors<T extends { address: Address }>(
  path: FieldPath<T>
): Behavior<T>[] {
  return [
    {
      key: 'formatZipCode',
      paths: [path.address.zipCode],
      run: (values, ctx) => {
        const zipCode = values[path.address.zipCode.__key];
        if (zipCode && /^\d{6}$/.test(zipCode)) {
          // Форматирование уже правильное для России
          ctx.form.address.zipCode.setValue(zipCode);
        }
      },
    },
  ];
}
```

```typescript title="behaviors/phone-behaviors.ts"
import { FieldPath, Behavior } from 'reformer';
import { Phone } from '../schemas/phone-schema';

/**
 * Автоформатирование номера телефона
 */
export function phoneBehaviors<T extends { phone: Phone }>(
  path: FieldPath<T>
): Behavior<T>[] {
  return [
    {
      key: 'formatPhone',
      paths: [path.phone.number],
      run: (values, ctx) => {
        const phone = values[path.phone.number.__key];
        if (phone) {
          // Удаление всех нецифровых символов
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 10) {
            // Форматирование как +7 (999) 123-45-67
            const formatted = `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`;
            ctx.form.phone.number.setValue(formatted);
          }
        }
      },
    },
  ];
}
```

### Использование Наборов Поведений

```typescript
import { GroupNode } from 'reformer';
import { addressSchema } from './schemas/address-schema';
import { phoneSchema } from './schemas/phone-schema';
import { addressBehaviors } from './behaviors/address-behaviors';
import { phoneBehaviors } from './behaviors/phone-behaviors';

const form = new GroupNode({
  form: {
    address: addressSchema(),
    phone: phoneSchema(),
  },
  behaviors: (path, { use }) => [
    ...addressBehaviors(path).map(use),
    ...phoneBehaviors(path).map(use),
  ],
});
```

## Полный Переиспользуемый Модуль Формы

Объедините схему, валидацию и поведения в полный модуль:

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
import { required, email, pattern } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { ContactInfo } from './schema';

export function validateContactInfo(path: FieldPath<ContactInfo>) {
  required(path.email);
  email(path.email);
  required(path.phone);
  pattern(path.phone, /^\d{10}$/, 'Должно быть 10 цифр');
  required(path.preferredContact);
}
```

```typescript title="modules/contact-info/behaviors.ts"
import { FieldPath, Behavior } from 'reformer';
import { ContactInfo } from './schema';

export function contactInfoBehaviors<T extends { contactInfo: ContactInfo }>(
  path: FieldPath<T>
): Behavior<T>[] {
  return [
    {
      key: 'formatPhone',
      paths: [path.contactInfo.phone],
      run: (values, ctx) => {
        const phone = values[path.contactInfo.phone.__key];
        if (phone) {
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 10) {
            ctx.form.contactInfo.phone.setValue(
              `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8)}`
            );
          }
        }
      },
    },
  ];
}
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoSchema, type ContactInfo } from './schema';
export { validateContactInfo } from './validators';
export { contactInfoBehaviors } from './behaviors';
```

### Использование Полного Модуля

```typescript
import { GroupNode } from 'reformer';
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
  behaviors: (path, { use }) => [
    ...contactInfoBehaviors(path).map(use),
  ],
});
```

## Паттерн Фабрики Схем

Создавайте фабрики схем для настраиваемого переиспользования:

```typescript title="schemas/configurable-person-schema.ts"
import { FormSchema } from 'reformer';

export interface Person {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface PersonSchemaOptions {
  includeMiddleName?: boolean;
  includePhone?: boolean;
  defaultCountryCode?: string;
}

export function createPersonSchema(
  options: PersonSchemaOptions = {}
): FormSchema<Person> {
  const {
    includeMiddleName = false,
    includePhone = false,
  } = options;

  const schema: FormSchema<Person> = {
    firstName: { value: '' },
    lastName: { value: '' },
    email: { value: '' },
  };

  if (includeMiddleName) {
    schema.middleName = { value: '' };
  }

  if (includePhone) {
    schema.phone = { value: '' };
  }

  return schema;
}
```

### Использование Фабрики Схем

```typescript
// Простая форма персоны
const simplePerson = createPersonSchema();

// Персона с отчеством и телефоном
const detailedPerson = createPersonSchema({
  includeMiddleName: true,
  includePhone: true,
});
```

## Организация Проекта

Рекомендуемая структура для переиспользуемых схем:

```
src/
├── forms/                    # Определения форм
│   ├── user-form.ts
│   ├── order-form.ts
│   └── settings-form.ts
│
├── schemas/                  # Переиспользуемые схемы
│   ├── common-fields.ts      # Базовые конфигурации полей
│   ├── address-schema.ts
│   ├── person-schema.ts
│   └── phone-schema.ts
│
├── validators/               # Переиспользуемые валидаторы
│   ├── address-validators.ts
│   ├── person-validators.ts
│   ├── phone-validators.ts
│   └── custom/               # Кастомные валидаторы
│       ├── credit-card.ts
│       └── username.ts
│
├── behaviors/                # Переиспользуемые поведения
│   ├── address-behaviors.ts
│   ├── phone-behaviors.ts
│   └── common/               # Общие поведения
│       ├── auto-save.ts
│       ├── analytics.ts
│       └── keyboard-shortcuts.ts
│
└── modules/                  # Полные модули форм
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validators.ts
    │   ├── behaviors.ts
    │   └── index.ts
    └── payment-info/
        ├── schema.ts
        ├── validators.ts
        ├── behaviors.ts
        └── index.ts
```

## Лучшие Практики

### 1. Используйте Фабричные Функции

```typescript
// ✅ Хорошо - фабричная функция
export const personSchema = (): FormSchema<Person> => ({
  firstName: { value: '' },
  lastName: { value: '' },
});

// ❌ Плохо - прямой объект (делится ссылкой)
export const personSchema = {
  firstName: { value: '' },
  lastName: { value: '' },
};
```

### 2. Экспортируйте Типы со Схемами

```typescript
// ✅ Хорошо - экспорт и схемы, и типа
export interface Address {
  street: string;
  city: string;
}

export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
});

// ❌ Плохо - только схема, без типа
export const addressSchema = () => ({
  street: { value: '' },
  city: { value: '' },
});
```

### 3. Создавайте Наборы Валидации

```typescript
// ✅ Хорошо - функция валидации
export function validateAddress(path: FieldPath<Address>) {
  required(path.street);
  required(path.city);
}

// Использование
validation: (path) => {
  validateAddress(path.address);
}

// ❌ Плохо - повторение логики валидации везде
validation: (path) => {
  required(path.address.street);
  required(path.address.city);
}
```

### 4. Группируйте Связанные Схемы

```typescript
// ✅ Хорошо - полный модуль
export { contactInfoSchema, type ContactInfo } from './schema';
export { validateContactInfo } from './validators';
export { contactInfoBehaviors } from './behaviors';

// Единый импорт
import { contactInfoSchema, validateContactInfo } from './modules/contact-info';
```

### 5. Делайте Схемы Настраиваемыми

```typescript
// ✅ Хорошо - настраиваемая схема
export function createAddressSchema(options: {
  includeApartment?: boolean;
  requireState?: boolean;
}) {
  const schema: FormSchema<Address> = {
    street: { value: '' },
    city: { value: '' },
  };

  if (options.includeApartment) {
    schema.apartment = { value: '' };
  }

  return schema;
}

// ❌ Плохо - жесткая схема
export const addressSchema = {
  street: { value: '' },
  city: { value: '' },
  // Нельзя настроить
};
```

## Тестирование Переиспользуемых Схем

```typescript title="schemas/__tests__/person-schema.test.ts"
import { GroupNode } from 'reformer';
import { personSchema } from '../person-schema';
import { validatePerson } from '../../validators/person-validators';

describe('personSchema', () => {
  it('создает валидную схему', () => {
    const form = new GroupNode({
      form: personSchema(),
    });

    expect(form.controls.firstName.value.value).toBe('');
    expect(form.controls.lastName.value.value).toBe('');
  });

  it('правильно валидирует', () => {
    const form = new GroupNode({
      form: personSchema(),
      validation: (path) => validatePerson(path),
    });

    expect(form.valid.value).toBe(false);

    form.controls.firstName.setValue('Иван');
    form.controls.lastName.setValue('Иванов');
    form.controls.email.setValue('ivan@example.com');

    expect(form.valid.value).toBe(true);
  });
});
```

## Следующие Шаги

- [Композиция Форм](/docs/patterns/form-composition) — Композиция сложных форм из простых частей
- [Стратегии Валидации](/docs/validation/validation-strategies) — Продвинутые паттерны валидации
- [Кастомные Валидаторы](/docs/validation/custom) — Создание кастомных валидаторов
- [Кастомные Поведения](/docs/behaviors/custom) — Создание кастомных поведений
