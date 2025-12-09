---
sidebar_position: 1
---

# Обзор схем

ReFormer использует архитектуру из трёх схем для разделения ответственности и максимального переиспользования кода.

## Три типа схем

| Схема               | Назначение                            | Свойство     |
| ------------------- | ------------------------------------- | ------------ |
| **Схема формы**     | Структура данных и конфигурация полей | `form`       |
| **Схема валидации** | Правила валидации                     | `validation` |
| **Схема поведений** | Реактивная логика и побочные эффекты  | `behavior`   |

```typescript
import { GroupNode } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';

const form = new GroupNode({
  // 1. Схема формы - структура
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    fullName: { value: '' },
    email: { value: '' },
  },

  // 2. Схема валидации - правила
  validation: (path) => {
    required(path.firstName);
    required(path.lastName);
    required(path.email);
    email(path.email);
  },

  // 3. Схема поведений - логика
  behavior: (path) => {
    computeFrom([path.firstName, path.lastName], path.fullName, ({ firstName, lastName }) =>
      `${firstName} ${lastName}`.trim()
    );
  },
});
```

## Зачем три схемы?

### Разделение ответственности

Каждая схема имеет одну зону ответственности:

- **Схема формы**: «Какие данные мы собираем?»
- **Схема валидации**: «Корректны ли данные?»
- **Схема поведений**: «Как данные должны реагировать на изменения?»

### Переиспользование и декомпозиция

Каждую схему можно декомпозировать на переиспользуемые части и комбинировать с помощью функции `apply`:

```typescript
import { apply, required } from '@reformer/core/validators';
import { apply as applyBehavior, watchField } from '@reformer/core/behaviors';

// 1. Переиспользуемая схема формы (всегда используйте фабричные функции!)
const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
  zipCode: { value: '' },
});

// 2. Переиспользуемая схема валидации
const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.street);
  required(path.city);
  required(path.zipCode);
};

// 3. Переиспользуемая схема поведений
const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  watchField(path.zipCode, (value, ctx) => {
    // Форматирование индекса
  });
};

// Композиция в формы с помощью apply()
const orderForm = new GroupNode<OrderForm>({
  form: {
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
  validation: (path) => {
    // Применяем одну валидацию к нескольким полям
    apply([path.billingAddress, path.shippingAddress], addressValidation);
  },
  behavior: (path) => {
    // Применяем одно поведение к нескольким полям
    applyBehavior([path.billingAddress, path.shippingAddress], addressBehavior);
  },
});
```

Функция `apply` поддерживает гибкую композицию:

```typescript
// Одно поле + одна схема
apply(path.address, addressValidation);

// Несколько полей + одна схема
apply([path.billingAddress, path.shippingAddress], addressValidation);

// Одно поле + несколько схем
apply(path.email, [requiredValidation, emailValidation]);

// Несколько полей + несколько схем
apply([path.email, path.phone], [requiredValidation, formatValidation]);
```

:::tip Фабричные функции
Всегда используйте функции, возвращающие схемы (`addressSchema()`), а не прямые объекты. Это гарантирует, что каждая форма получит свой собственный экземпляр и избежит багов с разделяемым состоянием.
:::

**Преимущества декомпозиции:**

- **DRY** — Пишем один раз, используем везде
- **Консистентность** — Одинаковые правила во всех формах
- **Поддерживаемость** — Обновляем в одном месте
- **Тестируемость** — Тестируем каждую часть изолированно

Подробнее см. [Композиция](./composition).

### Тестируемость

Тестируйте каждую схему изолированно:

```typescript
// Тестирование валидации отдельно
describe('validatePerson', () => {
  it('требует firstName', () => {
    const form = new GroupNode({
      form: personSchema(),
      validation: validatePerson,
    });
    expect(form.controls.firstName.errors).toEqual({ required: true });
  });
});
```

### Типобезопасность

Все три схемы используют `FieldPath<T>` для проверки типов на этапе компиляции:

```typescript
validation: (path) => {
  required(path.firstName); // ✅ TypeScript знает, что это поле существует
  required(path.middleName); // ❌ Ошибка: 'middleName' не существует
};
```

## Структура схем

```
Конфигурация GroupNode
├── form: FormSchema<T>           → Структура данных
├── validation: ValidationSchemaFn<T>  → Правила валидации
└── behavior: BehaviorSchemaFn<T>      → Реактивная логика
```

## Следующие шаги

- [Схема формы](./form-schema) — Структура и конфигурация полей
- [Схема валидации](./validation-schema) — Правила валидации
- [Схема поведений](./behavior-schema) — Реактивная логика
- [Композиция](./composition) — Паттерны переиспользования и декомпозиции
