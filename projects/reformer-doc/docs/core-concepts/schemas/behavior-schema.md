---
sidebar_position: 4
---

# Behavior Schema

Behavior defines reactive logic and side effects for your form.

## Defining behaviors

In M1, behaviors are declared with `defineFormBehavior` and attached at `createForm({ behavior })`.
The setup callback receives a type-safe scope (`{ model, form }`); operators bind to model signals
(`model.$.<field>`) and the form owns their lifecycle:

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, computeFrom, enableWhen } from '@reformer/core/behaviors';

type OrderForm = { price: number; quantity: number; total: number; discount: number };

const model = createModel<OrderForm>({ price: 100, quantity: 1, total: 0, discount: 0 });

const schema = {
  price: { value: model.$.price, component: Input, componentProps: { type: 'number' } },
  quantity: { value: model.$.quantity, component: Input, componentProps: { type: 'number' } },
  total: {
    value: model.$.total,
    component: Input,
    componentProps: { type: 'number', disabled: true },
  },
  discount: { value: model.$.discount, component: Input, componentProps: { type: 'number' } },
};

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Auto-compute total
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price, quantity) => price * quantity
  );

  // Enable discount only for large orders
  enableWhen(model.$.discount, () => model.total > 500);
});

const form = createForm<OrderForm>({ model, schema, behavior });
```

## Available Behaviors

| Behavior         | Purpose     | Description                       |
| ---------------- | ----------- | --------------------------------- |
| `computeFrom`    | Computed    | Calculate field from other fields |
| `transformValue` | Computed    | Transform value on change         |
| `enableWhen`     | Conditional | Enable/disable based on condition |
| `resetWhen`      | Conditional | Reset field when condition met    |
| `copyFrom`       | Sync        | Copy value from another field     |
| `syncFields`     | Sync        | Two-way field synchronization     |
| `watchField`     | Watch       | React to field changes            |
| `revalidateWhen` | Watch       | Trigger revalidation              |

## Computed Behaviors

### computeFrom

Calculate a field's value from other fields. Source values arrive positionally:

```typescript
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Single source
  computeFrom([model.$.firstName], model.$.initials, (firstName) =>
    firstName.charAt(0).toUpperCase()
  );

  // Multiple sources
  computeFrom([model.$.firstName, model.$.lastName], model.$.fullName, (firstName, lastName) =>
    `${firstName} ${lastName}`.trim()
  );
});
```

### transformValue

Transform value on change (the transformer must be idempotent):

```typescript
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Normalize username to lowercase
  transformValue(model.$.username, (value) => (value ?? '').toLowerCase());

  // Format phone number
  transformValue(model.$.phone, (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
});
```

## Conditional Behaviors

### enableWhen

Enable or disable a field based on a condition. The condition reads `model.*` reactively:

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Enable shipping address when not same as billing
  enableWhen(model.$.shippingAddress, () => !model.sameAsBilling);

  // Enable discount for premium users
  enableWhen(model.$.discount, () => model.userType === 'premium');
});
```

### resetWhen

Reset field when condition is met:

```typescript
import { defineFormBehavior, resetWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Reset shipping when "same as billing" is checked
  resetWhen(model.$.shippingAddress, () => model.sameAsBilling === true);
});
```

## Sync Behaviors

### copyFrom

Copy value from another field (source and target may be fields or whole groups):

```typescript
import { defineFormBehavior, copyFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Copy billing to shipping when the checkbox is checked
  copyFrom(model.$.billingAddress, model.$.shippingAddress, {
    when: () => model.sameAsBilling === true,
  });
});
```

### syncFields

Two-way synchronization:

```typescript
import { defineFormBehavior, syncFields } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Sync email fields (changes in either update both)
  syncFields(model.$.email, model.$.confirmEmail);
});
```

## Watch Behaviors

### watchField

React to field changes. `watchField` from `@reformer/core` is the low-level primitive — a plain
subscription to a model signal that returns a cleanup:

```typescript
import { watchField } from '@reformer/core';

const stop = watchField(model.$.country, (country) => {
  model.city = ''; // reset the dependent field when country changes
});
// stop(); // unsubscribe
```

For async reactions — loading dependent options with debouncing and request cancellation — use
`onChange` inside `defineFormBehavior` (the callback runs outside the effect context and gets an
`AbortSignal`):

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      const states = await loadStates(country, { signal });
      form.state.updateComponentProps({ options: states });
    },
    { debounce: 300 }
  );
});
```

### revalidateWhen

Re-run validation when another field changes. Under M1 validation is on-demand, so revalidation is an
explicit callback triggered by dependency signals:

```typescript
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { validateFormModel } from '@reformer/core';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // Re-run validation when password changes (confirmPassword re-checks against it)
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});
```

## Extracting Behavior Sets

Create reusable behavior functions that operate on a sub-model's signals:

```typescript
import type { ModelSignals } from '@reformer/core';
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

// Reusable behaviors for an address sub-model
function addressBehaviors(address: ModelSignals<Address>) {
  // Auto-format ZIP code
  transformValue(address.zipCode, (value) => {
    if (!value) return value;
    const digits = value.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}

// Usage — call the set per sub-model inside defineFormBehavior
const behavior = defineFormBehavior<Order>(({ model }) => {
  addressBehaviors(model.$.billing);
  addressBehaviors(model.$.shipping);
});

const form = createForm<Order>({ model, schema, behavior });
```

## Behavior vs Validation

| Aspect        | Validation             | Behavior                  |
| ------------- | ---------------------- | ------------------------- |
| **Purpose**   | Check correctness      | React to changes          |
| **Output**    | Errors                 | Side effects              |
| **When runs** | After value change     | After value change        |
| **Examples**  | Required, email format | Computed total, show/hide |

## Next Steps

- [Behaviors Overview](/docs/behaviors/overview) — Detailed behaviors guide
- [Computed Fields](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Conditional Logic](/docs/behaviors/conditional) — `enableWhen`, `resetWhen`
- [Composition](./composition) — Reuse behavior sets
  </content>
