---
sidebar_position: 4
---

# Кастомные валидаторы

Создание переиспользуемых валидаторов для вашего приложения.

## Простой кастомный валидатор

Используйте `validate()` для инлайн кастомных валидаторов:

```typescript
import { validate } from 'reformer/validators';

validation: (path) => {
  // Инлайн кастомный валидатор
  validate(path.age, (value) => {
    if (value < 18) {
      return { mustBeAdult: true };
    }
    return null;
  });
}
// Ошибка: { mustBeAdult: true }
```

## Переиспользуемая фабрика валидаторов

```typescript
// validators/password.ts
import { ValidatorFn } from 'reformer';

export function strongPassword(): ValidatorFn {
  return (value: string) => {
    const errors: Record<string, boolean> = {};

    if (!/[A-Z]/.test(value)) {
      errors.noUppercase = true;
    }
    if (!/[a-z]/.test(value)) {
      errors.noLowercase = true;
    }
    if (!/[0-9]/.test(value)) {
      errors.noNumber = true;
    }
    if (value.length < 8) {
      errors.tooShort = true;
    }

    return Object.keys(errors).length ? errors : null;
  };
}

// Использование
validate(path.password, strongPassword())
```

## Валидатор с параметрами

```typescript
export function range(min: number, max: number): ValidatorFn {
  return (value: number) => {
    if (value < min || value > max) {
      return { range: { min, max, actual: value } };
    }
    return null;
  };
}

// Использование
validate(path.quantity, range(1, 100))
// Ошибка: { range: { min: 1, max: 100, actual: 150 } }
```

## Валидатор с контекстом

Доступ к состоянию формы во время валидации:

```typescript
import { ContextualValidatorFn } from 'reformer';

export function matchField(fieldName: string): ContextualValidatorFn {
  return (value, context) => {
    const otherValue = context.root.controls[fieldName].value;

    if (value !== otherValue) {
      return { mismatch: { field: fieldName } };
    }
    return null;
  };
}

// Использование
validate(path.confirmPassword, matchField('password'))
```

## Кросс-валидация полей

Валидация связей между полями:

```typescript
validation: (path) => {
  required(path.startDate);
  required(path.endDate);

  // Валидация, что дата окончания после даты начала
  validate(path.endDate, (value, ctx) => {
    const startDate = ctx.form.startDate.value.value;

    if (value && startDate && new Date(value) < new Date(startDate)) {
      return { endBeforeStart: true };
    }
    return null;
  });
}
```

## Валидация элементов массива

Валидация элементов в динамических массивах:

```typescript
interface ContactForm {
  name: string;
  emails: string[];
}

const form = new GroupNode<ContactForm>({
  form: {
    name: { value: '' },
    emails: [{ value: '' }],
  },
  validation: (path) => {
    required(path.name);

    // Валидация каждого email в массиве
    required(path.emails.$each);
    email(path.emails.$each);
  },
});
```

## Условная валидация с кастомной логикой

Используйте `when()` для условных кастомных валидаторов:

```typescript
import { when } from 'reformer/validators';

validation: (path) => {
  required(path.country);

  // Требовать tax ID только для пользователей из США
  when(
    () => form.controls.country.value === 'US',
    (path) => {
      required(path.taxId);
      validate(path.taxId, (value) => {
        if (!/^\d{9}$/.test(value)) {
          return { invalidTaxId: true };
        }
        return null;
      });
    }
  );
}
```

## Следующие шаги

- [Behaviors](/docs/behaviors/overview) — реактивная логика форм
- [API Reference](/docs/api) — полная документация API
