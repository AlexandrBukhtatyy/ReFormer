---
sidebar_position: 8
---

# Combining & Registering Validation

Assembling all validators and integrating with the form.

## Overview

We've created validators for each step plus cross-step validation. Now let's:

1. Create the main validation file that combines everything
2. Register validation with the form
3. Test that all validation works together
4. Review the complete file structure

## Creating the Main Validation File

Create the main validation file that imports and applies all step validators:

```bash
touch src/schemas/validators/credit-application.validators.ts
```

### Implementation

```typescript title="src/schemas/validators/credit-application.validators.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

// Import step validators
import { step1LoanValidation } from './steps/step-1-loan-info.validators';
import { step2PersonalValidation } from './steps/step-2-personal-info.validators';
import { step3ContactValidation } from './steps/step-3-contact-info.validators';
import { step4EmploymentValidation } from './steps/step-4-employment.validators';
import { step5AdditionalValidation } from './steps/step-5-additional-info.validators';
import { crossStepValidation } from './cross-step.validators';

/**
 * Complete validation schema for Credit Application Form
 *
 * Organized by form steps for maintainability:
 * - Step 1: Loan Information
 * - Step 2: Personal Information
 * - Step 3: Contact Information
 * - Step 4: Employment
 * - Step 5: Additional Information
 * - Cross-Step: Validation spanning multiple steps
 */
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Step 1: Loan Information
  // ==========================================
  step1LoanValidation(path);

  // ==========================================
  // Step 2: Personal Information
  // ==========================================
  step2PersonalValidation(path);

  // ==========================================
  // Step 3: Contact Information
  // ==========================================
  step3ContactValidation(path);

  // ==========================================
  // Step 4: Employment
  // ==========================================
  step4EmploymentValidation(path);

  // ==========================================
  // Step 5: Additional Information
  // ==========================================
  step5AdditionalValidation(path);

  // ==========================================
  // Cross-Step Validation
  // ==========================================
  crossStepValidation(path);
};
```

## Registering with the Form

Update your form creation function to include validation:

```typescript title="src/schemas/create-form.ts"
import { createForm } from 'reformer';
import { creditApplicationSchema } from './credit-application.schema';
import { creditApplicationBehaviors } from '../behaviors/credit-application.behaviors';
import { creditApplicationValidation } from '../validators/credit-application.validators';
import type { CreditApplicationForm } from '@/types';

export function createCreditApplicationForm() {
  return createForm<CreditApplicationForm>({
    schema: creditApplicationSchema,
    behaviors: creditApplicationBehaviors,
    validation: creditApplicationValidation, // ← Register validation here
  });
}
```

That's it! Validation is now active when the form is created.

## File Structure

Your project should now have this structure:

```
src/
├── schemas/
│   ├── validators/
│   │   ├── steps/
│   │   │   ├── step-1-loan-info.validators.ts
│   │   │   ├── step-2-personal-info.validators.ts
│   │   │   ├── step-3-contact-info.validators.ts
│   │   │   ├── step-4-employment.validators.ts
│   │   │   └── step-5-additional-info.validators.ts
│   │   ├── cross-step.validators.ts
│   │   └── credit-application.validators.ts  ← Main file
│   ├── behaviors/
│   │   ├── steps/
│   │   │   ├── loan-info.ts
│   │   │   ├── personal-info.ts
│   │   │   ├── contact-info.ts
│   │   │   ├── employment.ts
│   │   │   └── additional-info.ts
│   │   ├── cross-step.behaviors.ts
│   │   └── credit-application.behaviors.ts
│   ├── credit-application.ts
│   └── create-form.ts  ← Validation registered here
│
├── components/
│   ├── forms/
│   │   └── createCreditApplicationForm.ts
│   ├── steps/
│   ├── nested-forms/
│   └── CreditApplicationForm.tsx
│
└── types/
    └── credit-application.ts
```

## Testing All Validation

Create a comprehensive test checklist:

### Step 1: Loan Information

- [ ] Required fields (loanType, loanAmount, loanTerm, loanPurpose)
- [ ] Numeric ranges (amount 50k-10M, term 6-360 months)
- [ ] String length (purpose 10-500 chars)
- [ ] Conditional mortgage fields (propertyValue, initialPayment)
- [ ] Conditional car loan fields (brand, model, year, price)

### Step 2: Personal Information

- [ ] Required names with Cyrillic pattern
- [ ] Birth date not in future
- [ ] Age 18-70 validation
- [ ] Passport series (4 digits) and number (6 digits)
- [ ] Passport issue date validation
- [ ] INN (10 or 12 digits) and SNILS (11 digits)

### Step 3: Contact Information

- [ ] Required main phone and email
- [ ] Optional additional phone and email (validated if provided)
- [ ] Required registration address fields
- [ ] Conditional residence address (when sameAsRegistration = false)
- [ ] Postal code format (6 digits)

### Step 4: Employment

- [ ] Required employment status
- [ ] Required monthly income (min 10,000)
- [ ] Conditional company fields (when employed)
- [ ] Work experience >= 3 months (when employed)
- [ ] Conditional business fields (when self-employed)
- [ ] Business experience >= 6 months (when self-employed)

### Step 5: Additional Information

- [ ] Properties array (min 1 when hasProperty, max 10)
- [ ] Property element validation (type, description, value)
- [ ] Existing loans array (min 1 when hasExistingLoans, max 20)
- [ ] Loan element validation (bank, amount, payment)
- [ ] Co-borrowers array (min 1 when hasCoBorrower, max 5)
- [ ] Co-borrower element validation (name, email, phone, income)

### Cross-Step

- [ ] Down payment >= 20% of property value
- [ ] Monthly payment <= 50% of household income
- [ ] Loan amount <= car price
- [ ] Remaining loan <= original loan amount
- [ ] Age validation on computed field
- [ ] Async INN verification (shows loading, validates)
- [ ] Async SNILS verification
- [ ] Async email uniqueness check

## Debugging Validation

If validation doesn't work as expected:

### 1. Check Console for Errors

```typescript
// Add debug logging to validators
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  console.log('Registering Step 1 validation');

  required(path.loanAmount, { message: 'Loan amount is required' });
  console.log('Added required validator for loanAmount');
};
```

### 2. Verify Field Paths

Incorrect field paths cause validation to silently fail:

```typescript
// ❌ Wrong - typo in field name
required(path.loanAmmount, { message: '...' });

// ✅ Correct
required(path.loanAmount, { message: '...' });
```

### 3. Check Form Registration

Ensure validation is passed to `createForm`:

```typescript
// ❌ Forgot to add validation
createForm({
  schema: creditApplicationSchema,
  behaviors: creditApplicationBehaviors,
});

// ✅ Validation registered
createForm({
  schema: creditApplicationSchema,
  behaviors: creditApplicationBehaviors,
  validation: creditApplicationValidation,
});
```

### 4. Verify Component Integration

Make sure you're using the form with validation:

```tsx
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []); // ← Uses validation

  return <FormField control={form.loanAmount} />;
}
```

### 5. Check Field Status

Debug field validation state:

```tsx
function DebugField({ control }: { control: FieldNode<any> }) {
  const errors = control.errors.value;
  const isValid = control.isValid.value;
  const isValidating = control.isValidating.value;

  console.log('Field errors:', errors);
  console.log('Is valid:', isValid);
  console.log('Is validating:', isValidating);

  return <FormField control={control} />;
}
```

## Validation Execution Order

Understanding when validation runs:

### 1. On Field Change

```typescript
form.field('loanAmount').setValue(100000);
// → Triggers all validators for loanAmount
// → Triggers validators that depend on loanAmount
```

### 2. On Dependency Change

```typescript
form.field('loanType').setValue('mortgage');
// → Re-runs conditional validators:
//    - requiredWhen for propertyValue
//    - requiredWhen for initialPayment
//    - Cross-step down payment validator
```

### 3. On Form Submit

```typescript
// Mark all fields as touched
form.touchAll();

// Get current form values
const data = form.getValue();

// Check if form is valid before sending
if (form.valid.value) {
  console.log('Valid data:', data);
} else {
  console.log('Validation errors - check form.errors.value');
}
```

### 4. Manual Validation

```typescript
// Validate single field
await form.field('loanAmount').validate();

// Validate entire form
await form.validate();

// Validate specific step
await form.group('step1').validate();
```

## Performance Considerations

Validation is optimized by ReFormer, but keep these in mind:

### 1. Avoid Expensive Sync Validators

```typescript
// ❌ Bad - expensive operation on every change
createValidator(path.field, [], (value) => {
  return expensiveCalculation(value); // Runs on every keystroke!
});

// ✅ Better - keep sync validators fast
createValidator(path.field, [], (value) => {
  return quickCheck(value);
});
```

### 2. Use Debouncing for Async Validators

```typescript
// ❌ Bad - API call on every keystroke
createAsyncValidator(path.inn, async (inn) => {
  return await fetch(`/api/validate/inn?value=${inn}`);
});

// ✅ Good - debounced API calls
createAsyncValidator(
  path.inn,
  async (inn) => {
    return await fetch(`/api/validate/inn?value=${inn}`);
  },
  { debounce: 500 } // ← Debounce
);
```

### 3. Minimize Dependencies

```typescript
// ❌ Bad - unnecessary dependencies
createValidator(
  path.field,
  [path.a, path.b, path.c, path.d, path.e], // Too many!
  (value, deps) => {
    /* ... */
  }
);

// ✅ Good - only necessary dependencies
createValidator(
  path.field,
  [path.dependency], // Only what's needed
  (value, [dep]) => {
    /* ... */
  }
);
```

### 4. Don't Create Circular Dependencies

```typescript
// ❌ Bad - circular dependency
createValidator(path.a, [path.b], (a, [b]) => {
  /* ... */
});
createValidator(path.b, [path.a], (b, [a]) => {
  /* ... */
}); // Infinite loop!

// ✅ Good - one-way dependencies
createValidator(path.a, [], (a) => {
  /* ... */
});
createValidator(path.b, [path.a], (b, [a]) => {
  /* ... */
});
```

## Accessing Validation State

### In Components

```tsx
import { useField } from 'reformer/react';

function FormField({ control }) {
  const field = useField(control);

  return (
    <div>
      <input value={field.value ?? ''} onChange={(e) => control.setValue(e.target.value)} />

      {/* Show errors */}
      {field.errors.length > 0 && (
        <div className="error">
          {field.errors.map((error) => (
            <div key={error.type}>{error.message}</div>
          ))}
        </div>
      )}

      {/* Show loading for async validation */}
      {field.isValidating && <span>Validating...</span>}
    </div>
  );
}
```

### In Form Logic

```typescript
const form = createCreditApplicationForm();

// Check if form is valid
const isValid = form.isValid.value;

// Get all errors
const errors = form.errors.value;

// Check specific field
const loanAmountErrors = form.field('loanAmount').errors.value;

// Subscribe to validation changes
form.isValid.subscribe((valid) => {
  console.log('Form valid:', valid);
});
```

## Summary

We've successfully implemented complete validation for the Credit Application form:

### Step 1: Loan Information

- ✅ Required fields and numeric ranges
- ✅ String length validation
- ✅ Conditional mortgage/car loan fields

### Step 2: Personal Information

- ✅ Name validation with Cyrillic pattern
- ✅ Birth date and age validation
- ✅ Passport format validation
- ✅ INN and SNILS patterns

### Step 3: Contact Information

- ✅ Email and phone format validation
- ✅ Required address fields
- ✅ Conditional residence address

### Step 4: Employment

- ✅ Required income and status
- ✅ Conditional employment fields
- ✅ Conditional self-employment fields
- ✅ Work/business experience minimums

### Step 5: Additional Information

- ✅ Array length validation
- ✅ Array element validation
- ✅ Nested object validation in arrays

### Cross-Step

- ✅ Down payment >= 20% validation
- ✅ Monthly payment <= 50% income
- ✅ Loan amount <= car price
- ✅ Remaining loan <= original amount
- ✅ Age validation
- ✅ Async INN verification
- ✅ Async SNILS verification
- ✅ Async email uniqueness

## Key Achievements

1. **Declarative Validation** - Clear, maintainable validation rules
2. **Organized Structure** - Easy to find and modify validators
3. **Type Safety** - Full TypeScript support
4. **Conditional Logic** - Dynamic validation based on form state
5. **Cross-Field** - Complex business rules across multiple fields
6. **Async Support** - Server-side validation with debouncing
7. **Works with Behaviors** - Perfect synchronization

## Validation vs Behaviors

Our form now has both:

| Feature       | Behaviors                                               | Validation                                                 |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| Purpose       | Automate interactions                                   | Ensure data quality                                        |
| When runs     | On field changes                                        | On field changes + submit                                  |
| Examples      | - Show/hide fields<br/>- Compute values<br/>- Copy data | - Required fields<br/>- Format checks<br/>- Business rules |
| User feedback | Visual changes                                          | Error messages                                             |

They work together:

- Behaviors **hide** fields → Validation **skips** them
- Behaviors **compute** values → Validation **checks** them
- Behaviors **enable/disable** → Validation respects state

## What's Next?

The form now has sophisticated validation, but we still need to handle data flow and submission. In the next sections, we'll cover:

### Data Flow (Next Section)

- Loading initial form data
- Saving form progress (auto-save)
- Resetting form state
- Cloning and duplicating forms

### Submission (Following Section)

- Handling form submission
- Server communication
- Success and error handling
- Optimistic updates
- Retry logic

The validation we've created will seamlessly integrate with these features!
