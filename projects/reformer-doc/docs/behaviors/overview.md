---
sidebar_position: 1
---

# Behaviors Overview

Behaviors add reactive logic to forms: computed fields, conditional visibility, field synchronization.

## What Are Behaviors?

Behaviors automatically react to form changes:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom, enableWhen } from '@reformer/core/behaviors';

interface OrderForm {
  price: number;
  quantity: number;
  total: number;
  discount: number;
}

const model = createModel<OrderForm>({ price: 100, quantity: 1, total: 0, discount: 0 });

// Behaviors are declared inside `defineFormBehavior` and attached via `createForm({ behavior })`.
const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Auto-compute total — sources arrive as positional values
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price, quantity) => price * quantity
  );

  // Enable the discount field conditionally — the condition reads the model
  enableWhen(model.$.discount, () => model.total > 500);
});

// `schema` binds the fields to components (see Quick Start).
const form = createForm<OrderForm>({ model, schema, behavior });
```

## Available Behaviors

| Behavior                                                    | Description                       |
| ----------------------------------------------------------- | --------------------------------- |
| [`computeFrom`](/docs/behaviors/computed#computefrom)       | Calculate field from other fields |
| [`transformValue`](/docs/behaviors/computed#transformvalue) | Transform value on change         |
| [`enableWhen`](/docs/behaviors/conditional#enablewhen)      | Conditional enable/disable        |
| [`resetWhen`](/docs/behaviors/conditional#resetwhen)        | Reset field on condition          |
| [`copyFrom`](/docs/behaviors/sync#copyfrom)                 | Copy value from another field     |
| [`syncFields`](/docs/behaviors/sync#syncfields)             | Two-way synchronization           |
| [`watchField`](/docs/behaviors/watch#watchfield)            | React to field changes            |
| [`revalidateWhen`](/docs/behaviors/watch#revalidatewhen)    | Trigger revalidation              |

## How Behaviors Work

1. Declare operators inside `defineFormBehavior(({ model, form }) => { … })`
2. Pass the result to `createForm({ model, schema, behavior })`
3. ReFormer sets up reactive subscriptions — when source signals change, the operators run automatically

```typescript
// When price or quantity changes → total updates
computeFrom(
  [model.$.price, model.$.quantity], // Watch these signals
  model.$.total, // Update this signal
  (price, quantity) => price * quantity // With this function (positional values)
);
```

## Behavior vs Validation

| Aspect   | Validation             | Behavior                  |
| -------- | ---------------------- | ------------------------- |
| Purpose  | Check correctness      | React to changes          |
| Output   | Errors                 | Side effects              |
| Examples | Required, email format | Computed total, show/hide |

## Next Steps

- [Computed Fields](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Conditional Logic](/docs/behaviors/conditional) — `enableWhen`, `resetWhen`
- [Field Sync](/docs/behaviors/sync) — `copyFrom`, `syncFields`
