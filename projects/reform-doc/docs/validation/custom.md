---
sidebar_position: 4
---

# Custom Validators

Create reusable validators for your application.

## Simple Custom Validator

```typescript
import { custom } from 'reformer/validators';

// Inline custom validator
validate(path.age, custom(
  (value) => value >= 18,
  'mustBeAdult'
))
// Error: { mustBeAdult: true }
```

## Reusable Validator Factory

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

// Usage
validate(path.password, strongPassword())
```

## Validator with Parameters

```typescript
export function range(min: number, max: number): ValidatorFn {
  return (value: number) => {
    if (value < min || value > max) {
      return { range: { min, max, actual: value } };
    }
    return null;
  };
}

// Usage
validate(path.quantity, range(1, 100))
// Error: { range: { min: 1, max: 100, actual: 150 } }
```

## Validator with Context

Access form state during validation:

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

// Usage
validate(path.confirmPassword, matchField('password'))
```

## Cross-Field Validation

Validate relationships between fields:

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

## Array Item Validation

Validate items in ArrayNode:

```typescript
const form = new GroupNode({
  schema: {
    emails: new ArrayNode({
      schema: () => new FieldNode({ value: '' }),
      value: [''],
    }),
  },
  validationSchema: (path, { validate }) => [
    // Validate each email in array
    validate(path.emails.$each, required(), email()),
  ],
});
```

## Conditional Custom Validator

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

## Next Steps

- [Behaviors](/docs/behaviors/overview) — Reactive form logic
- [API Reference](/docs/api) — Full API documentation
