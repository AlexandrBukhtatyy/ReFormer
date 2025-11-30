---
sidebar_position: 2
---

# Step 1: Loan Information Validation

Validating loan fields with required, min/max, and conditional rules.

## What We're Validating

Step 1 contains loan-related fields that need validation:

| Field            | Validation Rules                                   |
| ---------------- | -------------------------------------------------- |
| `loanType`       | Required                                           |
| `loanAmount`     | Required, min 50,000, max 10,000,000               |
| `loanTerm`       | Required, min 6 months, max 360 months             |
| `loanPurpose`    | Required, minLength 10, maxLength 500              |
| `propertyValue`  | Required when loanType = 'mortgage', min 1,000,000 |
| `initialPayment` | Required when loanType = 'mortgage'                |
| `carBrand`       | Required when loanType = 'car'                     |
| `carModel`       | Required when loanType = 'car'                     |
| `carYear`        | Required when loanType = 'car', min 2000           |
| `carPrice`       | Required when loanType = 'car'                     |

## Creating the Validator File

Create the validator file for Step 1:

```bash
mkdir -p src/schemas/validators
touch src/schemas/validators/loan-info.ts
```

## Implementation

### Required Fields Validation

Start with basic required fields and numeric ranges:

```typescript title="src/schemas/validators/loan-info.ts"
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  applyWhen,
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 1: Loan Information
 *
 * Validates:
 * - Required fields (loanType, loanAmount, loanTerm, loanPurpose)
 * - Numeric ranges (amount, term)
 * - Conditional mortgage fields
 * - Conditional car loan fields
 */
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Loan Type
  // ==========================================
  required(path.loanType, { message: 'Please select loan type' });

  // ==========================================
  // Loan Amount
  // ==========================================
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum amount: 50,000' });
  max(path.loanAmount, 10000000, { message: 'Maximum amount: 10,000,000' });

  // ==========================================
  // Loan Term
  // ==========================================
  required(path.loanTerm, { message: 'Loan term is required' });
  min(path.loanTerm, 6, { message: 'Minimum term: 6 months' });
  max(path.loanTerm, 360, { message: 'Maximum term: 360 months (30 years)' });

  // ==========================================
  // Loan Purpose
  // ==========================================
  required(path.loanPurpose, { message: 'Loan purpose is required' });
  minLength(path.loanPurpose, 10, { message: 'Please provide at least 10 characters' });
  maxLength(path.loanPurpose, 500, { message: 'Maximum 500 characters' });

  // Conditional validation will be added next...
};
```

### Conditional Validation: Mortgage Fields

Add validation for mortgage-specific fields using `applyWhen`:

```typescript title="src/schemas/validators/loan-info.ts"
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Conditional: Mortgage Fields
  // ==========================================

  applyWhen(path.loanType, (loanType) => loanType === 'mortgage', (p) => {
    required(p.propertyValue, { message: 'Property value is required for mortgage' });
    min(p.propertyValue, 1000000, { message: 'Minimum property value: 1,000,000' });
    max(p.propertyValue, 500000000, { message: 'Maximum property value: 500,000,000' });

    required(p.initialPayment, { message: 'Initial payment is required for mortgage' });
    min(p.initialPayment, 100000, { message: 'Minimum initial payment: 100,000' });
  });
};
```

### Conditional Validation: Car Loan Fields

Add validation for car loan-specific fields:

```typescript title="src/schemas/validators/loan-info.ts"
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Conditional: Car Loan Fields
  // ==========================================

  const currentYear = new Date().getFullYear();

  applyWhen(path.loanType, (loanType) => loanType === 'car', (p) => {
    required(p.carBrand, { message: 'Car brand is required' });
    required(p.carModel, { message: 'Car model is required' });

    required(p.carYear, { message: 'Year of manufacture is required' });
    min(p.carYear, 2000, { message: 'Car must be year 2000 or newer' });
    max(p.carYear, currentYear + 1, { message: `Maximum year: ${currentYear + 1}` });

    required(p.carPrice, { message: 'Car price is required' });
    min(p.carPrice, 100000, { message: 'Minimum car price: 100,000' });
    max(p.carPrice, 20000000, { message: 'Maximum car price: 20,000,000' });
  });
};
```

## Complete Code

Here's the complete validator for Step 1:

```typescript title="src/schemas/validators/loan-info.ts"
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  applyWhen,
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 1: Loan Information
 *
 * Validates:
 * - Required fields (loanType, loanAmount, loanTerm, loanPurpose)
 * - Numeric ranges (amount, term)
 * - Conditional mortgage fields (propertyValue, initialPayment)
 * - Conditional car loan fields (carBrand, carModel, carYear, carPrice)
 */
export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Loan Type
  // ==========================================
  required(path.loanType, { message: 'Please select loan type' });

  // ==========================================
  // Loan Amount
  // ==========================================
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum amount: 50,000' });
  max(path.loanAmount, 10000000, { message: 'Maximum amount: 10,000,000' });

  // ==========================================
  // Loan Term
  // ==========================================
  required(path.loanTerm, { message: 'Loan term is required' });
  min(path.loanTerm, 6, { message: 'Minimum term: 6 months' });
  max(path.loanTerm, 360, { message: 'Maximum term: 360 months (30 years)' });

  // ==========================================
  // Loan Purpose
  // ==========================================
  required(path.loanPurpose, { message: 'Loan purpose is required' });
  minLength(path.loanPurpose, 10, { message: 'Please provide at least 10 characters' });
  maxLength(path.loanPurpose, 500, { message: 'Maximum 500 characters' });

  // ==========================================
  // Conditional: Mortgage Fields
  // ==========================================
  applyWhen(path.loanType, (loanType) => loanType === 'mortgage', (p) => {
    required(p.propertyValue, { message: 'Property value is required for mortgage' });
    min(p.propertyValue, 1000000, { message: 'Minimum property value: 1,000,000' });
    max(p.propertyValue, 500000000, { message: 'Maximum property value: 500,000,000' });

    required(p.initialPayment, { message: 'Initial payment is required for mortgage' });
    min(p.initialPayment, 100000, { message: 'Minimum initial payment: 100,000' });
  });

  // ==========================================
  // Conditional: Car Loan Fields
  // ==========================================
  const currentYear = new Date().getFullYear();

  applyWhen(path.loanType, (loanType) => loanType === 'car', (p) => {
    required(p.carBrand, { message: 'Car brand is required' });
    required(p.carModel, { message: 'Car model is required' });

    required(p.carYear, { message: 'Year of manufacture is required' });
    min(p.carYear, 2000, { message: 'Car must be year 2000 or newer' });
    max(p.carYear, currentYear + 1, { message: `Maximum year: ${currentYear + 1}` });

    required(p.carPrice, { message: 'Car price is required' });
    min(p.carPrice, 100000, { message: 'Minimum car price: 100,000' });
    max(p.carPrice, 20000000, { message: 'Maximum car price: 20,000,000' });
  });
};
```

## How It Works

### Required Validators

```typescript
required(path.loanAmount, { message: 'Loan amount is required' });
```

- Triggers when field is empty, null, or undefined
- Shows error message immediately when user leaves field empty

### Range Validators

```typescript
min(path.loanAmount, 50000, { message: 'Minimum amount: 50,000' });
max(path.loanAmount, 10000000, { message: 'Maximum amount: 10,000,000' });
```

- `min`: Triggers when value < minimum
- `max`: Triggers when value > maximum
- Works with numbers and numeric strings

### Conditional Validators

```typescript
applyWhen(path.loanType, (loanType) => loanType === 'mortgage', (p) => {
  required(p.propertyValue, { message: 'Property value is required for mortgage' });
  min(p.propertyValue, 1000000, { message: 'Minimum property value: 1,000,000' });
});
```

- **First argument**: Field to watch (dependency)
- **Second argument**: Condition function
- **Third argument**: Callback with validators to apply when condition is true
- Only validates when condition returns `true`
- Provides a scoped path `p` for the validators

### Integration with Behaviors

Remember from the Behaviors section, we have:

```typescript
// Behavior hides mortgage fields when not needed
enableWhen(path.propertyValue, path.loanType, (type) => type === 'mortgage');

// Validation only applies when visible
applyWhen(path.loanType, (type) => type === 'mortgage', (p) => {
  required(p.propertyValue, { message: 'Property value is required' });
});
```

When `loanType` is not 'mortgage':

1. Behavior **hides** the field → User doesn't see it
2. Validation **skips** the field → No errors shown

Perfect synchronization! 🎯

## Testing the Validation

Test these scenarios:

### Basic Required Fields

- [ ] Try to submit without selecting loan type → Error shown
- [ ] Try to submit without loan amount → Error shown
- [ ] Try to submit without loan term → Error shown
- [ ] Try to submit without loan purpose → Error shown

### Numeric Ranges

- [ ] Enter loan amount < 50,000 → Error shown
- [ ] Enter loan amount > 10,000,000 → Error shown
- [ ] Enter loan term < 6 → Error shown
- [ ] Enter loan term > 360 → Error shown

### String Length

- [ ] Enter loan purpose with < 10 characters → Error shown
- [ ] Enter loan purpose with > 500 characters → Error shown

### Conditional: Mortgage

- [ ] Select loan type = 'mortgage' → propertyValue and initialPayment become required
- [ ] Leave propertyValue empty → Error shown
- [ ] Enter propertyValue < 1,000,000 → Error shown
- [ ] Leave initialPayment empty → Error shown

### Conditional: Car Loan

- [ ] Select loan type = 'car' → Car fields become required
- [ ] Leave carBrand empty → Error shown
- [ ] Leave carModel empty → Error shown
- [ ] Enter carYear < 2000 → Error shown
- [ ] Enter carPrice < 100,000 → Error shown

### Switching Loan Types

- [ ] Fill in mortgage fields → Switch to 'car' → Mortgage errors disappear
- [ ] Fill in car fields → Switch to 'mortgage' → Car errors disappear

## Key Takeaways

1. **Declarative Rules** - Clear, concise validation definitions
2. **Conditional Validation** - Use `applyWhen` for conditional rules
3. **Works with Behaviors** - Hidden fields aren't validated
4. **Type-Safe** - Full TypeScript support for field paths
5. **Localized** - All Step 1 validation in one file

## What's Next?

In the next section, we'll add validation for **Step 2: Personal Information**, including:

- Name validation with Cyrillic patterns
- Birth date validation with age calculation
- Passport format validation
- INN and SNILS pattern validation
- Custom validators for complex rules

The validation patterns we learned here will be applied throughout the form!
