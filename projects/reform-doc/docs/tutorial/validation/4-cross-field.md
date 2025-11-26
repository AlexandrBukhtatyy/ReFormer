---
sidebar_position: 4
---

# Cross-Field Validation

Cross-field validation with `validateTree`.

## Overview

Cross-field validation allows you to validate relationships between multiple fields:

- Password confirmation matching
- Date range validation (start < end)
- Income vs payment ratio
- Dependent field comparisons
- Business logic that spans multiple fields

ReFormer provides `validateTree` for validating across the entire form state.

## validateTree

The `validateTree` function validates relationships between multiple fields by accessing the entire form state.

```typescript
import { validateTree } from 'reformer/validators';

validateTree<FormType>(
  validatorFn,    // Function that receives form context and returns error or null
  options         // { targetField: string } - field to attach error to
);
```

### Validator Function Context

The validator function receives a context object:

```typescript
validateTree<FormType>((ctx) => {
  const form = ctx.form.getValue(); // Get current form values

  // Perform validation
  if (/* validation fails */) {
    return {
      code: 'error-code',
      message: 'Error message'
    };
  }

  return null; // Validation passed
});
```

## Basic Examples

### Email Confirmation

```typescript title="src/validators/email-validators.ts"
import { validateTree, required, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  email: string;
  emailAdditional: string;
  sameEmail: boolean;
}

export const emailValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.email, { message: 'Primary email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.emailAdditional, { message: 'Additional email is required' });
  email(path.emailAdditional, { message: 'Invalid email format' });

  // Cross-field validation: emails must match when sameEmail is true
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.sameEmail && form.email && form.emailAdditional) {
        if (form.email !== form.emailAdditional) {
          return {
            code: 'emails-mismatch',
            message: 'Emails do not match',
          };
        }
      }

      return null;
    },
    { targetField: 'emailAdditional' }
  );
};
```

### Age at Loan End Validation

```typescript title="src/validators/age-validators.ts"
import { validateTree, required, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  loanTerm: number; // in months
}

export const ageValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.birthDate, { message: 'Birth date is required' });
  required(path.loanTerm, { message: 'Loan term is required' });
  min(path.loanTerm, 6, { message: 'Minimum term is 6 months' });
  max(path.loanTerm, 360, { message: 'Maximum term is 360 months' });

  // Cross-field validation: borrower age at loan end cannot exceed 70 years
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.birthDate && form.loanTerm > 0) {
        const birthDate = new Date(form.birthDate);
        const today = new Date();
        const currentAge = (today.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        const ageAtLoanEnd = currentAge + (form.loanTerm / 12);

        if (ageAtLoanEnd > 70) {
          return {
            code: 'age-limit-exceeded',
            message: 'Age at loan end cannot exceed 70 years',
          };
        }
      }

      return null;
    },
    { targetField: 'loanTerm' }
  );
};
```

### Income to Payment Ratio

```typescript title="src/validators/credit-validators.ts"
import { validateTree, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditForm {
  monthlyIncome: number;
  monthlyPayment: number;
}

export const creditValidation: ValidationSchemaFn<CreditForm> = (
  path: FieldPath<CreditForm>
) => {
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 0, { message: 'Income cannot be negative' });
  required(path.monthlyPayment, { message: 'Monthly payment is required' });
  min(path.monthlyPayment, 0, { message: 'Payment cannot be negative' });

  // Cross-field validation: payment cannot exceed 50% of income
  validateTree<CreditForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.monthlyIncome > 0 && form.monthlyPayment > 0) {
        const maxPayment = form.monthlyIncome * 0.5;

        if (form.monthlyPayment > maxPayment) {
          return {
            code: 'payment-too-high',
            message: `Payment cannot exceed 50% of income (max: ${maxPayment.toLocaleString()})`,
          };
        }
      }

      return null;
    },
    { targetField: 'monthlyPayment' }
  );
};
```

## Advanced Examples

### Work Experience Validation

Current work experience cannot exceed total work experience:

```typescript title="src/validators/employment-validators.ts"
import { validateTree, required, min, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface EmploymentForm {
  employmentStatus: 'employed' | 'self-employed' | 'unemployed';
  workExperienceTotal: number;  // Total years of work experience
  workExperienceCurrent: number; // Years at current job
}

export const employmentValidation: ValidationSchemaFn<EmploymentForm> = (
  path: FieldPath<EmploymentForm>
) => {
  required(path.employmentStatus, { message: 'Employment status is required' });

  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.workExperienceTotal, { message: 'Total experience is required' });
      min(path.workExperienceTotal, 0, { message: 'Cannot be negative' });
      required(path.workExperienceCurrent, { message: 'Current experience is required' });
      min(path.workExperienceCurrent, 0, { message: 'Cannot be negative' });

      // Cross-field: current cannot exceed total
      validateTree<EmploymentForm>(
        (ctx) => {
          const form = ctx.form.getValue();

          if (form.workExperienceCurrent > form.workExperienceTotal) {
            return {
              code: 'experience-exceeds-total',
              message: 'Current experience cannot exceed total experience',
            };
          }

          return null;
        },
        { targetField: 'workExperienceCurrent' }
      );
    }
  );
};
```

### Initial Payment Percentage

Initial payment must be at least 20% of property value:

```typescript title="src/validators/mortgage-validators.ts"
import { validateTree, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface MortgageForm {
  propertyValue: number;
  initialPayment: number;
  loanAmount: number;
}

export const mortgageValidation: ValidationSchemaFn<MortgageForm> = (
  path: FieldPath<MortgageForm>
) => {
  required(path.propertyValue, { message: 'Property value is required' });
  min(path.propertyValue, 500000, { message: 'Minimum property value is 500,000' });
  required(path.initialPayment, { message: 'Initial payment is required' });
  min(path.initialPayment, 0, { message: 'Cannot be negative' });

  // Initial payment must be at least 20% of property value
  validateTree<MortgageForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.propertyValue > 0 && form.initialPayment >= 0) {
        const minInitialPayment = form.propertyValue * 0.2;

        if (form.initialPayment < minInitialPayment) {
          return {
            code: 'initial-payment-too-low',
            message: `Initial payment must be at least 20% (${minInitialPayment.toLocaleString()})`,
          };
        }
      }

      return null;
    },
    { targetField: 'initialPayment' }
  );

  // Loan amount cannot exceed property value minus initial payment
  validateTree<MortgageForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.propertyValue > 0 && form.initialPayment > 0 && form.loanAmount > 0) {
        const maxLoanAmount = form.propertyValue - form.initialPayment;

        if (form.loanAmount > maxLoanAmount) {
          return {
            code: 'loan-exceeds-value',
            message: `Loan cannot exceed ${maxLoanAmount.toLocaleString()}`,
          };
        }
      }

      return null;
    },
    { targetField: 'loanAmount' }
  );
};
```

### Age-Based Term Limit

Loan term limited so borrower pays off by age 70:

```typescript title="src/validators/loan-term-validators.ts"
import { validateTree, required, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface LoanForm {
  borrowerAge: number;
  loanTermMonths: number;
}

export const loanTermValidation: ValidationSchemaFn<LoanForm> = (
  path: FieldPath<LoanForm>
) => {
  required(path.borrowerAge, { message: 'Age is required' });
  min(path.borrowerAge, 18, { message: 'Must be at least 18' });
  max(path.borrowerAge, 65, { message: 'Maximum age is 65' });

  required(path.loanTermMonths, { message: 'Loan term is required' });
  min(path.loanTermMonths, 12, { message: 'Minimum term is 12 months' });
  max(path.loanTermMonths, 360, { message: 'Maximum term is 360 months' });

  // Cross-field: term limited by age (must pay off by 70)
  validateTree<LoanForm>(
    (ctx) => {
      const form = ctx.form.getValue();

      if (form.borrowerAge >= 18 && form.loanTermMonths > 0) {
        const maxAgeAtEnd = 70;
        const yearsUntil70 = maxAgeAtEnd - form.borrowerAge;
        const maxTermMonths = yearsUntil70 * 12;

        if (form.loanTermMonths > maxTermMonths) {
          return {
            code: 'term-exceeds-age-limit',
            message: `Loan must be paid off by age ${maxAgeAtEnd}. Maximum term: ${maxTermMonths} months`,
          };
        }
      }

      return null;
    },
    { targetField: 'loanTermMonths' }
  );
};
```

## Multiple Cross-Field Validations

Apply multiple cross-field validations to a form:

```typescript title="src/validators/comprehensive-validators.ts"
import { validateTree, required, min, max, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  email: string;
  emailAdditional: string;
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
  monthlyPayment: number;
  propertyValue: number;
  initialPayment: number;
}

export const comprehensiveValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Basic field validations
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email' });
  required(path.emailAdditional, { message: 'Additional email is required' });
  email(path.emailAdditional, { message: 'Invalid email' });
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan is 50,000' });
  max(path.loanAmount, 5000000, { message: 'Maximum loan is 5,000,000' });
  required(path.loanTerm, { message: 'Loan term is required' });
  required(path.monthlyIncome, { message: 'Income is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });

  // Cross-field 1: Email confirmation
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.email && form.emailAdditional && form.email !== form.emailAdditional) {
        return { code: 'email-mismatch', message: 'Emails do not match' };
      }
      return null;
    },
    { targetField: 'emailAdditional' }
  );

  // Cross-field 2: Payment to income ratio
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.monthlyIncome > 0 && form.monthlyPayment > 0) {
        const maxPayment = form.monthlyIncome * 0.5;
        if (form.monthlyPayment > maxPayment) {
          return { code: 'payment-ratio', message: `Payment cannot exceed 50% of income` };
        }
      }
      return null;
    },
    { targetField: 'monthlyPayment' }
  );

  // Cross-field 3: Initial payment percentage
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.propertyValue > 0 && form.initialPayment >= 0) {
        const minInitialPayment = form.propertyValue * 0.2;
        if (form.initialPayment < minInitialPayment) {
          return { code: 'initial-payment-low', message: 'Initial payment must be at least 20%' };
        }
      }
      return null;
    },
    { targetField: 'initialPayment' }
  );

  // Cross-field 4: Loan amount vs property value
  validateTree<CreditApplicationForm>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.propertyValue > 0 && form.initialPayment > 0 && form.loanAmount > 0) {
        const maxLoan = form.propertyValue - form.initialPayment;
        if (form.loanAmount > maxLoan) {
          return { code: 'loan-exceeds-value', message: `Loan cannot exceed ${maxLoan.toLocaleString()}` };
        }
      }
      return null;
    },
    { targetField: 'loanAmount' }
  );
};
```

## Credit Application Example

Complete cross-field validation from a credit application:

```typescript title="src/validators/credit-application-validators.ts"
import {
  validateTree,
  apply,
  applyWhen,
  required,
  min
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  // Personal
  birthDate: string;
  // Employment
  employmentStatus: 'employed' | 'self-employed' | 'unemployed' | 'retired';
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  // Loan
  loanAmount: number;
  loanTermMonths: number;
  monthlyPayment: number;
  // Property (for mortgage)
  propertyValue: number;
  initialPayment: number;
}

// Validator: payment to income ratio
const validatePaymentToIncome = (ctx: { form: { getValue: () => CreditApplicationForm } }) => {
  const form = ctx.form.getValue();

  if (form.monthlyIncome > 0 && form.monthlyPayment > 0) {
    // Payment should not exceed 40% of income
    const maxPayment = form.monthlyIncome * 0.4;

    if (form.monthlyPayment > maxPayment) {
      return {
        code: 'payment-ratio-exceeded',
        message: `Monthly payment cannot exceed 40% of income (max: ${maxPayment.toLocaleString()})`,
      };
    }
  }

  return null;
};

// Validator: initial payment percentage
const validateInitialPayment = (ctx: { form: { getValue: () => CreditApplicationForm } }) => {
  const form = ctx.form.getValue();

  if (form.propertyValue > 0 && form.initialPayment >= 0) {
    const minInitialPayment = form.propertyValue * 0.2;

    if (form.initialPayment < minInitialPayment) {
      return {
        code: 'initial-payment-low',
        message: `Initial payment must be at least 20% (${minInitialPayment.toLocaleString()})`,
      };
    }
  }

  return null;
};

// Validator: work experience
const validateWorkExperience = (ctx: { form: { getValue: () => CreditApplicationForm } }) => {
  const form = ctx.form.getValue();

  if (form.workExperienceCurrent > form.workExperienceTotal) {
    return {
      code: 'experience-invalid',
      message: 'Current experience cannot exceed total experience',
    };
  }

  return null;
};

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Basic validations
  required(path.monthlyIncome, { message: 'Income is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
  required(path.monthlyPayment, { message: 'Payment is required' });
  min(path.monthlyPayment, 0, { message: 'Cannot be negative' });

  // Cross-field: payment to income ratio
  validateTree<CreditApplicationForm>(validatePaymentToIncome, {
    targetField: 'monthlyPayment',
  });

  // Cross-field: initial payment (conditional)
  applyWhen(
    path.propertyValue,
    (value) => value > 0,
    () => {
      validateTree<CreditApplicationForm>(validateInitialPayment, {
        targetField: 'initialPayment',
      });
    }
  );

  // Cross-field: work experience (conditional)
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    () => {
      validateTree<CreditApplicationForm>(validateWorkExperience, {
        targetField: 'workExperienceCurrent',
      });
    }
  );
};
```

## Best Practices

### 1. Choose the Right Target Field

```typescript
// ✅ Attach error to the dependent field
validateTree<Form>(
  (ctx) => {
    if (ctx.form.getValue().password !== ctx.form.getValue().confirmPassword) {
      return { code: 'mismatch', message: 'Passwords do not match' };
    }
    return null;
  },
  { targetField: 'confirmPassword' } // Error shows on confirmation field
);

// ❌ Wrong target - confusing for users
validateTree<Form>(
  (ctx) => { /* ... */ },
  { targetField: 'password' } // Error on wrong field
);
```

### 2. Extract Validator Functions

```typescript
// ✅ Reusable validator function
const validatePaymentRatio = (ctx) => {
  const form = ctx.form.getValue();
  if (form.monthlyPayment > form.monthlyIncome * 0.5) {
    return { code: 'ratio-exceeded', message: 'Payment too high' };
  }
  return null;
};

validateTree<Form>(validatePaymentRatio, { targetField: 'monthlyPayment' });

// ❌ Inline complex logic
validateTree<Form>(
  (ctx) => {
    // 20 lines of complex logic inline...
  },
  { targetField: 'field' }
);
```

### 3. Handle Edge Cases

```typescript
// ✅ Check for valid values before comparing
validateTree<Form>(
  (ctx) => {
    const form = ctx.form.getValue();

    // Only validate if both values are present and valid
    if (form.startDate && form.endDate) {
      const start = new Date(form.startDate);
      const end = new Date(form.endDate);

      // Check for valid dates
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (end <= start) {
          return { code: 'invalid-range', message: 'End must be after start' };
        }
      }
    }

    return null;
  },
  { targetField: 'endDate' }
);

// ❌ No null checks - may throw errors
validateTree<Form>(
  (ctx) => {
    const form = ctx.form.getValue();
    if (new Date(form.endDate) <= new Date(form.startDate)) {
      return { code: 'error', message: 'Invalid' };
    }
    return null;
  },
  { targetField: 'endDate' }
);
```

### 4. Use Descriptive Error Messages

```typescript
// ✅ Helpful, specific message with context
validateTree<Form>(
  (ctx) => {
    const form = ctx.form.getValue();
    const maxPayment = form.monthlyIncome * 0.5;

    if (form.monthlyPayment > maxPayment) {
      return {
        code: 'payment-ratio-exceeded',
        message: `Payment cannot exceed 50% of income (max: ${maxPayment.toLocaleString()})`,
      };
    }
    return null;
  },
  { targetField: 'monthlyPayment' }
);

// ❌ Vague message
validateTree<Form>(
  (ctx) => {
    if (/* condition */) {
      return { code: 'error', message: 'Invalid value' };
    }
    return null;
  },
  { targetField: 'field' }
);
```

### 5. Combine with revalidateWhen Behavior

```typescript
// In behavior schema
import { revalidateWhen } from 'reformer/behaviors';

export const formBehavior: BehaviorSchemaFn<Form> = (path) => {
  // Revalidate monthly payment when income changes
  revalidateWhen(path.monthlyPayment, [path.monthlyIncome]);
};

// In validation schema
export const formValidation: ValidationSchemaFn<Form> = (path) => {
  validateTree<Form>(
    (ctx) => {
      const form = ctx.form.getValue();
      if (form.monthlyPayment > form.monthlyIncome * 0.5) {
        return { code: 'ratio', message: 'Payment too high' };
      }
      return null;
    },
    { targetField: 'monthlyPayment' }
  );
};
```

## Next Step

Now that you understand cross-field validation, let's learn about async validation with `validateAsync`.
