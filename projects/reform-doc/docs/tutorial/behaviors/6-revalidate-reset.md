---
sidebar_position: 6
---

# Revalidate and Reset

Revalidating and resetting fields with `revalidateWhen` and `resetWhen`.

## Overview

These behaviors help manage field state based on changes to other fields:

- **revalidateWhen** — Trigger validation when dependent fields change
- **resetWhen** — Reset field value when a condition becomes true

Common use cases:
- Revalidate amount when maximum limit changes
- Reset card number when payment type changes
- Revalidate confirmation password when main password changes
- Reset dependent field when parent selection changes

## revalidateWhen

The `revalidateWhen` behavior triggers validation on a field when any of the specified trigger fields change.

```typescript
import { revalidateWhen } from 'reformer/behaviors';

revalidateWhen(
  targetField,    // Field to revalidate
  triggerFields,  // Array of fields that trigger revalidation
  options         // { debounce?: number }
);
```

### Basic Example: Dependent Validation

Revalidate amount when maximum limit changes:

```typescript title="src/behaviors/amount-behavior.ts"
import { revalidateWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface OrderForm {
  maxAmount: number;
  amount: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // When maxAmount changes, revalidate amount
  revalidateWhen(path.amount, [path.maxAmount]);
};
```

With corresponding validation:

```typescript title="src/validators/order-validators.ts"
import { max } from 'reformer/validators';

export const orderValidation = (path: FieldPath<OrderForm>) => {
  // This validator will run again when maxAmount changes
  max(path.amount, (form) => form.maxAmount, {
    message: 'Amount exceeds limit',
  });
};
```

### Password Confirmation

Revalidate confirmation password when main password changes:

```typescript title="src/behaviors/password-behavior.ts"
interface PasswordForm {
  password: string;
  confirmPassword: string;
}

export const passwordBehavior: BehaviorSchemaFn<PasswordForm> = (path) => {
  // When password changes, revalidate confirmPassword
  revalidateWhen(path.confirmPassword, [path.password]);
};
```

With validation:

```typescript title="src/validators/password-validators.ts"
import { custom } from 'reformer/validators';

export const passwordValidation = (path: FieldPath<PasswordForm>) => {
  custom(path.confirmPassword, (value, form) => {
    if (value !== form.password) {
      return { code: 'passwords-mismatch', message: 'Passwords do not match' };
    }
    return true;
  });
};
```

### Credit Application Example

Revalidate income when monthly payment changes:

```typescript title="src/behaviors/credit-behavior.ts"
interface CreditForm {
  monthlyPayment: number;
  monthlyIncome: number;
  initialPayment: number;
  propertyValue: number;
}

export const creditBehavior: BehaviorSchemaFn<CreditForm> = (path) => {
  // Revalidate income when payment changes (income must be > 2× payment)
  revalidateWhen(path.monthlyIncome, [path.monthlyPayment]);

  // Revalidate initial payment when property value changes
  revalidateWhen(path.initialPayment, [path.propertyValue]);
};
```

### With Debounce

Debounce revalidation for performance:

```typescript title="src/behaviors/search-behavior.ts"
interface SearchForm {
  searchQuery: string;
  results: string[];
}

export const searchBehavior: BehaviorSchemaFn<SearchForm> = (path) => {
  revalidateWhen(path.results, [path.searchQuery], {
    debounce: 300, // Wait 300ms after last change
  });
};
```

## resetWhen

The `resetWhen` behavior resets a field to a specified value when a condition becomes true.

```typescript
import { resetWhen } from 'reformer/behaviors';

resetWhen(
  targetField,   // Field to reset
  condition,     // Function that returns true when field should reset
  options        // { resetValue?: T }
);
```

### Basic Example: Payment Type Switch

Reset card number when payment type is not "card":

```typescript title="src/behaviors/payment-behavior.ts"
import { resetWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface PaymentForm {
  paymentType: 'card' | 'cash' | 'transfer';
  cardNumber: string;
}

export const paymentBehavior: BehaviorSchemaFn<PaymentForm> = (path: FieldPath<PaymentForm>) => {
  // Reset card number when payment type is not "card"
  resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
    resetValue: '',
  });
};
```

### Reset to Custom Value

Reset to a specific value, not the initial value:

```typescript title="src/behaviors/discount-behavior.ts"
interface OrderForm {
  hasDiscount: boolean;
  discountPercent: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Reset discount to 0 when hasDiscount is false
  resetWhen(path.discountPercent, (form) => !form.hasDiscount, {
    resetValue: 0,
  });
};
```

### Reset Related Fields

Reset multiple related fields:

```typescript title="src/behaviors/address-behavior.ts"
interface AddressForm {
  country: string;
  region: string;
  city: string;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  // Reset region when country changes
  resetWhen(path.region, (form, prev) => form.country !== prev?.country, {
    resetValue: '',
  });

  // Reset city when region changes
  resetWhen(path.city, (form, prev) => form.region !== prev?.region, {
    resetValue: '',
  });
};
```

### Loan Type Switch

Reset loan-type-specific fields when loan type changes:

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  // Mortgage fields
  propertyValue: number;
  propertyType: string;
  // Car fields
  carBrand: string;
  carModel: string;
  carYear: number;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Reset mortgage fields when not mortgage
  resetWhen(path.propertyValue, (form) => form.loanType !== 'mortgage', {
    resetValue: 0,
  });
  resetWhen(path.propertyType, (form) => form.loanType !== 'mortgage', {
    resetValue: '',
  });

  // Reset car fields when not car loan
  resetWhen(path.carBrand, (form) => form.loanType !== 'car', {
    resetValue: '',
  });
  resetWhen(path.carModel, (form) => form.loanType !== 'car', {
    resetValue: '',
  });
  resetWhen(path.carYear, (form) => form.loanType !== 'car', {
    resetValue: 0,
  });
};
```

## Combining revalidateWhen and resetWhen

These behaviors work well together:

```typescript title="src/behaviors/order-behavior.ts"
interface OrderForm {
  orderType: 'standard' | 'express';
  maxWeight: number;
  weight: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Reset weight when order type changes
  resetWhen(path.weight, (form, prev) => form.orderType !== prev?.orderType, {
    resetValue: 0,
  });

  // Revalidate weight when maxWeight changes
  revalidateWhen(path.weight, [path.maxWeight]);
};
```

## Comparison: resetWhen vs enableWhen with resetOnDisable

Both approaches can reset fields, but they serve different purposes:

### enableWhen with resetOnDisable

```typescript
// Field is disabled AND reset when condition is false
enableWhen(path.cardNumber, (form) => form.paymentType === 'card', {
  resetOnDisable: true,
});
```

Use when:
- Field should be visually disabled
- User shouldn't interact with the field
- Field is part of a conditional section

### resetWhen

```typescript
// Field is reset when condition is true, but remains enabled
resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
  resetValue: '',
});
```

Use when:
- Field should remain enabled
- You only need to clear the value
- Field might be hidden via conditional rendering

## Best Practices

### 1. Debounce for Performance

```typescript
// ✅ Debounce when revalidation is triggered frequently
revalidateWhen(path.searchResults, [path.query], {
  debounce: 300,
});

// ❌ No debounce - revalidates on every keystroke
revalidateWhen(path.searchResults, [path.query]);
```

### 2. Provide Meaningful Reset Values

```typescript
// ✅ Reset to appropriate default
resetWhen(path.quantity, (form) => !form.hasItems, {
  resetValue: 1, // Minimum quantity
});

// ❌ Reset to undefined - may cause issues
resetWhen(path.quantity, (form) => !form.hasItems);
```

### 3. Consider User Experience

```typescript
// ✅ Only reset when necessary
resetWhen(path.city, (form, prev) => {
  // Only reset if region actually changed, not on initial load
  return prev !== undefined && form.region !== prev.region;
}, { resetValue: '' });

// ❌ Resets on every evaluation
resetWhen(path.city, (form) => form.region === '', {
  resetValue: '',
});
```

### 4. Combine with Conditional Rendering

```tsx
// Component
{paymentType === 'card' && (
  <FormField control={control.cardNumber} />
)}

// Behavior - reset when hidden
resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
  resetValue: '',
});
```

### 5. Order Matters

```typescript
// ✅ Reset first, then revalidate
resetWhen(path.amount, (form) => !form.hasAmount, { resetValue: 0 });
revalidateWhen(path.amount, [path.maxAmount]);

// This ensures the revalidation runs with the correct value
```

## When to Use Each Behavior

| Scenario | revalidateWhen | resetWhen |
|----------|----------------|-----------|
| Max limit changes | ✅ | - |
| Related field affects validation | ✅ | - |
| Clear field on type change | - | ✅ |
| Reset cascade (country → region → city) | - | ✅ |
| Confirmation field validation | ✅ | - |
| Clear form section | Consider | ✅ |

## Next Step

Now that you understand revalidation and reset behaviors, let's learn how to create custom behaviors for specific use cases.
