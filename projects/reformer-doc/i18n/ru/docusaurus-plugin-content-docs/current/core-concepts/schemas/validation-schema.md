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
    required(path.name);
    minLength(path.name, 2);
    required(path.email);
    email(path.email);
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
  required(path.name); // ✅ Корректно
  required(path.email); // ✅ Корректно
  required(path.address.city); // ✅ Корректно - вложенный доступ
  required(path.phone); // ❌ Ошибка TypeScript!
};
```

### Преимущества

1. **Автодополнение** — IDE показывает доступные поля
2. **Проверка на этапе компиляции** — ловите опечатки заранее
3. **Поддержка рефакторинга** — безопасное переименование полей

## Встроенные валидаторы

| Валидатор                    | Описание                       |
| ---------------------------- | ------------------------------ |
| `required(path.field)`       | Поле должно иметь значение     |
| `email(path.field)`          | Корректный формат email        |
| `minLength(path.field, n)`   | Минимальная длина строки       |
| `maxLength(path.field, n)`   | Максимальная длина строки      |
| `min(path.field, n)`         | Минимальное числовое значение  |
| `max(path.field, n)`         | Максимальное числовое значение |
| `pattern(path.field, regex)` | Соответствие regex             |

Полный список см. в [Встроенные валидаторы](/docs/validation/built-in).

## Условная валидация

Применяйте валидаторы на основе условий:

```typescript
import { when } from '@reformer/core/validators';

validation: (path) => {
  required(path.email);

  // Валидировать телефон только если пользователь хочет SMS
  when(
    () => form.controls.wantsSms.value === true,
    () => {
      required(path.phone);
      pattern(path.phone, /^\d{10}$/);
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
  required(path.customer.name);
  email(path.customer.email);

  // Элементы массива (валидирует шаблон каждого элемента)
  required(path.items.product);
  min(path.items.quantity, 1);
};
```

## Кросс-валидация полей

Валидация полей относительно друг друга:

```typescript
import { custom } from '@reformer/core/validators';

validation: (path) => {
  required(path.password);
  required(path.confirmPassword);

  custom(path.confirmPassword, (value, ctx) => {
    const password = ctx.form.password.value;
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
  required(path.username);

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
  required(path.firstName);
  minLength(path.firstName, 2);
  required(path.lastName);
  required(path.email);
  email(path.email);
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
