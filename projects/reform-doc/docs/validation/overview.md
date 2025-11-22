---
sidebar_position: 1
---

# Validation Overview

ReFormer provides declarative validation with built-in validators and support for custom validation.

## Basic Usage

Define validation in `validationSchema`:

```typescript
import { GroupNode, FieldNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

const form = new GroupNode({
  schema: {
    name: new FieldNode({ value: '' }),
    email: new FieldNode({ value: '' }),
  },
  validationSchema: (path, { validate }) => [
    validate(path.name, required(), minLength(2)),
    validate(path.email, required(), email()),
  ],
});
```

## Validation State

```typescript
// Check validation state
form.valid;   // true if all fields valid
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

## Built-in Validators

| Validator | Description | Error Key |
|-----------|-------------|-----------|
| `required()` | Field must have value | `required` |
| `email()` | Valid email format | `email` |
| `minLength(n)` | Minimum string length | `minLength` |
| `maxLength(n)` | Maximum string length | `maxLength` |
| `min(n)` | Minimum number value | `min` |
| `max(n)` | Maximum number value | `max` |
| `pattern(regex)` | Match regex pattern | `pattern` |
| `url()` | Valid URL format | `url` |
| `phone()` | Valid phone format | `phone` |
| `number()` | Must be a number | `number` |
| `date()` | Valid date | `date` |

## Conditional Validation

Apply validation only when condition is met:

```typescript
import { applyWhen } from 'reformer/validators';

validationSchema: (path, { validate }) => [
  validate(
    path.phone,
    applyWhen(
      () => form.controls.contactByPhone.value === true,
      required()
    )
  ),
]
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
