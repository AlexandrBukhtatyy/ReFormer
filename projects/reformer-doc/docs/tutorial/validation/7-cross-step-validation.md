---
sidebar_position: 7
---

# Cross-Step Validation

Validating business rules that span multiple form steps with custom and async validators.

## What We're Validating

Cross-step validation enforces business rules that depend on fields from multiple steps:

| Rule                              | Fields Involved                                                                    | Validation Type |
| --------------------------------- | ---------------------------------------------------------------------------------- | --------------- |
| Down payment >= 20% of property   | Step 1: `initialPayment`, `propertyValue`                                          | Custom          |
| Monthly payment <= 50% of income  | Step 1: `monthlyPayment`<br/>Step 4: `totalIncome`<br/>Step 5: `coBorrowersIncome` | Custom          |
| Loan amount <= car price          | Step 1: `loanAmount`, `carPrice`                                                   | Custom          |
| Remaining loan <= original amount | Step 5: `existingLoans[*].remainingAmount`, `amount`                               | Custom          |
| Age 18-70 validation              | Step 2: `age` (computed from `birthDate`)                                          | Custom          |
| INN verification                  | Step 2: `inn`                                                                      | Async           |
| SNILS verification                | Step 2: `snils`                                                                    | Async           |
| Email uniqueness                  | Step 3: `email`                                                                    | Async           |

## Creating the Validator File

Create the cross-step validator file:

```bash
touch src/schemas/validators/cross-step.ts
```

## Implementation

### Down Payment Validation

Ensure down payment is at least 20% of property value:

```typescript title="src/schemas/validators/cross-step.ts"
import { validate, validateAsync } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '@/types';

/**
 * Cross-Step Validation
 *
 * Validates business rules that span multiple form steps:
 * - Down payment >= 20% of property value
 * - Monthly payment <= 50% of total household income
 * - Loan amount <= car price
 * - Remaining loan amount <= original loan amount
 * - Age requirements (18-70)
 * - Async: INN, SNILS, email uniqueness
 */
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Down Payment >= 20% of Property Value
  // ==========================================
  validate(path.initialPayment, (initialPayment, ctx) => {
    const loanType = ctx.form.loanType.value.value;
    // Only validate for mortgage loans
    if (loanType !== 'mortgage') return null;

    const propertyValue = ctx.form.propertyValue.value.value;
    if (!propertyValue || !initialPayment) return null;

    const minPayment = propertyValue * 0.2;
    if (initialPayment < minPayment) {
      return {
        code: 'minInitialPayment',
        message: `Minimum down payment: ${minPayment.toLocaleString()} (20% of property value)`,
      };
    }

    return null;
  });
};
```

### Monthly Payment vs Income Validation

Ensure monthly payment doesn't exceed 50% of total household income:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 2. Monthly Payment <= 50% of Income
  // ==========================================
  validate(path.monthlyPayment, (monthlyPayment, ctx) => {
    const totalIncome = ctx.form.totalIncome.value.value || 0;
    const coBorrowersIncome = ctx.form.coBorrowersIncome.value.value || 0;
    const householdIncome = totalIncome + coBorrowersIncome;

    // Can't validate without income information
    if (!householdIncome || !monthlyPayment) return null;

    const maxPayment = householdIncome * 0.5;
    if (monthlyPayment > maxPayment) {
      return {
        code: 'maxPaymentToIncome',
        message: `Monthly payment exceeds 50% of household income (max: ${maxPayment.toLocaleString()})`,
      };
    }

    return null;
  });
};
```

### Car Loan Amount Validation

Ensure loan amount doesn't exceed car price:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 3. Loan Amount <= Car Price
  // ==========================================
  validate(path.loanAmount, (loanAmount, ctx) => {
    const loanType = ctx.form.loanType.value.value;
    // Only validate for car loans
    if (loanType !== 'car') return null;

    const carPrice = ctx.form.carPrice.value.value;
    if (!carPrice || !loanAmount) return null;

    if (loanAmount > carPrice) {
      return {
        code: 'loanExceedsCarPrice',
        message: 'Loan amount cannot exceed car price',
      };
    }

    return null;
  });
};
```

### Existing Loan Remaining Amount Validation

Validate remaining loan amount doesn't exceed original amount:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 4. Remaining Loan <= Original Amount
  // ==========================================
  createValidator(
    path.existingLoans['*'].remainingAmount,
    [path.existingLoans['*'].amount],
    (remaining, [amount]) => {
      if (!remaining || !amount) return null;

      if ((remaining as number) > (amount as number)) {
        return {
          type: 'remainingExceedsAmount',
          message: 'Remaining amount cannot exceed original loan amount',
        };
      }

      return null;
    }
  );
};
```

### Age Validation

Validate age is between 18 and 70:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 5. Age Requirements (18-70)
  // ==========================================
  validate(path.age, (age) => {
    if (age === null || age === undefined) return null;

    if (age < 18) {
      return {
        code: 'minAge',
        message: 'Applicant must be at least 18 years old',
      };
    }

    if (age > 70) {
      return {
        code: 'maxAge',
        message: 'Applicant must be 70 years old or younger',
      };
    }

    return null;
  });
};
```

### Async: INN Verification

Add async validation for INN verification:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 6. Async: INN Verification
  // ==========================================
  validateAsync(
    path.inn,
    async (inn) => {
      // Skip if empty or too short
      if (!inn || typeof inn !== 'string') return null;
      if (inn.length < 10) return null;

      try {
        // Call server API to verify INN
        const response = await fetch(`/api/validate/inn?value=${inn}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            code: 'invalidInn',
            message: result.message || 'Invalid INN',
          };
        }

        return null;
      } catch (error) {
        console.error('INN validation error:', error);
        // Don't fail validation on network errors
        return null;
      }
    },
    { debounce: 500 } // Wait 500ms after typing stops
  );
};
```

### Async: SNILS Verification

Add async validation for SNILS verification:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 7. Async: SNILS Verification
  // ==========================================
  validateAsync(
    path.snils,
    async (snils) => {
      if (!snils || typeof snils !== 'string') return null;
      if (snils.length < 11) return null;

      try {
        const response = await fetch(`/api/validate/snils?value=${snils}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            code: 'invalidSnils',
            message: result.message || 'Invalid SNILS',
          };
        }

        return null;
      } catch (error) {
        console.error('SNILS validation error:', error);
        return null;
      }
    },
    { debounce: 500 }
  );
};
```

### Async: Email Uniqueness

Add async validation for email uniqueness:

```typescript title="src/schemas/validators/cross-step.ts"
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // 8. Async: Email Uniqueness Check
  // ==========================================
  validateAsync(
    path.email,
    async (email) => {
      if (!email || typeof email !== 'string') return null;

      // Check basic email format first
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return null;

      try {
        const response = await fetch(
          `/api/validate/email-unique?email=${encodeURIComponent(email)}`
        );
        const result = await response.json();

        if (!result.unique) {
          return {
            code: 'emailNotUnique',
            message: 'This email is already registered. Use a different email or sign in.',
          };
        }

        return null;
      } catch (error) {
        console.error('Email uniqueness check error:', error);
        return null;
      }
    },
    { debounce: 800 } // Longer debounce for network requests
  );
};
```

## Complete Code

Here's the complete cross-step validator:

```typescript title="src/schemas/validators/cross-step.ts"
import { validate, validateAsync } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
import type { CreditApplicationForm } from '@/types';

/**
 * Cross-Step Validation
 *
 * Validates business rules that span multiple form steps
 */
export const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // 1. Down Payment >= 20% of Property Value
  // ==========================================
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

  // ==========================================
  // 2. Monthly Payment <= 50% of Income
  // ==========================================
  createValidator(
    path.monthlyPayment,
    [path.totalIncome, path.coBorrowersIncome],
    (monthlyPayment, [totalIncome, coBorrowersIncome]) => {
      const householdIncome = ((totalIncome as number) || 0) + ((coBorrowersIncome as number) || 0);
      if (!householdIncome || !monthlyPayment) return null;

      const maxPayment = householdIncome * 0.5;
      if ((monthlyPayment as number) > maxPayment) {
        return {
          type: 'maxPaymentToIncome',
          message: `Monthly payment exceeds 50% of household income (max: ${maxPayment.toLocaleString()})`,
        };
      }

      return null;
    }
  );

  // ==========================================
  // 3. Loan Amount <= Car Price
  // ==========================================
  createValidator(
    path.loanAmount,
    [path.carPrice, path.loanType],
    (loanAmount, [carPrice, loanType]) => {
      if (loanType !== 'car') return null;
      if (!carPrice || !loanAmount) return null;

      if ((loanAmount as number) > (carPrice as number)) {
        return {
          type: 'loanExceedsCarPrice',
          message: 'Loan amount cannot exceed car price',
        };
      }

      return null;
    }
  );

  // ==========================================
  // 4. Remaining Loan <= Original Amount
  // ==========================================
  createValidator(
    path.existingLoans['*'].remainingAmount,
    [path.existingLoans['*'].amount],
    (remaining, [amount]) => {
      if (!remaining || !amount) return null;

      if ((remaining as number) > (amount as number)) {
        return {
          type: 'remainingExceedsAmount',
          message: 'Remaining amount cannot exceed original loan amount',
        };
      }

      return null;
    }
  );

  // ==========================================
  // 5. Age Requirements (18-70)
  // ==========================================
  validate(path.age, (age) => {
    if (age === null || age === undefined) return null;

    if (age < 18) {
      return {
        code: 'minAge',
        message: 'Applicant must be at least 18 years old',
      };
    }

    if (age > 70) {
      return {
        code: 'maxAge',
        message: 'Applicant must be 70 years old or younger',
      };
    }

    return null;
  });

  // ==========================================
  // 6. Async: INN Verification
  // ==========================================
  createAsyncValidator(
    path.inn,
    async (inn) => {
      if (!inn || typeof inn !== 'string') return null;
      if (inn.length < 10) return null;

      try {
        const response = await fetch(`/api/validate/inn?value=${inn}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            type: 'invalidInn',
            message: result.message || 'Invalid INN',
          };
        }

        return null;
      } catch (error) {
        console.error('INN validation error:', error);
        return null;
      }
    },
    { debounce: 500 }
  );

  // ==========================================
  // 7. Async: SNILS Verification
  // ==========================================
  validateAsync(
    path.snils,
    async (snils) => {
      if (!snils || typeof snils !== 'string') return null;
      if (snils.length < 11) return null;

      try {
        const response = await fetch(`/api/validate/snils?value=${snils}`);
        const result = await response.json();

        if (!result.valid) {
          return {
            code: 'invalidSnils',
            message: result.message || 'Invalid SNILS',
          };
        }

        return null;
      } catch (error) {
        console.error('SNILS validation error:', error);
        return null;
      }
    },
    { debounce: 500 }
  );

  // ==========================================
  // 8. Async: Email Uniqueness Check
  // ==========================================
  createAsyncValidator(
    path.email,
    async (email) => {
      if (!email || typeof email !== 'string') return null;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) return null;

      try {
        const response = await fetch(
          `/api/validate/email-unique?email=${encodeURIComponent(email)}`
        );
        const result = await response.json();

        if (!result.unique) {
          return {
            type: 'emailNotUnique',
            message: 'This email is already registered. Use a different email or sign in.',
          };
        }

        return null;
      } catch (error) {
        console.error('Email uniqueness check error:', error);
        return null;
      }
    },
    { debounce: 800 }
  );
};
```

## How It Works

### Custom Validators with Dependencies

```typescript
validate(path.monthlyPayment, (monthlyPayment, ctx) => {
  // Access dependencies via context
  const totalIncome = ctx.form.totalIncome.value.value || 0;
  const coBorrowersIncome = ctx.form.coBorrowersIncome.value.value || 0;

  // Validation logic
  // Return null if valid
  // Return { code, message } if invalid
});
```

**Key points**:

- First parameter: field being validated
- Second parameter: validation function receiving value and context
- Access other fields via `ctx.form`
- Validator re-runs when dependencies change
- Use `code` property instead of `type`

### Async Validators

```typescript
validateAsync(
  path.inn, // Field to validate
  async (inn) => {
    // Async validation logic (can use fetch, promises, etc.)
    // Return null if valid
    // Return { code, message } if invalid
  },
  { debounce: 500 } // Options: debounce delay
);
```

**Key features**:

- Can make API calls, database queries, etc.
- Debouncing prevents excessive requests
- Shows loading state while validating
- Network errors shouldn't fail validation (return null)
- Use `code` property instead of `type`

### Debouncing

```typescript
{
  debounce: 500;
} // Wait 500ms after user stops typing
```

**Why debounce?**:

- Prevents API call on every keystroke
- Improves user experience
- Reduces server load
- Typical values: 300-800ms

## Testing the Validation

Test these scenarios:

### Down Payment Validation

- [ ] Select mortgage loan type
- [ ] Enter property value: 5,000,000
- [ ] Enter initial payment < 1,000,000 (20%) → Error shown
- [ ] Enter initial payment >= 1,000,000 → No error
- [ ] Switch to different loan type → Error disappears

### Monthly Payment vs Income

- [ ] Enter monthly income: 100,000
- [ ] Co-borrowers income: 50,000 (total: 150,000)
- [ ] Monthly payment > 75,000 (50%) → Error shown
- [ ] Monthly payment <= 75,000 → No error
- [ ] Change income → Validation re-runs

### Car Loan Amount

- [ ] Select car loan type
- [ ] Enter car price: 2,000,000
- [ ] Enter loan amount > 2,000,000 → Error shown
- [ ] Enter loan amount <= 2,000,000 → No error

### Remaining Loan Amount

- [ ] Add existing loan with amount: 500,000
- [ ] Enter remaining amount > 500,000 → Error shown
- [ ] Enter remaining amount <= 500,000 → No error

### Age Validation

- [ ] Enter birth date that makes age < 18 → Error shown
- [ ] Enter birth date that makes age > 70 → Error shown
- [ ] Enter valid age (18-70) → No error

### Async: INN Verification

- [ ] Enter INN → See loading indicator
- [ ] After 500ms → API call made
- [ ] Invalid INN → Error shown from server
- [ ] Valid INN → No error

### Async: Email Uniqueness

- [ ] Enter email → See loading indicator
- [ ] After 800ms → API call made
- [ ] Email already registered → Error shown
- [ ] Unique email → No error

## Mock API Responses

For testing, create mock API endpoints:

```typescript
// /api/validate/inn
{
  valid: true | false,
  message: 'Invalid INN checksum' // When invalid
}

// /api/validate/snils
{
  valid: true | false,
  message: 'Invalid SNILS' // When invalid
}

// /api/validate/email-unique
{
  unique: true | false
}
```

## Key Takeaways

1. **Custom Validators** - Create complex business rules
2. **Dependencies** - Validators re-run when dependencies change
3. **Async Validators** - Make server-side validation calls
4. **Debouncing** - Reduce unnecessary API calls
5. **Error Handling** - Gracefully handle network errors
6. **Type Safety** - Full TypeScript support for all validators

## Best Practices

### 1. Early Returns

```typescript
validate(path.field, (value, ctx) => {
  // Return early for cases that don't need validation
  if (!value) return null;

  const dep = ctx.form.dependency.value.value;
  if (!dep) return null;
  if (someCondition) return null;

  // Main validation logic
  if (invalid) {
    return { code: 'error', message: 'Error message' };
  }

  return null;
});
```

### 2. Graceful Async Failure

```typescript
validateAsync(
  path.field,
  async (value) => {
    try {
      // API call
    } catch (error) {
      console.error('Validation error:', error);
      return null; // Don't fail on network errors
    }
  },
  { debounce: 500 }
);
```

### 3. Clear Error Messages

```typescript
return {
  code: 'descriptiveErrorCode',
  message: 'Clear, actionable error message with context',
};
```

## What's Next?

In the final section, we'll **combine all validators** and register them with the form:

- Create the main validator file
- Import all step validators
- Register with form creation
- Test the complete validation
- Review the complete file structure

Let's tie everything together!
