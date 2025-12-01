---
sidebar_position: 4
---

# Behavior Schema

Behavior Schema defines reactive logic and side effects for your form.

## BehaviorSchemaFn Type

```typescript
type BehaviorSchemaFn<T> = (path: FieldPath<T>) => void;
```

The behavior function receives a type-safe `path` object for declaring reactive behaviors:

```typescript
import { GroupNode } from 'reformer';
import { computeFrom, enableWhen } from 'reformer/behaviors';

const form = new GroupNode({
  form: {
    price: { value: 100 },
    quantity: { value: 1 },
    total: { value: 0 },
    discount: { value: 0 },
  },
  behavior: (path) => {
    // Auto-compute total
    computeFrom(
      [path.price, path.quantity],
      path.total,
      ({ price, quantity }) => price * quantity
    );

    // Enable discount only for large orders
    enableWhen(path.discount, (form) => form.total > 500);
  },
});
```

## Available Behaviors

| Behavior | Purpose | Description |
|----------|---------|-------------|
| `computeFrom` | Computed | Calculate field from other fields |
| `transformValue` | Computed | Transform value on change |
| `enableWhen` | Conditional | Enable/disable based on condition |
| `resetWhen` | Conditional | Reset field when condition met |
| `copyFrom` | Sync | Copy value from another field |
| `syncFields` | Sync | Two-way field synchronization |
| `watchField` | Watch | React to field changes |
| `revalidateWhen` | Watch | Trigger revalidation |

## Computed Behaviors

### computeFrom

Calculate a field's value from other fields:

```typescript
import { computeFrom } from 'reformer/behaviors';

behavior: (path) => {
  // Single source
  computeFrom(
    [path.firstName],
    path.initials,
    ({ firstName }) => firstName.charAt(0).toUpperCase()
  );

  // Multiple sources
  computeFrom(
    [path.firstName, path.lastName],
    path.fullName,
    ({ firstName, lastName }) => `${firstName} ${lastName}`.trim()
  );
}
```

### transformValue

Transform value on change:

```typescript
import { transformValue } from 'reformer/behaviors';

behavior: (path) => {
  // Uppercase username
  transformValue(path.username, (value) => value.toLowerCase());

  // Format phone number
  transformValue(path.phone, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
}
```

## Conditional Behaviors

### enableWhen

Enable or disable field based on condition:

```typescript
import { enableWhen } from 'reformer/behaviors';

behavior: (path) => {
  // Enable shipping address when not same as billing
  enableWhen(
    path.shippingAddress,
    (form) => !form.sameAsBilling
  );

  // Enable discount for premium users
  enableWhen(
    path.discount,
    (form) => form.userType === 'premium'
  );
}
```

### resetWhen

Reset field when condition is met:

```typescript
import { resetWhen } from 'reformer/behaviors';

behavior: (path) => {
  // Reset shipping when "same as billing" checked
  resetWhen(
    path.shippingAddress,
    (form) => form.sameAsBilling === true
  );
}
```

## Sync Behaviors

### copyFrom

Copy value from another field:

```typescript
import { copyFrom } from 'reformer/behaviors';

behavior: (path) => {
  // Copy billing to shipping when checkbox checked
  copyFrom(
    path.billingAddress,
    path.shippingAddress,
    { when: (form) => form.sameAsBilling }
  );
}
```

### syncFields

Two-way synchronization:

```typescript
import { syncFields } from 'reformer/behaviors';

behavior: (path) => {
  // Sync email fields (changes in either update both)
  syncFields(path.email, path.confirmEmail);
}
```

## Watch Behaviors

### watchField

React to field changes:

```typescript
import { watchField } from 'reformer/behaviors';

behavior: (path) => {
  watchField(path.country, (value, ctx) => {
    // Load states/provinces for selected country
    loadStates(value).then(states => {
      ctx.form.stateOptions.setValue(states);
    });
  });
}
```

### revalidateWhen

Trigger revalidation when another field changes:

```typescript
import { revalidateWhen } from 'reformer/behaviors';

behavior: (path) => {
  // Revalidate password confirmation when password changes
  revalidateWhen(path.password, path.confirmPassword);
}
```

## Extracting Behavior Sets

Create reusable behavior functions:

```typescript
import { FieldPath, Behavior } from 'reformer';
import { computeFrom, transformValue } from 'reformer/behaviors';

// Reusable behaviors for address
export function addressBehaviors<T extends { address: Address }>(
  path: FieldPath<T>
) {
  // Auto-format ZIP code
  transformValue(path.address.zipCode, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}

// Usage
const form = new GroupNode({
  form: {
    billing: addressSchema(),
    shipping: addressSchema(),
  },
  behavior: (path) => {
    addressBehaviors(path.billing);
    addressBehaviors(path.shipping);
  },
});
```

## Behavior vs Validation

| Aspect | Validation | Behavior |
|--------|------------|----------|
| **Purpose** | Check correctness | React to changes |
| **Output** | Errors | Side effects |
| **When runs** | After value change | After value change |
| **Examples** | Required, email format | Computed total, show/hide |

## Next Steps

- [Behaviors Overview](/docs/behaviors/overview) — Detailed behaviors guide
- [Computed Fields](/docs/behaviors/computed) — `computeFrom`, `transformValue`
- [Conditional Logic](/docs/behaviors/conditional) — `enableWhen`, `resetWhen`
- [Composition](./composition) — Reuse behavior sets
