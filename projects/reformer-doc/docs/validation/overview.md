---
sidebar_position: 1
---

# Validation Overview

ReFormer provides declarative validation with built-in validators and support for custom validation.

## Basic Usage

Attach validators directly in each field's schema node through its `validators: [...]`
array. Validators are pure **factories** (`required`, `email`, `min`, …) imported from
`@reformer/core/validators` that return `Validator<TForm, TField>` functions of shape
`(value, scope, root) => ValidationError | null`.

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

type ContactForm = { name: string; email: string };

const model = createModel<ContactForm>({ name: '', email: '' });

const schema = {
  name: { value: model.$.name, validators: [required(), minLength(2)] },
  email: { value: model.$.email, validators: [required(), email()] },
};

const form = createForm<ContactForm>({ model, schema });

// Validate on demand — errors are routed to fields for display:
const result = await validateFormModel(model, schema); // { valid, errors }
```

## Validation State

Read reactive field state with `useFormControl` inside components:

```typescript
import { useFormControl } from '@reformer/core';

function NameField() {
  const { value, errors, valid, shouldShowError } = useFormControl(form.name);
  // errors: ValidationError[] — empty [] when valid
  // valid: boolean
  // shouldShowError: true only after the field is touched
}
```

Validate the whole model on submit — errors are routed back to the fields:

```typescript
const { valid, errors } = await validateFormModel(model, schema);
```

## Error Messages

A field's `errors` is an array of `ValidationError` objects (`{ code, message, params? }`),
empty when the field is valid:

```typescript
form.name.errors.value;
// []                                                  — when valid
// [{ code: 'required', message: 'Name is required' }] — when required fails
// [{ code: 'minLength', message: 'Too short',
//    params: { minLength: 2, actualLength: 1 } }]     — when minLength fails
```

## Built-in Validator Factories

All factories return a `Validator<TForm, TField>`. Place them in a field's `validators: [...]` array.

| Factory          | Used as                        | Error Key      |
| ---------------- | ------------------------------ | -------------- |
| `required()`     | `validators: [required()]`     | `required`     |
| `email()`        | `validators: [email()]`        | `email`        |
| `minLength(n)`   | `validators: [minLength(n)]`   | `minLength`    |
| `maxLength(n)`   | `validators: [maxLength(n)]`   | `maxLength`    |
| `min(n)`         | `validators: [min(n)]`         | `min`          |
| `max(n)`         | `validators: [max(n)]`         | `max`          |
| `pattern(regex)` | `validators: [pattern(regex)]` | `pattern`      |
| `url()`          | `validators: [url()]`          | `url`          |
| `phone()`        | `validators: [phone()]`        | `phone`        |
| `isNumber()`     | `validators: [isNumber()]`     | `isNumber`     |
| `integer()`      | `validators: [integer()]`      | `integer`      |
| `multipleOf(n)`  | `validators: [multipleOf(n)]`  | `multipleOf`   |
| `nonNegative()`  | `validators: [nonNegative()]`  | `nonNegative`  |
| `nonZero()`      | `validators: [nonZero()]`      | `nonZero`      |
| `isDate()`       | `validators: [isDate()]`       | `date_invalid` |

## Conditional Validation

Apply validation only when condition is met:

```typescript
import { required } from '@reformer/core/validators';

// A branch node validates its children only when `when` returns true.
// When false, the subtree is skipped and its fields' errors are cleared.
const schema = {
  children: [
    {
      when: (_scope, root) => root.contactByPhone === true,
      children: [{ value: model.$.phone, validators: [required()] }],
    },
  ],
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
