---
sidebar_position: 1
---

# Validation Overview

ReFormer provides declarative validation with built-in validators and support for custom validation.

## Basic Usage

Define validation in `validation`:

```typescript
import { GroupNode } from 'reformer';
import { required, email, minLength } from 'reformer/validators';

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
| `required(path.field)` | Field must have value | `required` |
| `email(path.field)` | Valid email format | `email` |
| `minLength(path.field, n)` | Minimum string length | `minLength` |
| `maxLength(path.field, n)` | Maximum string length | `maxLength` |
| `min(path.field, n)` | Minimum number value | `min` |
| `max(path.field, n)` | Maximum number value | `max` |
| `pattern(path.field, regex)` | Match regex pattern | `pattern` |
| `url(path.field)` | Valid URL format | `url` |
| `phone(path.field)` | Valid phone format | `phone` |
| `number(path.field)` | Must be a number | `number` |
| `date(path.field)` | Valid date | `date` |

## Conditional Validation

Apply validation only when condition is met:

```typescript
import { when } from 'reformer/validators';

validation: (path) => {
  when(
    () => form.controls.contactByPhone.value === true,
    (path) => {
      required(path.phone);
    }
  );
}
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
