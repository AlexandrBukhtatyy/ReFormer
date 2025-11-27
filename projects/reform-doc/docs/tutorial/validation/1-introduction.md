---
sidebar_position: 1
---

# Introduction to Validation

Adding data quality checks to our credit application form.

## What is Validation?

Validation ensures data quality and business rules before submission. It provides declarative ways to:

- **Required Fields** - Ensure critical data is provided
- **Format Validation** - Check email, phone, pattern formats
- **Range Validation** - Enforce min/max boundaries
- **Conditional Rules** - Apply validation based on other fields
- **Cross-Field Validation** - Check relationships between fields
- **Async Validation** - Verify data with server-side checks

## Why Use Validation?

Instead of imperative validation code:

```tsx
// ❌ Imperative approach - manual checks
function validateForm(formData) {
  const errors = {};

  if (!formData.loanAmount) {
    errors.loanAmount = 'Loan amount is required';
  } else if (formData.loanAmount < 50000) {
    errors.loanAmount = 'Minimum amount: 50,000';
  } else if (formData.loanAmount > 10000000) {
    errors.loanAmount = 'Maximum amount: 10,000,000';
  }

  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(formData.email)) {
    errors.email = 'Invalid email format';
  }

  // More validation...
  // This quickly becomes unmanageable!

  return errors;
}
```

Use declarative validation:

```tsx
// ✅ Declarative approach - validation schema
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum amount: 50,000' });
  max(path.loanAmount, 10000000, { message: 'Maximum amount: 10,000,000' });

  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
};
```

Benefits:
- **Less Code** - Concise validation rules
- **Declarative** - Clear intent and easy to read
- **Maintainable** - Changes are localized
- **Type-Safe** - Full TypeScript support
- **Testable** - Easy to test in isolation
- **Works with Behaviors** - Hidden fields aren't validated

## Types of Validators

ReFormer provides several categories of validators:

### Built-in Validators

Basic validation for common scenarios:

```typescript
import { required, min, max, minLength, maxLength } from 'reformer/validators';

// Required field
required(path.loanAmount, { message: 'Loan amount is required' });

// Numeric boundaries
min(path.loanAmount, 50000, { message: 'Minimum: 50,000' });
max(path.loanAmount, 10000000, { message: 'Maximum: 10,000,000' });

// String length
minLength(path.loanPurpose, 10, { message: 'Minimum 10 characters' });
maxLength(path.loanPurpose, 500, { message: 'Maximum 500 characters' });
```

### Format Validators

Validate common formats:

```typescript
import { email, phone, pattern } from 'reformer/validators';

// Email format
email(path.email, { message: 'Invalid email format' });

// Phone format
phone(path.phoneMain, { message: 'Invalid phone format' });

// Custom pattern (Russian passport)
pattern(path.passportData.series, /^\d{4}$/, {
  message: 'Series must be 4 digits',
});
```

### Conditional Validators

Apply validation based on other fields:

```typescript
import { requiredWhen, minWhen, maxWhen } from 'reformer/validators';

// Required when condition is true
requiredWhen(
  path.propertyValue,
  path.loanType,
  (loanType) => loanType === 'mortgage',
  { message: 'Property value is required for mortgage' }
);

// Min/max when condition is true
minWhen(
  path.propertyValue,
  1000000,
  path.loanType,
  (loanType) => loanType === 'mortgage',
  { message: 'Minimum property value: 1,000,000' }
);
```

### Array Validators

Validate arrays and their elements:

```typescript
import { arrayMinLength, arrayMaxLength, arrayMinLengthWhen } from 'reformer/validators';

// Array length validation
arrayMinLengthWhen(
  path.properties,
  1,
  path.hasProperty,
  (has) => has === true,
  { message: 'Add at least one property' }
);

arrayMaxLength(path.properties, 10, { message: 'Maximum 10 properties' });

// Validate array elements using '*' wildcard
required(path.properties['*'].type, { message: 'Property type is required' });
min(path.properties['*'].estimatedValue, 0, { message: 'Value must be positive' });
```

### Custom Validators

Create your own validation logic:

```typescript
import { createValidator } from 'reformer/validators';

// Custom validator with dependencies
createValidator(
  path.initialPayment,
  [path.propertyValue, path.loanType],
  (initialPayment, [propertyValue, loanType]) => {
    if (loanType !== 'mortgage') return null;
    if (!propertyValue || !initialPayment) return null;

    const minPayment = (propertyValue as number) * 0.2;
    if ((initialPayment as number) < minPayment) {
      return {
        type: 'minInitialPayment',
        message: `Minimum down payment: ${minPayment.toLocaleString()} (20% of property value)`,
      };
    }

    return null;
  }
);
```

### Async Validators

Validate with server-side checks:

```typescript
import { createAsyncValidator } from 'reformer/validators';

// Async validation with debounce
createAsyncValidator(
  path.inn,
  async (inn) => {
    if (!inn || typeof inn !== 'string') return null;

    const response = await fetch(`/api/validate/inn?value=${inn}`);
    const result = await response.json();

    if (!result.valid) {
      return { type: 'invalidInn', message: result.message || 'Invalid INN' };
    }

    return null;
  },
  { debounce: 500 }
);
```

## Organizing Validation by Steps

For our credit application form, we organize validation by form steps - matching the structure we used in Behaviors:

```typescript
// src/schemas/validators/credit-application.validators.ts
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Step 1: Loan Information
  step1LoanValidation(path);

  // Step 2: Personal Information
  step2PersonalValidation(path);

  // Step 3: Contact Information
  step3ContactValidation(path);

  // Step 4: Employment
  step4EmploymentValidation(path);

  // Step 5: Additional Information
  step5AdditionalValidation(path);

  // Cross-step validation
  crossStepValidation(path);
};
```

This organization provides:
- **Clarity** - Easy to find validation for a specific step
- **Maintainability** - Changes in one step don't affect others
- **Scalability** - Easy to add new validation rules
- **Reusability** - Step validators can be used in other forms

## File Structure

We'll create the following structure:

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
│   │   └── credit-application.validators.ts  (main file)
│   └── create-form.ts  (validation registered here)
└── ...
```

## What We'll Implement

By the end of this section, our credit application form will have:

### Step 1: Loan Information
- ✅ Required fields (loanAmount, loanTerm, loanPurpose)
- ✅ Numeric ranges (min/max for amount and term)
- ✅ Conditional validation (mortgage/car fields)

### Step 2: Personal Information
- ✅ Name validation (required, minLength, Cyrillic pattern)
- ✅ Birth date validation (not in future, age 18-70)
- ✅ Passport validation (series/number format)
- ✅ INN and SNILS (pattern validation)

### Step 3: Contact Information
- ✅ Email and phone formats
- ✅ Address validation (required fields)
- ✅ Conditional residence address validation

### Step 4: Employment
- ✅ Conditional employment/business field validation
- ✅ Income validation (minimum threshold)
- ✅ Work experience validation (minimum 3 months at current job)

### Step 5: Additional Information
- ✅ Array validation (minLength when present)
- ✅ Array element validation
- ✅ Co-borrowers validation (email, phone, income)

### Cross-Step
- ✅ Down payment >= 20% of property value
- ✅ Monthly payment <= 50% of total income
- ✅ Age affects field availability
- ✅ Async: INN, SNILS, email uniqueness checks

## Integration with Behaviors

Validation works seamlessly with behaviors:

```typescript
// Behavior hides field when not needed
showWhen(path.propertyValue, path.loanType, (type) => type === 'mortgage');

// Validation only applies when field is visible
requiredWhen(
  path.propertyValue,
  path.loanType,
  (type) => type === 'mortgage',
  { message: 'Property value is required' }
);
```

When a field is hidden by a behavior, its validation is automatically skipped!

## Getting Started

Let's start with validating Step 1: Loan Information. This step demonstrates the most common validation patterns you'll use throughout the form.

In the next section we'll:
1. Create the validator file for Step 1
2. Implement required field validation
3. Add numeric range validation (min/max)
4. Implement conditional validation for mortgage/car fields
5. Test the validation in action

Ready? Let's begin!
