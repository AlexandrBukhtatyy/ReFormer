---
sidebar_position: 2
---

# Step 1: Loan Information Validation

Validating loan fields with required, min/max, and conditional rules.

## What We're Validating

Step 1 contains loan-related fields that need validation:

| Field | Validation Rules |
|-------|------------------|
| `loanType` | Required |
| `loanAmount` | Required, min 50,000, max 10,000,000 |
| `loanTerm` | Required, min 6 months, max 360 months |
| `loanPurpose` | Required, minLength 10, maxLength 500 |
| `propertyValue` | Required when loanType = 'mortgage', min 1,000,000 |
| `initialPayment` | Required when loanType = 'mortgage' |
| `carBrand` | Required when loanType = 'car' |
| `carModel` | Required when loanType = 'car' |
| `carYear` | Required when loanType = 'car', min 2000 |
| `carPrice` | Required when loanType = 'car' |

## Creating the Validator File

Create the validator file for Step 1:

```bash
mkdir -p src/schemas/validators/steps
touch src/schemas/validators/steps/step-1-loan-info.validators.ts
```

## Implementation

### Required Fields Validation

Start with basic required fields and numeric ranges:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
import { required, min, max, minLength, maxLength, requiredWhen, minWhen } from 'reformer/validators';
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
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (
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

Add validation for mortgage-specific fields using `requiredWhen` and `minWhen`:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Conditional: Mortgage Fields
  // ==========================================

  // Property value - required only for mortgage
  requiredWhen(
    path.propertyValue,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Property value is required for mortgage' }
  );

  // Minimum property value - only enforced for mortgage
  minWhen(
    path.propertyValue,
    1000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Minimum property value: 1,000,000' }
  );

  // Maximum property value
  maxWhen(
    path.propertyValue,
    500000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Maximum property value: 500,000,000' }
  );

  // Initial payment - required only for mortgage
  requiredWhen(
    path.initialPayment,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Initial payment is required for mortgage' }
  );

  // Initial payment minimum
  minWhen(
    path.initialPayment,
    100000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Minimum initial payment: 100,000' }
  );
};
```

### Conditional Validation: Car Loan Fields

Add validation for car loan-specific fields:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Conditional: Car Loan Fields
  // ==========================================

  // Car brand
  requiredWhen(
    path.carBrand,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car brand is required' }
  );

  // Car model
  requiredWhen(
    path.carModel,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car model is required' }
  );

  // Car year
  requiredWhen(
    path.carYear,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Year of manufacture is required' }
  );

  // Minimum car year (no cars older than 2000)
  minWhen(
    path.carYear,
    2000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car must be year 2000 or newer' }
  );

  // Maximum car year (current year + 1 for pre-orders)
  const currentYear = new Date().getFullYear();
  maxWhen(
    path.carYear,
    currentYear + 1,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: `Maximum year: ${currentYear + 1}` }
  );

  // Car price
  requiredWhen(
    path.carPrice,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car price is required' }
  );

  // Minimum car price
  minWhen(
    path.carPrice,
    100000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Minimum car price: 100,000' }
  );

  // Maximum car price
  maxWhen(
    path.carPrice,
    20000000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Maximum car price: 20,000,000' }
  );
};
```

## Complete Code

Here's the complete validator for Step 1:

```typescript title="src/schemas/validators/steps/step-1-loan-info.validators.ts"
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  requiredWhen,
  minWhen,
  maxWhen
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
export const step1LoanValidation: ValidationSchemaFn<CreditApplicationForm> = (
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
  requiredWhen(
    path.propertyValue,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Property value is required for mortgage' }
  );

  minWhen(
    path.propertyValue,
    1000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Minimum property value: 1,000,000' }
  );

  maxWhen(
    path.propertyValue,
    500000000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Maximum property value: 500,000,000' }
  );

  requiredWhen(
    path.initialPayment,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Initial payment is required for mortgage' }
  );

  minWhen(
    path.initialPayment,
    100000,
    path.loanType,
    (loanType) => loanType === 'mortgage',
    { message: 'Minimum initial payment: 100,000' }
  );

  // ==========================================
  // Conditional: Car Loan Fields
  // ==========================================
  requiredWhen(
    path.carBrand,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car brand is required' }
  );

  requiredWhen(
    path.carModel,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car model is required' }
  );

  requiredWhen(
    path.carYear,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Year of manufacture is required' }
  );

  minWhen(
    path.carYear,
    2000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car must be year 2000 or newer' }
  );

  const currentYear = new Date().getFullYear();
  maxWhen(
    path.carYear,
    currentYear + 1,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: `Maximum year: ${currentYear + 1}` }
  );

  requiredWhen(
    path.carPrice,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Car price is required' }
  );

  minWhen(
    path.carPrice,
    100000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Minimum car price: 100,000' }
  );

  maxWhen(
    path.carPrice,
    20000000,
    path.loanType,
    (loanType) => loanType === 'car',
    { message: 'Maximum car price: 20,000,000' }
  );
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
requiredWhen(
  path.propertyValue,
  path.loanType,
  (loanType) => loanType === 'mortgage',
  { message: 'Property value is required for mortgage' }
);
```

- **First argument**: Field to validate
- **Second argument**: Field to watch (dependency)
- **Third argument**: Condition function
- **Fourth argument**: Error message
- Only validates when condition returns `true`

### Integration with Behaviors

Remember from the Behaviors section, we have:

```typescript
// Behavior hides mortgage fields when not needed
showWhen(path.propertyValue, path.loanType, (type) => type === 'mortgage');

// Validation only applies when visible
requiredWhen(
  path.propertyValue,
  path.loanType,
  (type) => type === 'mortgage',
  { message: 'Property value is required' }
);
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
2. **Conditional Validation** - Use `requiredWhen`, `minWhen`, `maxWhen` for conditional rules
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
