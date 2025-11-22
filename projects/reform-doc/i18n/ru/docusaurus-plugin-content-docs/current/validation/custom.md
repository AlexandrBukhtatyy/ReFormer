---
sidebar_position: 4
---

# Кастомные валидаторы

Создание переиспользуемых валидаторов для вашего приложения.

## Простой кастомный валидатор

```typescript
import { custom } from 'reformer/validators';

// Inline кастомный валидатор
validate(path.age, custom(
  (value) => value >= 18,
  'mustBeAdult'
))
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
validationSchema: (path, { validate }) => [
  validate(path.startDate, required()),
  validate(path.endDate, required()),
  validate(path.endDate, (value, context) => {
    const startDate = context.root.controls.startDate.value;

    if (value && startDate && value < startDate) {
      return { endBeforeStart: true };
    }
    return null;
  }),
]
```

## Валидация элементов массива

Валидация элементов в ArrayNode:

```typescript
const form = new GroupNode({
  schema: {
    emails: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: [''],
    }),
  },
  validationSchema: (path, { validate }) => [
    // Валидация каждого email в массиве
    validate(path.emails.$each, required(), email()),
  ],
});
```

## Условный кастомный валидатор

```typescript
import { applyWhen } from 'reformer/validators';

validate(
  path.taxId,
  applyWhen(
    (context) => context.root.controls.country.value === 'US',
    custom((value) => /^\d{9}$/.test(value), 'invalidTaxId')
  )
)
```

## Следующие шаги

- [Behaviors](/docs/behaviors/overview) — реактивная логика форм
- [API Reference](/docs/api) — полная документация API
