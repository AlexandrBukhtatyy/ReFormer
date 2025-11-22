---
sidebar_position: 2
---

# Computed Fields

Automatically calculate field values from other fields.

## computeFrom

Calculate a field value based on one or more source fields.

```typescript
import { computeFrom } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  // Single source
  computeFrom(
    [path.price],
    path.priceWithTax,
    (price) => price * 1.2
  ),

  // Multiple sources
  computeFrom(
    [path.price, path.quantity, path.discount],
    path.total,
    (price, qty, discount) => (price * qty) - discount
  ),
]
```

### Example: Full Name

```typescript
const form = new GroupNode({
  schema: {
    firstName: new FieldNode({ value: '' }),
    lastName: new FieldNode({ value: '' }),
    fullName: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    computeFrom(
      [path.firstName, path.lastName],
      path.fullName,
      (first, last) => `${first} ${last}`.trim()
    ),
  ],
});

form.controls.firstName.setValue('John');
form.controls.lastName.setValue('Doe');
form.controls.fullName.value; // 'John Doe'
```

### Example: Loan Calculator

```typescript
const form = new GroupNode({
  schema: {
    principal: new FieldNode({ value: 10000 }),
    rate: new FieldNode({ value: 5 }),
    years: new FieldNode({ value: 10 }),
    monthlyPayment: new FieldNode({ value: 0 }),
  },
  behaviorSchema: (path, ctx) => [
    computeFrom(
      [path.principal, path.rate, path.years],
      path.monthlyPayment,
      (principal, rate, years) => {
        const monthlyRate = rate / 100 / 12;
        const months = years * 12;
        return (principal * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -months));
      }
    ),
  ],
});
```

## transformValue

Transform field value when it changes.

```typescript
import { transformValue } from 'reformer/behaviors';

behaviorSchema: (path, ctx) => [
  // Uppercase
  transformValue(path.code, (value) => value.toUpperCase()),

  // Format phone
  transformValue(path.phone, (value) =>
    value.replace(/\D/g, '').slice(0, 10)
  ),

  // Clamp number
  transformValue(path.quantity, (value) =>
    Math.max(1, Math.min(100, value))
  ),
]
```

### Example: Currency Input

```typescript
const form = new GroupNode({
  schema: {
    amount: new FieldNode({ value: '' }),
  },
  behaviorSchema: (path, ctx) => [
    transformValue(path.amount, (value) => {
      // Remove non-digits except decimal
      const cleaned = value.replace(/[^\d.]/g, '');
      // Ensure only one decimal point
      const parts = cleaned.split('.');
      if (parts.length > 2) {
        return parts[0] + '.' + parts.slice(1).join('');
      }
      // Limit decimal places
      if (parts[1]?.length > 2) {
        return parts[0] + '.' + parts[1].slice(0, 2);
      }
      return cleaned;
    }),
  ],
});
```

## Computed with Nested Fields

Access nested fields in computations:

```typescript
const form = new GroupNode({
  schema: {
    shipping: new GroupNode({
      schema: {
        method: new FieldNode({ value: 'standard' }),
        cost: new FieldNode({ value: 0 }),
      },
    }),
    subtotal: new FieldNode({ value: 100 }),
    total: new FieldNode({ value: 0 }),
  },
  behaviorSchema: (path, ctx) => [
    // Compute shipping cost
    computeFrom(
      [path.shipping.method],
      path.shipping.cost,
      (method) => method === 'express' ? 15 : 5
    ),

    // Compute total
    computeFrom(
      [path.subtotal, path.shipping.cost],
      path.total,
      (subtotal, shipping) => subtotal + shipping
    ),
  ],
});
```

## Next Steps

- [Conditional Logic](/docs/behaviors/conditional) — Show/hide, enable/disable
- [Field Sync](/docs/behaviors/sync) — Copy and sync fields
