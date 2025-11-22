---
sidebar_position: 2
---

# Computed Fields

Automatically calculate field values from other fields.

## computeFrom

Calculate a field value based on one or more source fields.

```typescript
import { computeFrom } from 'reformer/behaviors';

behavior: (path) => {
  // Single source
  computeFrom(
    [path.price],
    path.priceWithTax,
    ({ price }) => price * 1.2
  );

  // Multiple sources
  computeFrom(
    [path.price, path.quantity, path.discount],
    path.total,
    ({ price, quantity, discount }) => (price * quantity) - discount
  );
}
```

### Example: Full Name

```typescript
const form = new GroupNode({
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    fullName: { value: '' },
  },
  behavior: (path) => {
    computeFrom(
      [path.firstName, path.lastName],
      path.fullName,
      ({ firstName, lastName }) => `${firstName} ${lastName}`.trim()
    );
  },
});

form.firstName.setValue('John');
form.lastName.setValue('Doe');
form.fullName.value.value; // 'John Doe'
```

### Example: Loan Calculator

```typescript
const form = new GroupNode({
  form: {
    principal: { value: 10000 },
    rate: { value: 5 },
    years: { value: 10 },
    monthlyPayment: { value: 0 },
  },
  behavior: (path) => {
    computeFrom(
      [path.principal, path.rate, path.years],
      path.monthlyPayment,
      ({ principal, rate, years }) => {
        const monthlyRate = rate / 100 / 12;
        const months = years * 12;
        return (principal * monthlyRate) /
          (1 - Math.pow(1 + monthlyRate, -months));
      }
    );
  },
});
```

## transformValue

Transform field value when it changes.

```typescript
import { transformValue } from 'reformer/behaviors';

behavior: (path) => {
  // Uppercase
  transformValue(path.code, (value) => value.toUpperCase());

  // Format phone
  transformValue(path.phone, (value) =>
    value.replace(/\D/g, '').slice(0, 10)
  );

  // Clamp number
  transformValue(path.quantity, (value) =>
    Math.max(1, Math.min(100, value))
  );
}
```

### Example: Currency Input

```typescript
const form = new GroupNode({
  form: {
    amount: { value: '' },
  },
  behavior: (path) => {
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
    });
  },
});
```

## Computed with Nested Fields

Access nested fields in computations:

```typescript
const form = new GroupNode({
  form: {
    shipping: {
      method: { value: 'standard' },
      cost: { value: 0 },
    },
    subtotal: { value: 100 },
    total: { value: 0 },
  },
  behavior: (path) => {
    // Compute shipping cost
    computeFrom(
      [path.shipping.method],
      path.shipping.cost,
      ({ method }) => method === 'express' ? 15 : 5
    );

    // Compute total
    computeFrom(
      [path.subtotal, path.shipping.cost],
      path.total,
      ({ subtotal, cost }) => subtotal + cost
    );
  },
});
```

## Next Steps

- [Conditional Logic](/docs/behaviors/conditional) — Show/hide, enable/disable
- [Field Sync](/docs/behaviors/sync) — Copy and sync fields
