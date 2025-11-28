---
sidebar_position: 8
---

# Combining & Registering Behaviors

Assembling all behaviors and integrating with the form.

## Overview

We've created behaviors for each step plus cross-step behaviors. Now let's:

1. Create the main behavior file that combines everything
2. Register behaviors with the form
3. Test that all behaviors work together
4. Review the complete file structure

## Creating the Main Behavior File

Create the main behavior file that imports and applies all step behaviors:

```bash
touch reform-tutorial/src/forms/credit-application/schemas/behaviors/credit-application.behaviors.ts
```

### Implementation

```typescript title="reform-tutorial/src/forms/credit-application/schemas/behaviors/credit-application.behaviors.ts"
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

// Import step behaviors
import { loanBehaviorSchema } from './steps/step-1-loan-info.behaviors';
import { personalBehaviorSchema } from './steps/step-2-personal-info.behaviors';
import { contactBehaviorSchema } from './steps/step-3-contact-info.behaviors';
import { employmentBehaviorSchema } from './steps/step-4-employment.behaviors';
import { additionalBehaviorSchema } from './steps/step-5-additional-info.behaviors';
import { crossStepBehaviorsSchema } from './cross-step.behaviors';

/**
 * Complete behavior schema for Credit Application Form
 *
 * Organized by form steps for maintainability:
 * - Step 1: Loan Information
 * - Step 2: Personal Information
 * - Step 3: Contact Information
 * - Step 4: Employment
 * - Step 5: Additional Information
 * - Cross-Step: Behaviors spanning multiple steps
 */
export const creditApplicationBehaviors: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Step 1: Loan Information
  // ==========================================
  loanBehaviorSchema(path);

  // ==========================================
  // Step 2: Personal Information
  // ==========================================
  personalBehaviorSchema(path);

  // ==========================================
  // Step 3: Contact Information
  // ==========================================
  contactBehaviorSchema(path);

  // ==========================================
  // Step 4: Employment
  // ==========================================
  employmentBehaviorSchema(path);

  // ==========================================
  // Step 5: Additional Information
  // ==========================================
  additionalBehaviorSchema(path);

  // ==========================================
  // Cross-Step Behaviors
  // ==========================================
  crossStepBehaviorsSchema(path);
};
```

## Registering with the Form

Update your form creation function to include behaviors:

```typescript title="src/schemas/create-form.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './credit-application.schema';
import { creditApplicationBehaviors } from '../behaviors/credit-application.behaviors';
import type { CreditApplicationForm } from '@/types';

export function createCreditApplicationForm() {
  return createForm<CreditApplicationForm>({
    schema: creditApplicationSchema,
    behaviors: creditApplicationBehaviors, // ← Register behaviors here
    // validation will be added in the next section
  });
}
```

That's it! Behaviors are now active when the form is created.

## Testing All Behaviors

Create a comprehensive test checklist:

### Step 1: Loan Information

- [ ] Interest rate updates when loan type changes
- [ ] Interest rate gets discount for major cities
- [ ] Interest rate gets discount for property owners
- [ ] Monthly payment calculates automatically
- [ ] Mortgage fields show only for mortgage
- [ ] Car fields show only for car loans
- [ ] Fields clear when switching loan types

### Step 2: Personal Information

- [ ] Full name generates from first, last, middle names
- [ ] Age calculates from birth date
- [ ] Both computed fields are disabled

### Step 3: Contact Information

- [ ] Residence address hides when "same as registration" checked
- [ ] Registration address copies to residence address
- [ ] Residence address disables when same as registration
- [ ] Manual changes to residence address work when unchecked

### Step 4: Employment

- [ ] Company fields show only for employed
- [ ] Business fields show only for self-employed
- [ ] Fields clear when switching employment status
- [ ] Total income calculates from main + additional

### Step 5: Additional Information

- [ ] Properties array shows only when checkbox checked
- [ ] Existing loans array shows only when checkbox checked
- [ ] Co-borrowers array shows only when checkbox checked
- [ ] Co-borrowers income sums all co-borrower incomes

### Cross-Step

- [ ] Payment-to-income ratio calculates correctly
- [ ] Loan fields disable when age < 18
- [ ] Monthly payment revalidates when income changes
- [ ] Analytics logs show in console

## Debugging Behaviors

If behaviors don't work as expected:

### 1. Check Console for Errors

```typescript
// Add debug logging to behaviors
export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  console.log('Registering Step 1 behaviors');

  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    (values) => {
      console.log('Computing monthly payment:', values);
      // ... computation
    }
  );
};
```

### 2. Verify Field Paths

Incorrect field paths cause behaviors to silently fail:

```typescript
// ❌ Wrong - typo in field name
computeFrom([path.loanAmmount], ...);

// ✅ Correct
computeFrom([path.loanAmount], ...);
```

### 3. Check Form Registration

Ensure behaviors are passed to `createForm`:

```typescript
// ❌ Forgot to add behaviors
createForm({
  schema: creditApplicationSchema,
});

// ✅ Behaviors registered
createForm({
  schema: creditApplicationSchema,
  behaviors: creditApplicationBehaviors,
});
```

### 4. Verify Component Integration

Make sure you're using the form with behaviors:

```tsx
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []); // ← Uses behaviors

  return <FormField control={form.monthlyPayment} />;
}
```

## Performance Considerations

Behaviors are optimized by ReFormer, but keep these in mind:

### 1. Avoid Expensive Computations

```typescript
// ❌ Bad - complex computation on every change
computeFrom([path.data], path.result, (values) => {
  return expensiveCalculation(values.data); // Runs on every change
});

// ✅ Better - debounce or memoize expensive operations
computeFrom([path.data], path.result, (values) => {
  return memoizedExpensiveCalculation(values.data);
});
```

### 2. Minimize Watch Side Effects

```typescript
// ❌ Bad - heavy side effect on every change
watch(path.field, (value) => {
  makeAPICall(value); // Triggered on every keystroke!
});

// ✅ Better - debounce API calls
watch(
  path.field,
  debounce((value) => {
    makeAPICall(value);
  }, 500)
);
```

### 3. Don't Create Circular Dependencies

```typescript
// ❌ Bad - circular dependency
computeFrom([path.a], path.b, ...);
computeFrom([path.b], path.a, ...); // Infinite loop!

// ✅ Good - one-way dependencies
computeFrom([path.a, path.b], path.c, ...);
```

## Summary

We've successfully implemented all behaviors for the Credit Application form:

### Step 1: Loan Information

- ✅ Interest rate calculation (base + discounts)
- ✅ Monthly payment calculation (annuity formula)
- ✅ Conditional mortgage/car fields
- ✅ Automatic field reset

### Step 2: Personal Information

- ✅ Full name generation (ФИО format)
- ✅ Age calculation from birth date

### Step 3: Contact Information

- ✅ Address copying (registration → residence)
- ✅ Conditional visibility/access

### Step 4: Employment

- ✅ Employment-specific fields
- ✅ Total income calculation
- ✅ Field reset on status change

### Step 5: Additional Information

- ✅ Conditional arrays (properties, loans, co-borrowers)
- ✅ Co-borrowers income calculation

### Cross-Step

- ✅ Payment-to-income ratio
- ✅ Smart revalidation
- ✅ Age-based access control
- ✅ Analytics tracking

## Key Achievements

1. **Declarative Logic** - No manual subscriptions, clean code
2. **Organized Structure** - Easy to find and modify behaviors
3. **Type Safety** - Full TypeScript support
4. **Maintainable** - Changes localized to specific files
5. **Testable** - Each behavior can be tested independently

## What's Next?

The form now has sophisticated interactivity, but it still needs validation to ensure data quality. In the next section (**Validation**), we'll add:

- Built-in validators (required, min, max, email, etc.)
- Conditional validation (rules that depend on other fields)
- Cross-field validation (payment <= 50% income)
- Async validation (server-side checks)
- Array validation (properties, loans, co-borrowers)

The behaviors we've created will work seamlessly with validation rules!
