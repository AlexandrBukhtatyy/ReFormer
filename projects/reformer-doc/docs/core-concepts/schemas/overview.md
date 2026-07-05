---
sidebar_position: 1
---

# Schemas Overview

ReFormer separates a form into three concerns — structure, validation, and behavior — to keep code
focused and reusable. In the M1 architecture values live in a **model**, the **schema** binds each
field to a model signal (and carries its validators), and reactive logic is declared separately with
`defineFormBehavior`.

## Structure, Validation, and Behavior

| Concern        | Purpose                            | Where it lives            |
| -------------- | ---------------------------------- | ------------------------- |
| **Structure**  | Data model and field configuration | `model` + `schema` nodes  |
| **Validation** | Validation rules                   | `validators` on each node |
| **Behavior**   | Reactive logic and side effects    | `defineFormBehavior`      |

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

type Person = { firstName: string; lastName: string; fullName: string; email: string };

const model = createModel<Person>({ firstName: '', lastName: '', fullName: '', email: '' });

// 1. Schema — structure + validation. Each node binds a model signal to a component.
const schema = {
  firstName: { value: model.$.firstName, component: Input, validators: [required()] },
  lastName: { value: model.$.lastName, component: Input, validators: [required()] },
  fullName: { value: model.$.fullName, component: Input },
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
};

// 2. Behavior — reactive logic, declared separately
const behavior = defineFormBehavior<Person>(({ model }) => {
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});

const form = createForm<Person>({ model, schema, behavior });
```

## Why Separate Concerns?

### Separation of Concerns

Each concern has a single responsibility:

- **Structure** (`model` + `schema`): "What data do we collect?"
- **Validation** (`validators`): "Is the data correct?"
- **Behavior** (`defineFormBehavior`): "How should data react to changes?"

### Reusability & Decomposition

Each concern can be decomposed into reusable parts and combined across sub-models:

```typescript
import { createModel, createForm, type ModelSignals } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

type Address = { street: string; city: string; zip: string };
type OrderForm = { billingAddress: Address; shippingAddress: Address };

// 1. Reusable schema builder — nodes bound to a sub-model's signals, validators inline
const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input, validators: [required()] },
  city: { value: s.city, component: Input, validators: [required()] },
  zip: { value: s.zip, component: Input, validators: [required()] },
});

// 2. Reusable behavior set — operates on the same sub-model signals
const addressBehaviors = (s: ModelSignals<Address>) => {
  transformValue(s.zip, (value) => (value ?? '').trim());
};

const model = createModel<OrderForm>({
  billingAddress: { street: '', city: '', zip: '' },
  shippingAddress: { street: '', city: '', zip: '' },
});

// Compose into a single schema — reuse the builder for both addresses
const schema = {
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

// Compose one behavior — apply the same set to both sub-models
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});

const orderForm = createForm<OrderForm>({ model, schema, behavior });
```

Reuse works at several granularities:

```typescript
// One validator list, many fields
const emailRules = [required(), email()];
const schema = {
  email: { value: model.$.email, component: Input, validators: emailRules },
  backupEmail: { value: model.$.backupEmail, component: Input, validators: emailRules },
};

// One node builder, applied to many sub-models
const addressSchema = {
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

// One behavior set, applied to many sub-models (inside defineFormBehavior)
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});
```

:::tip Builder Functions
Prefer builder functions that take a sub-model's signals (`addressNodes(model.$.billingAddress)`) over
hand-duplicating node objects. Each call binds to the right signals and keeps definitions DRY.
:::

**Benefits of decomposition:**

- **DRY** — Write once, use everywhere
- **Consistency** — Same rules across all forms
- **Maintainability** — Update in one place
- **Testing** — Test each part in isolation

See [Composition](./composition) for complete patterns and best practices.

### Testability

Test validation in isolation with `validateModelSync`:

```typescript
import { createModel, validateModelSync } from '@reformer/core';
import { required } from '@reformer/core/validators';

describe('person validation', () => {
  it('requires firstName', () => {
    const model = createModel<Person>({ firstName: '', lastName: '' });
    const schema = {
      firstName: { value: model.$.firstName, validators: [required()] },
      lastName: { value: model.$.lastName },
    };

    const { valid, errors } = validateModelSync(model, schema);

    expect(valid).toBe(false);
    expect(errors.firstName?.[0]?.code).toBe('required');
  });
});
```

### Type Safety

Model signals (`model.$.<field>`) are fully typed, so binding an unknown field is a compile-time error:

```typescript
const schema = {
  firstName: { value: model.$.firstName, validators: [required()] }, // ✅ typed signal
  // middleName: { value: model.$.middleName }, // ❌ Error: 'middleName' doesn't exist on the model
};
```

## Schema Structure

```
createForm({ model, schema, behavior })
├── model: FormModel<T>        → source of truth for values
├── schema                     → nodes: { value: signal, component?, validators? }
└── behavior: FormBehavior<T>  → defineFormBehavior(...) — reactive logic
```

## Next Steps

- [Form Schema](./form-schema) — Structure and field configuration
- [Validation Schema](./validation-schema) — Validation rules
- [Behavior Schema](./behavior-schema) — Reactive logic
- [Composition](./composition) — Reuse and decomposition patterns
  </content>
  </invoke>
