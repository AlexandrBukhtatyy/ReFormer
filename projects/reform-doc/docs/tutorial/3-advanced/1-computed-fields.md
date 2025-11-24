---
sidebar_position: 1
---

# Computed Fields

In this lesson, you'll learn how to create fields that automatically calculate their values based on other fields using behaviors.

## What You'll Learn

- How to create computed fields with behaviors
- How to define dependencies between fields
- How to implement automatic calculations
- How to use computed values in forms

## Why Use Computed Fields?

Computed fields automatically update when their dependencies change:
- Calculate total price from quantity and unit price
- Generate full name from first and last name
- Calculate age from birth date
- Compute tax amount from subtotal

## Creating a Computed Field

Let's create a shopping cart form that calculates the total automatically:

```typescript title="src/components/CartForm/form.ts"
import { GroupNode } from 'reformer';
import { required, min } from 'reformer/validators';
import { computed } from 'reformer/behaviors';

interface CartItemData {
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number; // Computed!
}

export const cartForm = new GroupNode<CartItemData>({
  form: {
    productName: { value: '' },
    quantity: { value: 1 },
    unitPrice: { value: 0 },
    total: { value: 0 },
  },
  validation: (path) => {
    required(path.productName);
    required(path.quantity);
    min(path.quantity, 1);
    required(path.unitPrice);
    min(path.unitPrice, 0);
  },
  behaviors: (path, { use }) => [
    use(computed(
      path.total,
      [path.quantity, path.unitPrice],
      (quantity, unitPrice) => quantity * unitPrice
    )),
  ],
});
```

### Understanding Computed Behavior

- **`behaviors`** — function to define reactive behaviors
- **`computed(target, dependencies, calculator)`** — creates a computed field
- **`target`** — the field to update (path.total)
- **`dependencies`** — fields to watch (path.quantity, path.unitPrice)
- **`calculator`** — function that computes the value

## How It Works

When dependencies change, the computed field updates automatically:

```typescript
// Initial state
console.log(cartForm.value);
// { productName: '', quantity: 1, unitPrice: 0, total: 0 }

// Change quantity
cartForm.controls.quantity.setValue(5);
console.log(cartForm.controls.total.value); // 0 (5 * 0)

// Change unit price
cartForm.controls.unitPrice.setValue(10);
console.log(cartForm.controls.total.value); // 50 (5 * 10)

// The total updates automatically!
```

## React Component

```tsx title="src/components/CartForm/index.tsx"
import { useFormControl } from 'reformer';
import { cartForm } from './form';

export function CartForm() {
  const productName = useFormControl(cartForm.controls.productName);
  const quantity = useFormControl(cartForm.controls.quantity);
  const unitPrice = useFormControl(cartForm.controls.unitPrice);
  const total = useFormControl(cartForm.controls.total);

  return (
    <form>
      <div>
        <label htmlFor="productName">Product Name</label>
        <input
          id="productName"
          value={productName.value}
          onChange={(e) => productName.setValue(e.target.value)}
        />
      </div>

      <div>
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          value={quantity.value}
          onChange={(e) => quantity.setValue(Number(e.target.value))}
        />
      </div>

      <div>
        <label htmlFor="unitPrice">Unit Price ($)</label>
        <input
          id="unitPrice"
          type="number"
          step="0.01"
          value={unitPrice.value}
          onChange={(e) => unitPrice.setValue(Number(e.target.value))}
        />
      </div>

      <div>
        <label>Total</label>
        <strong>${total.value.toFixed(2)}</strong>
      </div>

      <button type="submit">Add to Cart</button>
    </form>
  );
}
```

## Multiple Dependencies

Computed fields can depend on multiple fields:

```typescript
interface InvoiceData {
  subtotal: number;
  taxRate: number;
  discount: number;
  total: number;
}

behaviors: (path, { use }) => [
  use(computed(
    path.total,
    [path.subtotal, path.taxRate, path.discount],
    (subtotal, taxRate, discount) => {
      const tax = subtotal * (taxRate / 100);
      return subtotal + tax - discount;
    }
  )),
]
```

## Computed from Nested Fields

You can compute values from nested structures:

```typescript
interface OrderData {
  customer: {
    firstName: string;
    lastName: string;
  };
  fullName: string; // Computed from nested fields
}

behaviors: (path, { use }) => [
  use(computed(
    path.fullName,
    [path.customer.firstName, path.customer.lastName],
    (firstName, lastName) => `${firstName} ${lastName}`.trim()
  )),
]
```

## Read-only Computed Fields

Computed fields are typically read-only in the UI:

```tsx
<div>
  <label>Full Name</label>
  <input
    value={fullName.value}
    readOnly
    disabled
  />
</div>

{/* Or just display it */}
<div>
  <label>Full Name</label>
  <strong>{fullName.value}</strong>
</div>
```

## Complex Calculations

Calculator functions can perform any computation:

```typescript
use(computed(
  path.discount,
  [path.subtotal, path.couponCode],
  (subtotal, couponCode) => {
    if (couponCode === 'SAVE10') return subtotal * 0.1;
    if (couponCode === 'SAVE20') return subtotal * 0.2;
    return 0;
  }
))
```

## Chaining Computed Fields

One computed field can depend on another:

```typescript
behaviors: (path, { use }) => [
  // First: compute subtotal
  use(computed(
    path.subtotal,
    [path.quantity, path.unitPrice],
    (quantity, unitPrice) => quantity * unitPrice
  )),

  // Then: compute tax based on subtotal
  use(computed(
    path.tax,
    [path.subtotal, path.taxRate],
    (subtotal, taxRate) => subtotal * (taxRate / 100)
  )),

  // Finally: compute total
  use(computed(
    path.total,
    [path.subtotal, path.tax],
    (subtotal, tax) => subtotal + tax
  )),
]
```

## Try It Out

1. Change the quantity → see the total update automatically
2. Change the unit price → total recalculates instantly
3. The total field is always in sync with its dependencies

## Key Concepts

- **`behaviors`** — function to define reactive behaviors
- **`computed(target, deps, calc)`** — creates computed field
- **`target`** — field to update automatically
- **`dependencies`** — fields to watch for changes
- **`calculator`** — function that computes the new value
- **Automatic updates** — computed fields update when dependencies change
- **Type-safe** — dependencies and calculator are fully typed

## What's Next?

In the next lesson, we'll learn about **Conditional Logic** — how to show/hide fields and change validation based on other field values.
