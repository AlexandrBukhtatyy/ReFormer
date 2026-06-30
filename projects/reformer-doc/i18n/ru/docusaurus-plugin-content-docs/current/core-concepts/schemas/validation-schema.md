---
sidebar_position: 3
---

# Схема валидации

Схема валидации определяет правила проверки данных формы.

## Тип ValidationSchemaFn

```typescript
type ValidationSchemaFn<T> = (path: FieldPath<T>) => void;
```

Функция валидации получает типобезопасный объект `path` для объявления правил:

```typescript
import { GroupNode } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  validation: (path) => {
    validate(path.name, required());
    validate(path.name, minLength(2));
    validate(path.email, required());
    validate(path.email, email());
  },
});
```

## FieldPath — типобезопасные пути

`FieldPath<T>` обеспечивает типобезопасный доступ к полям формы:

```typescript
interface User {
  name: string;
  email: string;
  address: {
    city: string;
    zip: string;
  };
}

validation: (path: FieldPath<User>) => {
  validate(path.name, required()); // ✅ Корректно
  validate(path.email, required()); // ✅ Корректно
  validate(path.address.city, required()); // ✅ Корректно - вложенный доступ
  validate(path.phone, required()); // ❌ Ошибка TypeScript!
};
```

### Преимущества

1. **Автодополнение** — IDE показывает доступные поля
2. **Проверка на этапе компиляции** — ловите опечатки заранее
3. **Поддержка рефакторинга** — безопасное переименование полей

## Встроенные валидаторы

| Валидатор                            | Описание                       |
| ------------------------------------ | ------------------------------ |
| `validate(path.field, required())`   | Поле должно иметь значение     |
| `validate(path.field, email())`      | Корректный формат email        |
| `validate(path.field, minLength(n))` | Минимальная длина строки       |
| `validate(path.field, maxLength(n))` | Максимальная длина строки      |
| `validate(path.field, min(n))`       | Минимальное числовое значение  |
| `validate(path.field, max(n))`       | Максимальное числовое значение |
| `pattern(path.field, regex)`         | Соответствие regex             |

Полный список см. в [Встроенные валидаторы](/docs/validation/built-in).

## Условная валидация

Применяйте валидаторы на основе условий:

```typescript
import { when } from '@reformer/core/validators';

validation: (path) => {
  validate(path.email, required());

  // Валидировать телефон только если пользователь хочет SMS
  when(
    () => form.controls.wantsSms.value === true,
    () => {
      validate(path.phone, required());
      validate(path.phone, pattern(/^\d{10}$/));
    }
  );
};
```

## Вложенная валидация

Валидация вложенных объектов и массивов:

```typescript
interface Order {
  customer: {
    name: string;
    email: string;
  };
  items: Array<{
    product: string;
    quantity: number;
  }>;
}

validation: (path) => {
  // Вложенный объект
  validate(path.customer.name, required());
  validate(path.customer.email, email());

  // Элементы массива (валидирует шаблон каждого элемента)
  validate(path.items.product, required());
  validate(path.items.quantity, min(1));
};
```

## Кросс-валидация полей

Валидация полей относительно друг друга:

```typescript
import { custom } from '@reformer/core/validators';

validation: (path) => {
  validate(path.password, required());
  validate(path.confirmPassword, required());

  custom(path.confirmPassword, (value, _control, root) => {
    const password = root.password.value;
    if (value !== password) {
      return { match: 'Пароли должны совпадать' };
    }
    return null;
  });
};
```

## Асинхронная валидация

Серверная валидация:

```typescript
import { asyncValidator } from '@reformer/core/validators';

validation: (path) => {
  validate(path.username, required());

  asyncValidator(path.username, async (value) => {
    const exists = await checkUsername(value);
    if (exists) {
      return { taken: 'Имя пользователя уже занято' };
    }
    return null;
  });
};
```

Подробнее см. [Асинхронная валидация](/docs/validation/async).

## Извлечение наборов валидации

Создавайте переиспользуемые функции валидации:

```typescript
import { FieldPath } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

// Переиспользуемый набор валидации
export function validatePerson(path: FieldPath<Person>) {
  validate(path.firstName, required());
  validate(path.firstName, minLength(2));
  validate(path.lastName, required());
  validate(path.email, required());
  validate(path.email, email());
}

// Использование
const form = new GroupNode({
  form: {
    user: personSchema(),
    admin: personSchema(),
  },
  validation: (path) => {
    validatePerson(path.user);
    validatePerson(path.admin);
  },
});
```

## Следующие шаги

- [Обзор валидации](/docs/validation/overview) — Подробное руководство
- [Встроенные валидаторы](/docs/validation/built-in) — Все валидаторы
- [Кастомные валидаторы](/docs/validation/custom) — Создание своих
- [Композиция](./composition) — Переиспользование наборов валидации
