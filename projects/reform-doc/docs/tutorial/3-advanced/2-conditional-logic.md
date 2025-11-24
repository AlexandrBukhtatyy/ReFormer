---
sidebar_position: 2
---

# Conditional Logic

In this lesson, you'll learn how to show/hide fields, enable/disable them, and apply conditional validation based on other field values.

## What You'll Learn

- How to conditionally show/hide fields
- How to enable/disable fields dynamically
- How to apply conditional validation
- How to sync field values conditionally

## Why Use Conditional Logic?

Forms often need to adapt based on user input:
- Show additional fields only when relevant
- Disable fields that depend on other selections
- Apply different validation rules based on context
- Keep related fields synchronized

## Conditional Visibility

Let's create a shipping form that shows different fields based on shipping method:

```typescript title="src/components/ShippingForm/form.ts"
import { GroupNode } from 'reformer';
import { required } from 'reformer/validators';
import { visible } from 'reformer/behaviors';

interface ShippingFormData {
  shippingMethod: 'standard' | 'express' | 'pickup';
  address: string;
  deliveryDate: string;
  storeLocation: string;
}

export const shippingForm = new GroupNode<ShippingFormData>({
  form: {
    shippingMethod: { value: 'standard' },
    address: { value: '' },
    deliveryDate: { value: '' },
    storeLocation: { value: '' },
  },
  validation: (path, { when }) => {
    required(path.shippingMethod);

    // Address required only for standard/express
    when(
      () => {
        const method = shippingForm.controls.shippingMethod.value;
        return method === 'standard' || method === 'express';
      },
      (path) => {
        required(path.address);
      }
    );

    // Delivery date required only for express
    when(
      () => shippingForm.controls.shippingMethod.value === 'express',
      (path) => {
        required(path.deliveryDate);
      }
    );

    // Store location required only for pickup
    when(
      () => shippingForm.controls.shippingMethod.value === 'pickup',
      (path) => {
        required(path.storeLocation);
      }
    );
  },
  behaviors: (path, { use }) => [
    // Show address only for standard/express
    use(visible(
      path.address,
      [path.shippingMethod],
      (method) => method === 'standard' || method === 'express'
    )),

    // Show delivery date only for express
    use(visible(
      path.deliveryDate,
      [path.shippingMethod],
      (method) => method === 'express'
    )),

    // Show store location only for pickup
    use(visible(
      path.storeLocation,
      [path.shippingMethod],
      (method) => method === 'pickup'
    )),
  ],
});
```

### Understanding Conditional Behaviors

- **`visible(target, deps, condition)`** — controls field visibility
- **`when(condition, validations)`** — applies validation conditionally
- **`condition`** — function that returns boolean
- **`deps`** — fields to watch for changes

## React Component

```tsx title="src/components/ShippingForm/index.tsx"
import { useFormControl } from 'reformer';
import { shippingForm } from './form';

export function ShippingForm() {
  const shippingMethod = useFormControl(shippingForm.controls.shippingMethod);
  const address = useFormControl(shippingForm.controls.address);
  const deliveryDate = useFormControl(shippingForm.controls.deliveryDate);
  const storeLocation = useFormControl(shippingForm.controls.storeLocation);

  return (
    <form>
      <div>
        <label>Shipping Method</label>
        <select
          value={shippingMethod.value}
          onChange={(e) => shippingMethod.setValue(e.target.value as any)}
        >
          <option value="standard">Standard Shipping</option>
          <option value="express">Express Shipping</option>
          <option value="pickup">Store Pickup</option>
        </select>
      </div>

      {/* Conditionally shown fields */}
      {address.visible && (
        <div>
          <label htmlFor="address">Delivery Address</label>
          <input
            id="address"
            value={address.value}
            onChange={(e) => address.setValue(e.target.value)}
            onBlur={() => address.markAsTouched()}
          />
          {address.touched && address.errors?.required && (
            <span className="error">Address is required</span>
          )}
        </div>
      )}

      {deliveryDate.visible && (
        <div>
          <label htmlFor="deliveryDate">Preferred Delivery Date</label>
          <input
            id="deliveryDate"
            type="date"
            value={deliveryDate.value}
            onChange={(e) => deliveryDate.setValue(e.target.value)}
            onBlur={() => deliveryDate.markAsTouched()}
          />
          {deliveryDate.touched && deliveryDate.errors?.required && (
            <span className="error">Delivery date is required</span>
          )}
        </div>
      )}

      {storeLocation.visible && (
        <div>
          <label htmlFor="storeLocation">Store Location</label>
          <select
            id="storeLocation"
            value={storeLocation.value}
            onChange={(e) => storeLocation.setValue(e.target.value)}
            onBlur={() => storeLocation.markAsTouched()}
          >
            <option value="">Select a store</option>
            <option value="downtown">Downtown</option>
            <option value="mall">Shopping Mall</option>
            <option value="airport">Airport</option>
          </select>
          {storeLocation.touched && storeLocation.errors?.required && (
            <span className="error">Store location is required</span>
          )}
        </div>
      )}

      <button type="submit" disabled={!shippingForm.valid}>
        Continue
      </button>
    </form>
  );
}
```

### Checking Visibility

- **`field.visible`** — boolean property indicating if field should be shown
- React to visibility changes automatically with `useFormControl`

## Conditional Enabling/Disabling

Use the `disabled` behavior to enable/disable fields:

```typescript
import { disabled } from 'reformer/behaviors';

behaviors: (path, { use }) => [
  // Disable field based on condition
  use(disabled(
    path.promoCode,
    [path.totalAmount],
    (totalAmount) => totalAmount < 50 // Disable if amount < $50
  )),
]
```

In React:

```tsx
const promoCode = useFormControl(form.controls.promoCode);

<input
  value={promoCode.value}
  onChange={(e) => promoCode.setValue(e.target.value)}
  disabled={promoCode.disabled}
/>
```

## Field Synchronization

Keep fields synchronized conditionally:

```typescript
import { sync } from 'reformer/behaviors';

behaviors: (path, { use }) => [
  // Copy billing address to shipping when checkbox is checked
  use(sync(
    path.shippingAddress,
    [path.billingAddress, path.sameAsB illing],
    (billingAddress, sameAsBilling) =>
      sameAsBilling ? billingAddress : undefined
  )),
]
```

## Complex Conditions

Conditions can be as complex as needed:

```typescript
use(visible(
  path.taxId,
  [path.accountType, path.country, path.annualRevenue],
  (accountType, country, annualRevenue) => {
    // Show tax ID for business accounts in certain countries
    // with revenue above threshold
    return accountType === 'business' &&
           ['US', 'CA', 'UK'].includes(country) &&
           annualRevenue > 50000;
  }
))
```

## Conditional Validation

Apply different validators based on conditions:

```typescript
validation: (path, { when }) => {
  // Always required
  required(path.email);

  // Additional validation when business account
  when(
    () => form.controls.accountType.value === 'business',
    (path) => {
      required(path.companyName);
      required(path.taxId);
      required(path.businessEmail);
      email(path.businessEmail);
    }
  );
}
```

## Try It Out

1. Change shipping method to "Express" → delivery date field appears
2. Change to "Pickup" → store location selector appears
3. Change to "Standard" → only address field shows
4. Notice validation adapts to visible fields

## Key Concepts

- **`visible(target, deps, condition)`** — shows/hides fields
- **`disabled(target, deps, condition)`** — enables/disables fields
- **`sync(target, deps, calculator)`** — synchronizes field values
- **`when(condition, validations)`** — conditional validation
- **`field.visible`** — check if field should be shown
- **`field.disabled`** — check if field should be disabled
- **Dynamic forms** — adapt to user input in real-time

## What's Next?

In the next lesson, we'll learn about **Async Validation** — how to validate fields against server-side data, like checking if a username is available.
