---
sidebar_position: 6
---

# Custom Validators

Creating custom validators with `validate`.

## Overview

While ReFormer provides many built-in validators, you'll often need custom validation logic for:

- Domain-specific rules (age verification, business logic)
- Complex validation patterns (password strength, custom formats)
- Application-specific constraints (captcha, terms acceptance)
- Reusable validation logic across your application

The `validate` function provides a powerful way to create custom validators with full type safety.

## validate Function

The `validate` function creates a custom synchronous validator.

```typescript
import { validate } from 'reformer/validators';

validate(
  field,       // Field to validate
  validatorFn, // Function that returns error or null
  options      // Optional { message, params }
);
```

### Validator Function Signature

```typescript
validate(path.field, (value, ctx) => {
  // Perform validation logic
  if (!isValid(value)) {
    return {
      code: 'error-code',
      message: 'Error message'
    };
  }

  return null; // Validation passed
});
```

**Parameters:**
- `value` - The current field value
- `ctx` - Validation context with access to the form and other fields

**Returns:**
- `{ code: string, message: string }` - Validation error
- `null` - Validation passed

## Basic Examples

### Password Strength

```typescript title="src/validators/password-validators.ts"
import { validate, required, minLength } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface LoginForm {
  username: string;
  password: string;
}

export const loginValidation: ValidationSchemaFn<LoginForm> = (
  path: FieldPath<LoginForm>
) => {
  required(path.password, { message: 'Password is required' });
  minLength(path.password, 8, { message: 'Minimum 8 characters' });

  // Custom: password must contain uppercase, lowercase, and digit
  validate(path.password, (value) => {
    if (!value) return null; // Skip if empty (handled by required)

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);

    if (!hasUpperCase || !hasLowerCase || !hasDigit) {
      return {
        code: 'weak-password',
        message: 'Password must contain uppercase, lowercase, and digits',
      };
    }

    return null;
  });
};
```

### Age Verification

```typescript title="src/validators/age-validators.ts"
import { validate, required } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  firstName: string;
  lastName: string;
}

export const applicantValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.birthDate, { message: 'Birth date is required' });

  // Custom: applicant must be between 18 and 70 years old
  validate(path.birthDate, (value) => {
    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    // Adjust age if birthday hasn't occurred this year
    const adjustedAge = monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    if (adjustedAge < 18) {
      return {
        code: 'underage',
        message: 'Applicant must be at least 18 years old',
      };
    }

    if (adjustedAge > 70) {
      return {
        code: 'overage',
        message: 'Applicant must be under 70 years old',
      };
    }

    return null;
  });
};
```

### Date Range Validation

```typescript title="src/validators/date-validators.ts"
import { validate, required } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  employmentStartDate: string;
  birthDate: string;
}

export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStartDate, { message: 'Employment start date is required' });

  // Custom: employment start date cannot be in the future
  validate(path.employmentStartDate, (value) => {
    if (!value) return null;

    const startDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for date-only comparison

    if (startDate > today) {
      return {
        code: 'future-date',
        message: 'Employment start date cannot be in the future',
      };
    }

    return null;
  });

  // Custom: employment must start after applicant turned 14
  validate(path.employmentStartDate, (value, ctx) => {
    if (!value) return null;

    const birthDate = ctx.form.birthDate.value.value;
    if (!birthDate) return null; // Skip if birth date is not set

    const birth = new Date(birthDate);
    const employmentStart = new Date(value);

    // Calculate minimum employment age (14 years)
    const minEmploymentDate = new Date(birth);
    minEmploymentDate.setFullYear(birth.getFullYear() + 14);

    if (employmentStart < minEmploymentDate) {
      return {
        code: 'invalid-employment-age',
        message: 'Employment start date must be after applicant turned 14',
      };
    }

    return null;
  });
};
```

## Parameterized Validators

Create reusable validators that accept parameters:

### Min Age Validator

```typescript title="src/validators/reusable-validators.ts"
import { validate } from 'reformer/validators';
import type { FieldPathNode, ValidateOptions } from 'reformer';

/**
 * Validates that the age (calculated from birth date) meets minimum requirement
 */
export function minAge<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  minimumAge: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    const adjustedAge = monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
        ? age - 1
        : age;

    if (adjustedAge < minimumAge) {
      return {
        code: 'min-age',
        message: options?.message || `You must be at least ${minimumAge} years old`,
      };
    }

    return null;
  });
}

/**
 * Validates that a string matches a custom pattern with description
 */
export function customPattern<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  regex: RegExp,
  patternName: string,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (!value) return null;

    if (!regex.test(value)) {
      return {
        code: 'invalid-pattern',
        message: options?.message || `Invalid ${patternName}`,
      };
    }

    return null;
  });
}

/**
 * Validates that a number is within a range
 */
export function inRange<TForm>(
  fieldPath: FieldPathNode<TForm, number> | undefined,
  min: number,
  max: number,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (value === null || value === undefined) return null;

    if (value < min || value > max) {
      return {
        code: 'out-of-range',
        message: options?.message || `Value must be between ${min} and ${max}`,
      };
    }

    return null;
  });
}
```

### Using Parameterized Validators

```typescript title="src/validators/form-validation.ts"
import { minAge, customPattern, inRange } from './reusable-validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  cadastralNumber: string;
  workExperienceYears: number;
}

export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Use custom parameterized validators
  minAge(path.birthDate, 18, { message: 'Applicant must be at least 18 years old' });

  customPattern(
    path.cadastralNumber,
    /^\d{2}:\d{2}:\d{6,7}:\d{1,}$/,
    'cadastral number',
    { message: 'Invalid cadastral number format' }
  );

  inRange(path.workExperienceYears, 0, 50, {
    message: 'Work experience must be between 0 and 50 years'
  });
};
```

## Using Context

Access other form fields through the validation context:

### Email Confirmation

```typescript title="src/validators/email-confirmation.ts"
import { validate, required, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  email: string;
  emailAdditional: string;
  sameEmail: boolean;
}

export const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.emailAdditional, { message: 'Please confirm email' });
  email(path.emailAdditional, { message: 'Invalid email format' });

  // Access email field through context
  validate(path.emailAdditional, (value, ctx) => {
    const emailValue = ctx.form.email.value.value;
    const sameEmail = ctx.form.sameEmail.value.value;

    if (sameEmail && value && emailValue && value !== emailValue) {
      return {
        code: 'emails-mismatch',
        message: 'Emails do not match',
      };
    }

    return null;
  });
};
```

### Dependent Field Validation

```typescript title="src/validators/loan-validators.ts"
import { validate, required, min } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  monthlyIncome: number;
  loanAmount: number;
  loanTerm: number;
}

export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income: 10,000' });

  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan: 50,000' });

  // Validate that monthly payment doesn't exceed 40% of income
  validate(path.loanAmount, (value, ctx) => {
    if (!value) return null;

    const income = ctx.form.monthlyIncome.value.value;
    const term = ctx.form.loanTerm.value.value;

    if (!income || !term) return null;

    // Simple monthly payment calculation (without interest for demo)
    const monthlyPayment = value / term;
    const maxPayment = income * 0.4;

    if (monthlyPayment > maxPayment) {
      return {
        code: 'payment-too-high',
        message: `Monthly payment (${monthlyPayment.toFixed(0)}) exceeds 40% of income`,
      };
    }

    return null;
  });
};
```

## Error Codes and Messages

### Best Practices for Error Codes

```typescript
// ✅ Use descriptive, kebab-case error codes
return {
  code: 'weak-password',
  message: 'Password is too weak'
};

return {
  code: 'payment-exceeds-limit',
  message: 'Payment exceeds your credit limit'
};

// ❌ Avoid generic codes
return {
  code: 'error',
  message: 'Something is wrong'
};
```

### Custom Error Messages

```typescript
// Allow custom messages via options
export function strongPassword<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  options?: ValidateOptions
): void {
  if (!fieldPath) return;

  validate(fieldPath, (value) => {
    if (!value) return null;

    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasDigit = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);

    if (!hasUpperCase || !hasLowerCase || !hasDigit || !hasSpecial) {
      return {
        code: 'weak-password',
        message: options?.message ||
          'Password must contain uppercase, lowercase, digit, and special character',
      };
    }

    return null;
  });
}

// Usage
strongPassword(path.password); // Default message
strongPassword(path.password, {
  message: 'Create a stronger password'
}); // Custom message
```

### Error Params

Include additional data in error params:

```typescript
validate(path.amount, (value, ctx) => {
  const max = ctx.form.creditLimit.value.value;

  if (value > max) {
    return {
      code: 'exceeds-limit',
      message: `Amount exceeds your limit of ${max}`,
      params: {
        value,
        limit: max,
        excess: value - max
      }
    };
  }

  return null;
});
```

## Real-World Example

Complete example with multiple custom validators:

```typescript title="src/validators/credit-application-validators.ts"
import { validate, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  birthDate: string;
  monthlyIncome: number;
  loanAmount: number;
  passportSeries: string;
  passportNumber: string;
  passportIssueDate: string;
}

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Birth date - must be 18+
  required(path.birthDate, { message: 'Birth date is required' });
  validate(path.birthDate, (value) => {
    if (!value) return null;

    const birthDate = new Date(value);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();

    if (age < 18) {
      return {
        code: 'underage',
        message: 'Applicant must be at least 18 years old',
      };
    }

    if (age > 70) {
      return {
        code: 'overage',
        message: 'Applicant must be under 70 years old',
      };
    }

    return null;
  });

  // Income validation
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income: 10,000' });

  // Loan amount
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan: 50,000' });

  // Validate debt-to-income ratio
  validate(path.loanAmount, (value, ctx) => {
    if (!value) return null;

    const income = ctx.form.monthlyIncome.value.value;
    if (!income) return null;

    // Maximum loan: 10x monthly income
    const maxLoan = income * 10;

    if (value > maxLoan) {
      return {
        code: 'exceeds-income-ratio',
        message: `Maximum loan for your income: ${maxLoan.toLocaleString()}`,
      };
    }

    return null;
  });

  // Passport validation
  required(path.passportSeries, { message: 'Passport series is required' });
  pattern(path.passportSeries, /^\d{4}$/, {
    message: 'Series must be 4 digits'
  });

  required(path.passportNumber, { message: 'Passport number is required' });
  pattern(path.passportNumber, /^\d{6}$/, {
    message: 'Number must be 6 digits'
  });

  required(path.passportIssueDate, { message: 'Issue date is required' });

  // Passport issue date validation
  validate(path.passportIssueDate, (value, ctx) => {
    if (!value) return null;

    const issueDate = new Date(value);
    const today = new Date();

    // Cannot be in the future
    if (issueDate > today) {
      return {
        code: 'future-date',
        message: 'Issue date cannot be in the future',
      };
    }

    // Must be issued after applicant turned 14
    const birthDate = ctx.form.birthDate.value.value;
    if (birthDate) {
      const birth = new Date(birthDate);
      const minIssueDate = new Date(birth);
      minIssueDate.setFullYear(birth.getFullYear() + 14);

      if (issueDate < minIssueDate) {
        return {
          code: 'invalid-issue-date',
          message: 'Passport must be issued after applicant turned 14',
        };
      }
    }

    return null;
  });
};
```

## Best Practices

### 1. Always Handle Empty Values

```typescript
// ✅ Skip validation for empty values
validate(path.field, (value) => {
  if (!value) return null; // Let required() handle empty values

  // Your validation logic
});

// ❌ Validating empty values
validate(path.field, (value) => {
  if (value.length < 3) { // Error if value is undefined
    return { code: 'too-short', message: 'Too short' };
  }
});
```

### 2. Use Descriptive Error Codes

```typescript
// ✅ Clear, specific error codes
return { code: 'weak-password', message: '...' };
return { code: 'underage', message: '...' };
return { code: 'exceeds-income-ratio', message: '...' };

// ❌ Generic error codes
return { code: 'invalid', message: '...' };
return { code: 'error', message: '...' };
```

### 3. Provide Clear Error Messages

```typescript
// ✅ Specific, actionable messages
return {
  code: 'weak-password',
  message: 'Password must contain uppercase, lowercase, digit, and special character'
};

return {
  code: 'underage',
  message: 'You must be at least 18 years old'
};

// ❌ Vague messages
return { code: 'invalid', message: 'Invalid value' };
return { code: 'error', message: 'Error' };
```

### 4. Make Validators Reusable

```typescript
// ✅ Create reusable parameterized validators
export function minAge<TForm>(
  fieldPath: FieldPathNode<TForm, string> | undefined,
  minimumAge: number,
  options?: ValidateOptions
): void {
  // Implementation
}

// Use across your app
minAge(path.birthDate, 18);
minAge(path.guardianBirthDate, 25);

// ❌ Duplicating validation logic
validate(path.birthDate, (value) => {
  // Duplicated age calculation...
});
```

### 5. Check Prerequisites First

```typescript
// ✅ Validate dependencies exist before using them
validate(path.endDate, (value, ctx) => {
  if (!value) return null;

  const startDate = ctx.form.startDate.value.value;
  if (!startDate) return null; // Wait for start date

  // Now validate
});

// ❌ Assuming dependencies exist
validate(path.endDate, (value, ctx) => {
  const startDate = ctx.form.startDate.value.value;
  if (value < startDate) { // Error if startDate is undefined
    return { code: 'invalid', message: 'Invalid date' };
  }
});
```

## Next Step

Now that you understand custom validators, let's learn how to create reusable validation schemas.
