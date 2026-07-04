---
sidebar_position: 3
---

# Validation Schema

In ReFormer (M1 architecture), validation is **not** a separate schema function — it lives inside the
single form schema. Each field node carries a `validators` array, and the whole model is validated
against the schema with `validateFormModel` (or `validateModelSync`).

## Validators live on the schema node

Validators are **pure factories** imported from `@reformer/core/validators`. They return a validator
function `(value) => error | null` and are attached to a field node's `validators` array:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

interface User {
  name: string;
  email: string;
}

const model = createModel<User>({ name: '', email: '' });

const schema = {
  children: [
    { value: model.$.name, component: Input, validators: [required(), minLength(2)] },
    { value: model.$.email, component: Input, validators: [required(), email()] },
  ],
};

const form = createForm<User>({ model, schema });
```

The schema binds each field to a **model signal** (`model.$.<path>`); the value is the source of
truth in the model, the node holds UI/validation state.

## Running validation

```typescript
import { validateFormModel, validateModelSync } from '@reformer/core';

// Async-aware (runs sync + async validators). Routes errors into form nodes.
const { valid, errors } = await validateFormModel(model, schema);

// Sync-only (e.g. a fast "can I go to the next step?" gate). Async validators are skipped.
const res = validateModelSync(model, schema);
if (!res.valid) console.log(res.errors); // { 'email': [{ code, message }], ... }
```

## Built-in Validators

| Validator      | Description           |
| -------------- | --------------------- |
| `required()`   | Field must have value |
| `email()`      | Valid email format    |
| `minLength(n)` | Minimum string length |
| `maxLength(n)` | Maximum string length |
| `min(n)`       | Minimum number        |
| `max(n)`       | Maximum number        |
| `pattern(re)`  | Match regex           |

See [Built-in Validators](/docs/validation/built-in) for the full list.

## Conditional Validation

Wrap fields in a **branch node** `{ when, children }`. When `when(model, root)` is `false`, the whole
subtree is skipped (and any errors on those fields are cleared):

```typescript
const schema = {
  children: [
    { value: model.$.email, validators: [required()] },

    // Only validate phone if the user wants SMS
    {
      when: (m) => m.wantsSms === true,
      children: [{ value: model.$.phone, validators: [required(), pattern(/^\d{10}$/)] }],
    },
  ],
};
```

## Nested Validation

Nested objects are just nested paths on the model; array items are validated through an array section
(`componentProps.control` + `itemComponent`):

```typescript
interface Order {
  customer: { name: string; email: string };
  items: Array<{ product: string; quantity: number }>;
}

const model = createModel<Order>({
  customer: { name: '', email: '' },
  items: [{ product: '', quantity: 1 }],
});

const schema = {
  children: [
    // Nested object
    { value: model.$.customer.name, validators: [required()] },
    { value: model.$.customer.email, validators: [email()] },

    // Array items — validated per element
    {
      component: ArraySection,
      componentProps: {
        control: model.items,
        itemComponent: (item) => ({
          children: [
            { value: item.$.product, validators: [required()] },
            { value: item.$.quantity, validators: [min(1)] },
          ],
        }),
      },
    },
  ],
};
```

## Cross-Field Validation

A custom / cross-field check is a **model validator** `(value, model, root) => error | null`. Place it
directly in the field's `validators` array — `model` is the nearest scope, `root` the root model:

```typescript
const schema = {
  children: [
    { value: model.$.password, validators: [required()] },
    {
      value: model.$.confirmPassword,
      validators: [
        required(),
        (value, m) =>
          value !== m.password ? { code: 'mismatch', message: 'Passwords must match' } : null,
      ],
    },
  ],
};
```

## Async Validation

An async validator is a validator that returns a `Promise`. It runs under `validateFormModel`
(skipped by `validateModelSync`):

```typescript
const schema = {
  children: [
    {
      value: model.$.username,
      validators: [
        required(),
        async (value) => {
          const exists = await checkUsername(value as string);
          return exists ? { code: 'taken', message: 'Username already taken' } : null;
        },
      ],
    },
  ],
};
```

See [Async Validation](/docs/validation/async) for details.

## Extracting Validation Sets

Reuse validator arrays or whole node factories:

```typescript
import { required, email, minLength } from '@reformer/core/validators';
import type { ModelValidator } from '@reformer/core';

// Reusable validator lists
const nameValidators: ModelValidator[] = [required(), minLength(2)];
const emailValidators: ModelValidator[] = [required(), email()];

const schema = {
  children: [
    { value: model.$.user.firstName, validators: nameValidators },
    { value: model.$.user.lastName, validators: nameValidators },
    { value: model.$.user.email, validators: emailValidators },
  ],
};
```

## Next Steps

- [Validation Overview](/docs/validation/overview) — Detailed validation guide
- [Built-in Validators](/docs/validation/built-in) — All validators
- [Custom Validators](/docs/validation/custom) — Create your own
- [Composition](./composition) — Reuse validation sets
