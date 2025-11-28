---
sidebar_position: 2
---

# Step 1: Loan Information Behaviors

Implementing interactivity for loan parameters: interest rate calculation, monthly payment, and conditional fields.

## Overview

For the first step of our Credit Application form, we need to add the following behaviors:

1. **Computed: Interest Rate** - Automatically calculate based on loan type, city, and property ownership
2. **Computed: Monthly Payment** - Calculate using the annuity formula
3. **Conditional Visibility: Mortgage Fields** - Show only for mortgage loans
4. **Conditional Visibility: Car Fields** - Show only for car loans
5. **Watch: Reset Fields** - Clear fields when loan type changes

## Creating the Behavior File

First, let's create the directory structure and behavior file for Step 1:

```bash
mkdir -p reform-tutorial/src/forms/credit-application/schemas/behaviors
touch reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts
```

## Implementing the Behaviors

### 1. File Setup

Start by importing the necessary functions and types:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
import { computeFrom, showWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, Address } from '@/types';

export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Behaviors will go here
};
```

### 2. Interest Rate Calculation

The interest rate depends on multiple factors:

- Base rate varies by loan type
- 0.5% discount for major cities (Moscow, St. Petersburg)
- 1.0% discount if applicant owns property

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ==========================================
  // Computed: Interest Rate
  // ==========================================
  computeFrom(
    // Source fields to watch
    [path.loanType, path.registrationAddress, path.hasProperty],
    // Target field to update
    path.interestRate,
    // Computation function
    (values) => {
      // Base rates by loan type
      const baseRates: Record<string, number> = {
        mortgage: 8.5,
        car: 12.0,
        consumer: 15.0,
        business: 18.0,
        refinancing: 14.0,
      };

      let rate = baseRates[values.loanType as string] || 15.0;

      // Discount for major cities
      const address = values.registrationAddress as Address;
      const city = address?.city || '';
      if (['Москва', 'Санкт-Петербург'].includes(city)) {
        rate -= 0.5;
      }

      // Discount for property collateral
      if (values.hasProperty) {
        rate -= 1.0;
      }

      // Minimum rate is 5%
      return Math.max(rate, 5.0);
    }
  );

  // ... more behaviors
};
```

**How it works:**

- `computeFrom` watches the source fields (`loanType`, `registrationAddress`, `hasProperty`)
- Whenever any of them changes, the computation function runs
- The result is automatically set to `interestRate`
- No manual subscriptions or cleanup needed

### 3. Monthly Payment Calculation

Calculate the monthly payment using the annuity formula:

```
P = A × (r × (1+r)^n) / ((1+r)^n - 1)

Where:
- P = monthly payment
- A = loan amount
- r = monthly interest rate (annual rate / 12 / 100)
- n = number of months
```

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous behaviors

  // ==========================================
  // Computed: Monthly Payment (Annuity Formula)
  // ==========================================
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const termMonths = values.loanTerm as number;
      const annualRate = values.interestRate as number;

      // Handle missing or invalid values
      if (!amount || !termMonths || !annualRate) return 0;
      if (amount <= 0 || termMonths <= 0 || annualRate <= 0) return 0;

      // Convert annual rate to monthly rate
      const monthlyRate = annualRate / 100 / 12;

      // Annuity formula: P = A * (r * (1+r)^n) / ((1+r)^n - 1)
      const factor = Math.pow(1 + monthlyRate, termMonths);
      const payment = (amount * (monthlyRate * factor)) / (factor - 1);

      // Round to nearest integer
      return Math.round(payment);
    }
  );

  // ... more behaviors
};
```

**Dependencies:**

- The monthly payment depends on `interestRate`
- `interestRate` is a computed field that updates automatically
- This creates a **dependency chain**: `loanType` → `interestRate` → `monthlyPayment`

:::tip Computed Field Chains
ReFormer handles computed field dependencies automatically. When `loanType` changes:

1. `interestRate` recalculates first
2. Then `monthlyPayment` recalculates (using the new rate)

You don't need to worry about the execution order!
:::

### 4. Conditional Visibility: Mortgage Fields

Show mortgage-specific fields only when `loanType === 'mortgage'`:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous behaviors

  // ==========================================
  // Conditional Visibility: Mortgage Fields
  // ==========================================
  showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  showWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');

  // ... more behaviors
};
```

**How it works:**

- `showWhen` watches the `loanType` field
- When `loanType === 'mortgage'`, the fields are shown
- When `loanType` changes to something else, the fields are hidden
- Hidden fields are not validated and not included in form submission

### 5. Conditional Visibility: Car Loan Fields

Similarly, show car-specific fields only for car loans:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous behaviors

  // ==========================================
  // Conditional Visibility: Car Loan Fields
  // ==========================================
  showWhen(path.carBrand, path.loanType, (value) => value === 'car');
  showWhen(path.carModel, path.loanType, (value) => value === 'car');
  showWhen(path.carYear, path.loanType, (value) => value === 'car');
  showWhen(path.carPrice, path.loanType, (value) => value === 'car');

  // ... more behaviors
};
```

### 6. Watch: Reset Fields on Loan Type Change

When the user changes loan type, we should clear the fields from the previous type to avoid confusion:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous behaviors

  // ==========================================
  // Watch: Reset Fields When Loan Type Changes
  // ==========================================
  watch(path.loanType, (value, { form }) => {
    // Clear mortgage fields if not mortgage
    if (value !== 'mortgage') {
      form.field(path.propertyValue).setValue(null, { emitEvent: false });
      form.field(path.initialPayment).setValue(null, { emitEvent: false });
    }

    // Clear car fields if not car loan
    if (value !== 'car') {
      form.field(path.carBrand).setValue('', { emitEvent: false });
      form.field(path.carModel).setValue('', { emitEvent: false });
      form.field(path.carYear).setValue(null, { emitEvent: false });
      form.field(path.carPrice).setValue(null, { emitEvent: false });
    }
  });
};
```

**Why `emitEvent: false`?**

- Prevents triggering additional behaviors and validation
- Avoids unnecessary re-renders
- The field values are being cleared programmatically, not by user input

:::caution Watch vs ComputeFrom
Use `watch` for **side effects** (clearing fields, logging, analytics).
Use `computeFrom` for **deriving values** from other fields.

Don't use `watch` to set field values that should be derived - use `computeFrom` instead!
:::

## Complete Code

Here's the complete behavior file for Step 1:

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/loan-info.ts"
import { computeFrom, showWhen, watch } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm, Address } from '@/types';

export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Computed: Interest Rate
  // ==========================================
  computeFrom(
    [path.loanType, path.registrationAddress, path.hasProperty],
    path.interestRate,
    (values) => {
      const baseRates: Record<string, number> = {
        mortgage: 8.5,
        car: 12.0,
        consumer: 15.0,
        business: 18.0,
        refinancing: 14.0,
      };

      let rate = baseRates[values.loanType as string] || 15.0;

      const address = values.registrationAddress as Address;
      const city = address?.city || '';
      if (['Москва', 'Санкт-Петербург'].includes(city)) {
        rate -= 0.5;
      }

      if (values.hasProperty) {
        rate -= 1.0;
      }

      return Math.max(rate, 5.0);
    }
  );

  // ==========================================
  // Computed: Monthly Payment
  // ==========================================
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      const amount = values.loanAmount as number;
      const termMonths = values.loanTerm as number;
      const annualRate = values.interestRate as number;

      if (!amount || !termMonths || !annualRate) return 0;
      if (amount <= 0 || termMonths <= 0 || annualRate <= 0) return 0;

      const monthlyRate = annualRate / 100 / 12;
      const factor = Math.pow(1 + monthlyRate, termMonths);
      const payment = (amount * (monthlyRate * factor)) / (factor - 1);

      return Math.round(payment);
    }
  );

  // ==========================================
  // Conditional Visibility: Mortgage Fields
  // ==========================================
  showWhen(path.propertyValue, path.loanType, (value) => value === 'mortgage');
  showWhen(path.initialPayment, path.loanType, (value) => value === 'mortgage');

  // ==========================================
  // Conditional Visibility: Car Loan Fields
  // ==========================================
  showWhen(path.carBrand, path.loanType, (value) => value === 'car');
  showWhen(path.carModel, path.loanType, (value) => value === 'car');
  showWhen(path.carYear, path.loanType, (value) => value === 'car');
  showWhen(path.carPrice, path.loanType, (value) => value === 'car');

  // ==========================================
  // Watch: Reset Fields
  // ==========================================
  watch(path.loanType, (value, { form }) => {
    if (value !== 'mortgage') {
      form.field(path.propertyValue).setValue(null, { emitEvent: false });
      form.field(path.initialPayment).setValue(null, { emitEvent: false });
    }

    if (value !== 'car') {
      form.field(path.carBrand).setValue('', { emitEvent: false });
      form.field(path.carModel).setValue('', { emitEvent: false });
      form.field(path.carYear).setValue(null, { emitEvent: false });
      form.field(path.carPrice).setValue(null, { emitEvent: false });
    }
  });
};
```

## Testing the Behaviors

To test these behaviors, you'll need to temporarily register them with your form. We'll cover the proper registration in a later section, but for now you can test by adding them directly:

```typescript title="src/schemas/create-form.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './credit-application.schema';
import { loanBehaviorSchema } from '../behaviors/steps/step-1-loan-info.behaviors';

export function createCreditApplicationForm() {
  return createForm({
    schema: creditApplicationSchema,
    behaviors: loanBehaviorSchema, // Temporary for testing
  });
}
```

### Test Scenarios

1. **Interest Rate Calculation:**
   - Select "Consumer Loan" → Rate should be 15%
   - Select "Mortgage" → Rate should be 8.5%
   - Change city to "Москва" → Rate should decrease by 0.5%
   - Check "I have property" → Rate should decrease by 1.0%

2. **Monthly Payment:**
   - Enter loan amount: 1,000,000
   - Enter term: 120 months (10 years)
   - Check that monthly payment calculates automatically
   - Change amount or term → Payment should recalculate

3. **Conditional Fields:**
   - Select "Mortgage" → Property value and initial payment fields appear
   - Select "Car Loan" → Car fields appear, mortgage fields disappear
   - Select "Consumer Loan" → All conditional fields disappear

4. **Field Reset:**
   - Select "Mortgage", fill in property value
   - Change to "Car Loan"
   - Change back to "Mortgage"
   - Check that property value was cleared

## Result

Now Step 1 of the form has:

- ✅ Automatic interest rate calculation with discounts
- ✅ Automatic monthly payment calculation
- ✅ Conditional mortgage fields (only visible for mortgage)
- ✅ Conditional car fields (only visible for car loans)
- ✅ Automatic field cleanup when switching loan types

The form is becoming smarter and more user-friendly!

## Key Takeaways

- `computeFrom` handles computed field chains automatically
- `showWhen` provides clean conditional visibility
- `watch` is for side effects, not derived values
- Use `{ emitEvent: false }` when clearing fields programmatically
- Behaviors eliminate manual subscription management

## Next Step

Now let's add behaviors for Step 2: Personal Information, where we'll compute the full name and age from personal data fields.
