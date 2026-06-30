---
sidebar_position: 1
---

# Validation Overview

ReFormer provides declarative validation with built-in validators and support for custom validation.

## Basic Usage

Define validation in `validation`. ReFormer separates **operators** (`validate`, `validateAsync`,
`applyWhen`, `apply`, `validateItems`) that register validators in the schema
from **validator factories** (`required`, `email`, `min`, …) that return pure
`Validator<TForm, TField>` functions of shape `(value, control, root) => ValidationError | null`.

```typescript
import { GroupNode } from '@reformer/core';
import { validate, required, email, minLength } from '@reformer/core/validators';

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

## Validation State

```typescript
// Check validation state
form.valid; // true if all fields valid
form.invalid; // true if any field invalid

// Check specific field
form.controls.name.valid;
form.controls.name.errors; // { required: true } or null
```

## Error Messages

Access errors on individual fields:

```typescript
const name = form.controls.name;

name.errors;
// null - when valid
// { required: true } - when required fails
// { minLength: { required: 2, actual: 1 } } - when minLength fails
```

## Built-in Validator Factories

All factories return a `Validator<TForm, TField>`. Pass them to `validate()`.

| Factory          | Used as                                | Error Key      |
| ---------------- | -------------------------------------- | -------------- |
| `required()`     | `validate(path.field, required())`     | `required`     |
| `email()`        | `validate(path.field, email())`        | `email`        |
| `minLength(n)`   | `validate(path.field, minLength(n))`   | `minLength`    |
| `maxLength(n)`   | `validate(path.field, maxLength(n))`   | `maxLength`    |
| `min(n)`         | `validate(path.field, min(n))`         | `min`          |
| `max(n)`         | `validate(path.field, max(n))`         | `max`          |
| `pattern(regex)` | `validate(path.field, pattern(regex))` | `pattern`      |
| `url()`          | `validate(path.field, url())`          | `url`          |
| `phone()`        | `validate(path.field, phone())`        | `phone`        |
| `isNumber()`     | `validate(path.field, isNumber())`     | `isNumber`     |
| `integer()`      | `validate(path.field, integer())`      | `integer`      |
| `multipleOf(n)`  | `validate(path.field, multipleOf(n))`  | `multipleOf`   |
| `nonNegative()`  | `validate(path.field, nonNegative())`  | `nonNegative`  |
| `nonZero()`      | `validate(path.field, nonZero())`      | `nonZero`      |
| `isDate()`       | `validate(path.field, isDate())`       | `date_invalid` |
| `notEmpty()`     | `validate(path.array, notEmpty())`     | `minLength`    |

## Conditional Validation

Apply validation only when condition is met:

```typescript
import { applyWhen, validate, required } from '@reformer/core/validators';

validation: (path) => {
  applyWhen(
    path.contactByPhone,
    (value) => value === true,
    (path) => {
      validate(path.phone, required());
    }
  );
};
```

## Validation Timing

Validation runs automatically when:

- Value changes
- Field is touched (for display purposes)

```typescript
// Manual validation
form.validate(); // Validate entire form
```

## Next Steps

- [Built-in Validators](/docs/validation/built-in) — All validators with examples
- [Async Validation](/docs/validation/async) — Server-side validation
- [Custom Validators](/docs/validation/custom) — Create your own validators
