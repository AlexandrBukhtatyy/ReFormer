---
sidebar_position: 1
---

# Behaviors Overview

Behaviors add reactive logic to forms: computed fields, conditional visibility, field synchronization.

## What Are Behaviors?

Behaviors automatically react to form changes:

```typescript
import { GroupNode } from 'reformer';
import { computeFrom, enableWhen } from 'reformer/behaviors';

const form = new GroupNode({
  form: {
    price: { value: 100 },
    quantity: { value: 1 },
    total: { value: 0 },
    discount: { value: 0 },
    showDiscount: { value: false },
  },
  behavior: (path) => {
    // Auto-compute total
    computeFrom(
      [path.price, path.quantity],
      path.total,
      ({ price, quantity }) => price * quantity
    );

    // Enable discount field conditionally
    enableWhen(path.discount, (form) => form.total > 500);
  },
});
```

## Available Behaviors

| Behavior | Description |
|----------|-------------|
| [`computeFrom`](/docs/behaviors/computed#computefrom) | Calculate field from other fields |
| [`transformValue`](/docs/behaviors/computed#transformvalue) | Transform value on change |
| [`showWhen`](/docs/behaviors/conditional#showwhen) | Conditional visibility |
| [`enableWhen`](/docs/behaviors/conditional#enablewhen) | Conditional enable/disable |
| [`resetWhen`](/docs/behaviors/conditional#resetwhen) | Reset field on condition |
| [`copyFrom`](/docs/behaviors/sync#copyfrom) | Copy value from another field |
| [`syncFields`](/docs/behaviors/sync#syncfields) | Two-way synchronization |
| [`watchField`](/docs/behaviors/watch#watchfield) | React to field changes |
| [`revalidateWhen`](/docs/behaviors/watch#revalidatewhen) | Trigger revalidation |

## How Behaviors Work

1. Define in `behavior`
2. ReFormer sets up reactive subscriptions
3. When source fields change, behavior runs automatically

```typescript
// When price or quantity changes → total updates
computeFrom(
  [path.price, path.quantity],  // Watch these
  path.total,                    // Update this
  ({ price, quantity }) => price * quantity  // With this function
);
```

## Behavior vs Validation

| Aspect | Validation | Behavior |
|--------|------------|----------|
| Purpose | Check correctness | React to changes |
| Output | Errors | Side effects |
| Examples | Required, email format | Computed total, show/hide |

## Next Steps

- [Computed Fields](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Conditional Logic](/docs/behaviors/conditional) — `showWhen`, `enableWhen`, `resetWhen`
- [Field Sync](/docs/behaviors/sync) — `copyFrom`, `syncFields`
