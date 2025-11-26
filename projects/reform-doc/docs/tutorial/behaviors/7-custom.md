---
sidebar_position: 7
---

# Custom Behaviors

Creating custom behaviors for domain-specific logic.

## Overview

While ReFormer provides many built-in behaviors, you may need custom behaviors for:

- Domain-specific business logic
- Complex multi-field interactions
- Integration with external services
- Reusable patterns across forms

This guide shows how to create custom behaviors using the same patterns as built-in ones.

## Behavior Structure

A behavior is a function that receives the form context and sets up reactive effects:

```typescript
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface MyForm {
  field1: string;
  field2: string;
}

// Custom behavior function
export const myCustomBehavior: BehaviorSchemaFn<MyForm> = (path: FieldPath<MyForm>) => {
  // Set up reactive effects using built-in behaviors
  watchField(path.field1, (value, ctx) => {
    // Custom logic here
  });
};
```

## Creating Custom Behaviors

### Example 1: Auto-Complete Behavior

Create a behavior that auto-completes a field based on another field's value:

```typescript title="src/behaviors/auto-complete-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface AddressForm {
  postalCode: string;
  city: string;
  region: string;
}

// API function to lookup address by postal code
async function lookupAddress(postalCode: string) {
  const response = await fetch(`/api/address/${postalCode}`);
  return response.json();
}

export const autoCompleteAddressBehavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
  watchField(
    path.postalCode,
    async (postalCode, ctx) => {
      // Only lookup when postal code is complete (6 digits)
      if (postalCode?.length === 6) {
        try {
          const address = await lookupAddress(postalCode);
          if (address.city) {
            ctx.form.city.setValue(address.city);
          }
          if (address.region) {
            ctx.form.region.setValue(address.region);
          }
        } catch (error) {
          console.error('Address lookup failed:', error);
        }
      }
    },
    { immediate: false, debounce: 500 }
  );
};
```

### Example 2: Calculation Behavior

Create a behavior for complex financial calculations:

```typescript title="src/behaviors/finance-behavior.ts"
import { computeFrom, watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface LoanForm {
  principal: number;
  annualRate: number;
  termYears: number;
  monthlyPayment: number;
  totalInterest: number;
  totalCost: number;
}

// Calculate monthly payment using annuity formula
function calculateMonthlyPayment(principal: number, annualRate: number, termYears: number): number {
  if (!principal || !annualRate || !termYears) return 0;

  const monthlyRate = annualRate / 100 / 12;
  const termMonths = termYears * 12;

  if (monthlyRate === 0) return principal / termMonths;

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

export const loanCalculationBehavior: BehaviorSchemaFn<LoanForm> = (path: FieldPath<LoanForm>) => {
  // Calculate monthly payment
  computeFrom(
    [path.principal, path.annualRate, path.termYears],
    path.monthlyPayment,
    (values) => {
      const principal = values.principal as number;
      const rate = values.annualRate as number;
      const term = values.termYears as number;
      return Math.round(calculateMonthlyPayment(principal, rate, term) * 100) / 100;
    }
  );

  // Calculate total interest
  computeFrom(
    [path.monthlyPayment, path.termYears, path.principal],
    path.totalInterest,
    (values) => {
      const monthly = values.monthlyPayment as number;
      const term = values.termYears as number;
      const principal = values.principal as number;
      return Math.round((monthly * term * 12 - principal) * 100) / 100;
    }
  );

  // Calculate total cost
  computeFrom(
    [path.principal, path.totalInterest],
    path.totalCost,
    (values) => {
      const principal = values.principal as number;
      const interest = values.totalInterest as number;
      return principal + interest;
    }
  );
};
```

### Example 3: Validation Behavior

Create a behavior that performs cross-field validation:

```typescript title="src/behaviors/date-range-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface DateRangeForm {
  startDate: string;
  endDate: string;
}

export const dateRangeBehavior: BehaviorSchemaFn<DateRangeForm> = (path: FieldPath<DateRangeForm>) => {
  // Validate end date when start date changes
  watchField(path.startDate, (startDate, ctx) => {
    const endDate = ctx.form.endDate.value.value;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        ctx.form.endDate.setErrors([
          { code: 'invalid-range', message: 'End date must be after start date' }
        ]);
      } else {
        ctx.form.endDate.clearErrors({ code: 'invalid-range' });
      }
    }
  });

  // Validate start date when end date changes
  watchField(path.endDate, (endDate, ctx) => {
    const startDate = ctx.form.startDate.value.value;

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end < start) {
        ctx.form.endDate.setErrors([
          { code: 'invalid-range', message: 'End date must be after start date' }
        ]);
      } else {
        ctx.form.endDate.clearErrors({ code: 'invalid-range' });
      }
    }
  });
};
```

### Example 4: Loading State Behavior

Create a behavior that manages loading states:

```typescript title="src/behaviors/loading-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface SearchForm {
  query: string;
  results: string[];
  isLoading: boolean;
}

export const searchBehavior: BehaviorSchemaFn<SearchForm> = (path: FieldPath<SearchForm>) => {
  watchField(
    path.query,
    async (query, ctx) => {
      if (!query || query.length < 3) {
        ctx.form.results.setValue([]);
        return;
      }

      // Set loading state
      ctx.form.isLoading.setValue(true);

      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const results = await response.json();
        ctx.form.results.setValue(results);
      } catch (error) {
        ctx.form.results.setValue([]);
        console.error('Search failed:', error);
      } finally {
        // Clear loading state
        ctx.form.isLoading.setValue(false);
      }
    },
    { immediate: false, debounce: 300 }
  );
};
```

## Composing Behaviors

You can compose multiple behaviors together:

```typescript title="src/behaviors/order-behavior.ts"
import { type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';
import { pricingBehavior } from './pricing-behavior';
import { discountBehavior } from './discount-behavior';
import { shippingBehavior } from './shipping-behavior';

interface OrderForm {
  // ... order fields
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // Apply pricing calculations
  pricingBehavior(path);

  // Apply discount logic
  discountBehavior(path);

  // Apply shipping calculations
  shippingBehavior(path);
};
```

## Creating Generic Behaviors

Create behaviors that work with any form type:

```typescript title="src/behaviors/generic-behaviors.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

/**
 * Generic behavior to sync two fields of the same type
 */
export function createSyncBehavior<T extends object, K extends keyof T>(
  field1Key: K,
  field2Key: K
): BehaviorSchemaFn<T> {
  return (path: FieldPath<T>) => {
    const field1 = path[field1Key];
    const field2 = path[field2Key];

    watchField(field1, (value, ctx) => {
      const otherValue = (ctx.form as any)[field2Key].value.value;
      if (value !== otherValue) {
        (ctx.form as any)[field2Key].setValue(value);
      }
    });

    watchField(field2, (value, ctx) => {
      const otherValue = (ctx.form as any)[field1Key].value.value;
      if (value !== otherValue) {
        (ctx.form as any)[field1Key].setValue(value);
      }
    });
  };
}

/**
 * Generic behavior to format a string field
 */
export function createFormatBehavior<T extends object, K extends keyof T>(
  fieldKey: K,
  formatter: (value: string) => string
): BehaviorSchemaFn<T> {
  return (path: FieldPath<T>) => {
    const field = path[fieldKey];

    watchField(field, (value, ctx) => {
      const formatted = formatter(String(value || ''));
      if (formatted !== value) {
        (ctx.form as any)[fieldKey].setValue(formatted);
      }
    }, { immediate: false });
  };
}
```

Usage:

```typescript title="src/behaviors/user-behavior.ts"
import { createFormatBehavior } from './generic-behaviors';

interface UserForm {
  phone: string;
  email: string;
}

// Format phone number
const phoneBehavior = createFormatBehavior<UserForm, 'phone'>(
  'phone',
  (value) => value.replace(/\D/g, '').slice(0, 10)
);

// Lowercase email
const emailBehavior = createFormatBehavior<UserForm, 'email'>(
  'email',
  (value) => value.toLowerCase()
);

export const userBehavior: BehaviorSchemaFn<UserForm> = (path) => {
  phoneBehavior(path);
  emailBehavior(path);
};
```

## Using Context Methods

The callback context provides several useful methods:

```typescript
watchField(path.field, (value, ctx) => {
  // Access form fields
  ctx.form.otherField.setValue('value');
  ctx.form.otherField.getValue();
  ctx.form.otherField.reset();

  // Update component props
  ctx.form.otherField.updateComponentProps({ disabled: true });

  // Manage errors
  ctx.form.otherField.setErrors([{ code: 'custom', message: 'Error' }]);
  ctx.form.otherField.clearErrors({ code: 'custom' });

  // Set field value by path string
  ctx.setFieldValue('nested.field', 'value');
});
```

## Best Practices

### 1. Keep Behaviors Focused

```typescript
// ✅ Single responsibility
export const priceBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  computeFrom([path.price, path.quantity], path.subtotal, ...);
};

export const discountBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  computeFrom([path.subtotal, path.discount], path.total, ...);
};

// ❌ Too many responsibilities
export const everythingBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Pricing, discounts, shipping, validation, API calls...
};
```

### 2. Use Debounce for Expensive Operations

```typescript
// ✅ Debounce API calls
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
}, { debounce: 300 });

// ❌ No debounce - fires on every keystroke
watchField(path.search, async (query, ctx) => {
  const results = await searchAPI(query);
  // ...
});
```

### 3. Handle Errors Gracefully

```typescript
// ✅ Error handling
watchField(path.region, async (region, ctx) => {
  try {
    const cities = await fetchCities(region);
    ctx.form.city.updateComponentProps({ options: cities });
  } catch (error) {
    console.error('Failed to load cities:', error);
    ctx.form.city.updateComponentProps({ options: [] });
  }
}, { immediate: false });

// ❌ No error handling - crashes on failure
watchField(path.region, async (region, ctx) => {
  const cities = await fetchCities(region);
  ctx.form.city.updateComponentProps({ options: cities });
}, { immediate: false });
```

### 4. Document Your Behaviors

```typescript
/**
 * Behavior for cascading address fields
 *
 * Features:
 * - Loads cities when region changes
 * - Clears city when region changes
 * - Auto-formats postal code
 *
 * @example
 * const form = new GroupNode({
 *   form: addressSchema,
 *   behavior: addressBehavior,
 * });
 */
export const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  // Implementation...
};
```

### 5. Test Your Behaviors

```typescript
// behaviors/__tests__/address-behavior.test.ts
import { GroupNode } from 'reformer';
import { addressBehavior } from '../address-behavior';

describe('addressBehavior', () => {
  it('should clear city when region changes', () => {
    const form = new GroupNode({
      form: addressSchema,
      behavior: addressBehavior,
    });

    form.city.setValue('Moscow');
    form.region.setValue('new-region');

    expect(form.city.getValue()).toBe('');
  });
});
```

## Next Step

Now that you understand custom behaviors, let's learn how to create reusable behavior schemas that can be shared across multiple forms.
