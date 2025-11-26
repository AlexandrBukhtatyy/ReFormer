---
sidebar_position: 5
---

# Async Validation

Asynchronous validation with `validateAsync`.

## Overview

Async validation is essential for:

- Checking uniqueness (username, email)
- Validating data against external APIs
- Server-side verification (tax ID, credit score)
- Real-time availability checks

ReFormer provides `validateAsync` with built-in debouncing for optimal performance.

## validateAsync

The `validateAsync` function performs asynchronous validation with automatic debouncing.

```typescript
import { validateAsync } from 'reformer/validators';

validateAsync(
  field,          // Field to validate
  asyncValidator, // Async function that returns error or null
  options         // { debounce?: number }
);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `debounce` | `number` | `0` | Delay in milliseconds before validation runs |

### Validator Function

The async validator receives the field value and should return an error object or `null`:

```typescript
validateAsync(path.field, async (value) => {
  // Perform async validation
  const isValid = await checkSomething(value);

  if (!isValid) {
    return {
      code: 'error-code',
      message: 'Error message'
    };
  }

  return null; // Validation passed
});
```

## Basic Examples

### INN Validation

```typescript title="src/validators/inn-validators.ts"
import { validateAsync, required, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateINN } from '../api';

interface CreditApplicationForm {
  inn: string;
  firstName: string;
  lastName: string;
}

export const innValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Sync validation first
  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{10,12}$/, {
    message: 'INN must be 10 or 12 digits'
  });

  // Async validation: verify INN with tax service
  validateAsync(
    path.inn,
    async (inn) => {
      if (!inn || !/^\d{10,12}$/.test(inn)) {
        return null; // Skip if basic validation fails
      }

      try {
        const result = await validateINN(inn);

        if (!result.valid) {
          return {
            code: 'inn-invalid',
            message: result.message || 'Invalid INN',
          };
        }
      } catch (error) {
        return {
          code: 'check-failed',
          message: 'Could not verify INN',
        };
      }

      return null;
    },
    { debounce: 500 } // Wait 500ms after user stops typing
  );
};
```

### Email Uniqueness

```typescript title="src/validators/email-validators.ts"
import { validateAsync, required, email } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { checkApplicantEmailExists } from '../api';

interface CreditApplicationForm {
  email: string;
  phoneMain: string;
  firstName: string;
  lastName: string;
}

export const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  // Async: check if applicant with this email already exists
  validateAsync(
    path.email,
    async (emailValue) => {
      if (!emailValue) return null;

      // Simple email format check before API call
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
        return null; // Let sync validator handle format errors
      }

      try {
        const { exists, applicationStatus } = await checkApplicantEmailExists(emailValue);

        if (exists) {
          if (applicationStatus === 'pending') {
            return {
              code: 'application-pending',
              message: 'You already have a pending application. Please check your email.',
            };
          }
          return {
            code: 'email-exists',
            message: 'An application with this email already exists',
          };
        }
      } catch (error) {
        console.error('Email check failed:', error);
        // Optionally return error or allow submission
        return null;
      }

      return null;
    },
    { debounce: 300 }
  );
};
```

### SNILS Validation

```typescript title="src/validators/snils-validators.ts"
import { validateAsync, required, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateSNILS } from '../api';

interface CreditApplicationForm {
  snils: string;
  firstName: string;
  lastName: string;
  middleName: string;
}

export const snilsValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.snils, { message: 'SNILS is required' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'SNILS must be 11 digits'
  });

  // Async: validate SNILS with Pension Fund database
  validateAsync(
    path.snils,
    async (snils) => {
      if (!snils || !/^\d{11}$/.test(snils)) {
        return null;
      }

      try {
        const result = await validateSNILS(snils);

        if (!result.valid) {
          return {
            code: 'invalid-snils',
            message: result.message || 'Invalid SNILS',
          };
        }

        // Check if checksum is correct
        if (!result.checksumValid) {
          return {
            code: 'snils-checksum-error',
            message: 'SNILS checksum validation failed',
          };
        }
      } catch (error) {
        return {
          code: 'validation-error',
          message: 'Could not validate SNILS',
        };
      }

      return null;
    },
    { debounce: 500 }
  );
};
```

## Advanced Examples

### Multiple Async Validators

Apply multiple async validators to different fields:

```typescript title="src/validators/applicant-validators.ts"
import { validateAsync, required, email, pattern, phone } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateINN, checkApplicantEmailExists, validatePhoneNumber } from '../api';

interface CreditApplicationForm {
  inn: string;
  email: string;
  phoneMain: string;
  firstName: string;
  lastName: string;
}

export const applicantValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // INN
  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{10,12}$/, { message: 'INN must be 10-12 digits' });
  validateAsync(
    path.inn,
    async (inn) => {
      if (!inn || !/^\d{10,12}$/.test(inn)) return null;
      try {
        const result = await validateINN(inn);
        if (!result.valid) {
          return { code: 'inn-invalid', message: 'Invalid INN' };
        }
      } catch (error) {
        return { code: 'check-failed', message: 'Could not verify INN' };
      }
      return null;
    },
    { debounce: 500 }
  );

  // Email
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email' });
  validateAsync(
    path.email,
    async (emailValue) => {
      if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) return null;
      try {
        const { exists } = await checkApplicantEmailExists(emailValue);
        if (exists) {
          return { code: 'exists', message: 'Application with this email already exists' };
        }
      } catch (error) {
        console.error('Email check failed:', error);
        return null;
      }
      return null;
    },
    { debounce: 300 }
  );

  // Phone
  required(path.phoneMain, { message: 'Phone is required' });
  phone(path.phoneMain, { message: 'Invalid phone format' });
  validateAsync(
    path.phoneMain,
    async (phoneValue) => {
      if (!phoneValue) return null;
      try {
        const { valid, carrier } = await validatePhoneNumber(phoneValue);
        if (!valid) {
          return { code: 'invalid-phone', message: 'Phone number is not valid' };
        }
      } catch (error) {
        console.error('Phone validation failed:', error);
        return null;
      }
      return null;
    },
    { debounce: 500 }
  );
};
```

### Conditional Async Validation

Combine with `applyWhen` for conditional async validation:

```typescript title="src/validators/conditional-async-validators.ts"
import { validateAsync, required, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { validateCompanyINN, validateOGRNIP } from '../api';

interface CreditApplicationForm {
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed' | 'retired';
  companyInn: string;
  businessInn: string;
  ogrnip: string;
  businessType: string;
}

export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStatus, { message: 'Employment status is required' });

  // Self-employed specific validation
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (path) => {
      required(path.businessInn, { message: 'Business INN is required for self-employed' });
      pattern(path.businessInn, /^\d{12}$/, { message: 'Business INN must be 12 digits' });

      // Async: validate business INN
      validateAsync(
        path.businessInn,
        async (businessInn) => {
          if (!businessInn || !/^\d{12}$/.test(businessInn)) return null;
          try {
            const result = await validateCompanyINN(businessInn);
            if (!result.valid) {
              return { code: 'invalid', message: 'Invalid business INN' };
            }
            if (result.status === 'inactive') {
              return { code: 'inactive', message: 'Business is inactive' };
            }
          } catch (error) {
            return { code: 'check-failed', message: 'Could not verify business INN' };
          }
          return null;
        },
        { debounce: 500 }
      );

      required(path.ogrnip, { message: 'OGRNIP is required' });
      pattern(path.ogrnip, /^\d{15}$/, { message: 'OGRNIP must be 15 digits' });

      // Async: validate OGRNIP
      validateAsync(
        path.ogrnip,
        async (ogrnip) => {
          if (!ogrnip || !/^\d{15}$/.test(ogrnip)) return null;
          try {
            const result = await validateOGRNIP(ogrnip);
            if (!result.valid) {
              return { code: 'invalid-ogrnip', message: 'Invalid OGRNIP' };
            }
          } catch (error) {
            return { code: 'check-failed', message: 'Could not verify OGRNIP' };
          }
          return null;
        },
        { debounce: 500 }
      );
    }
  );
};
```

### Credit Check Example

Real-world example of async credit validation:

```typescript title="src/validators/credit-validators.ts"
import { validateAsync, required, min, pattern, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { checkCreditScore, validatePassport } from '../api';

interface CreditApplicationForm {
  passportSeries: string;
  passportNumber: string;
  monthlyIncome: number;
  loanAmount: number;
}

export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Passport validation
  required(path.passportSeries, { message: 'Passport series is required' });
  pattern(path.passportSeries, /^\d{4}$/, { message: 'Series must be 4 digits' });
  required(path.passportNumber, { message: 'Passport number is required' });
  pattern(path.passportNumber, /^\d{6}$/, { message: 'Number must be 6 digits' });

  // Async: validate passport with government database
  validateAsync(
    path.passportNumber,
    async (number, ctx) => {
      const series = ctx?.form?.passportSeries?.value?.value;
      if (!number || !series) return null;

      try {
        const result = await validatePassport(series, number);

        if (!result.valid) {
          return {
            code: 'invalid-passport',
            message: result.message || 'Passport validation failed',
          };
        }

        if (result.expired) {
          return {
            code: 'expired-passport',
            message: 'Passport has expired',
          };
        }
      } catch (error) {
        // Log error but don't block submission
        console.error('Passport validation error:', error);
      }

      return null;
    },
    { debounce: 1000 } // Longer debounce for expensive API call
  );

  // Income and amount
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan is 50,000' });

  // Async: pre-approval credit check
  validateAsync(
    path.loanAmount,
    async (amount, ctx) => {
      const income = ctx?.form?.monthlyIncome?.value?.value;
      if (!amount || !income) return null;

      try {
        const result = await checkCreditScore({
          income,
          loanAmount: amount,
        });

        if (result.status === 'rejected') {
          return {
            code: 'credit-rejected',
            message: 'Pre-approval failed: amount too high for income',
          };
        }

        if (result.status === 'review') {
          // Not an error, but inform user
          return null;
        }
      } catch (error) {
        // Don't block on credit check errors
        console.error('Credit check error:', error);
      }

      return null;
    },
    { debounce: 1000 }
  );
};
```

## Debounce Strategy

### Choosing Debounce Values

| Scenario | Recommended Debounce | Reason |
|----------|---------------------|--------|
| Username/email check | 300-500ms | Balance UX and API load |
| Tax ID validation | 500-1000ms | Expensive API calls |
| Real-time search | 200-300ms | Quick feedback needed |
| Credit checks | 1000-2000ms | Very expensive, throttle |
| Simple availability | 200-400ms | Fast response expected |

### Examples

```typescript
// Fast feedback for simple checks
validateAsync(path.username, checkUsername, { debounce: 300 });

// Standard API validation
validateAsync(path.email, checkEmail, { debounce: 500 });

// Expensive external API
validateAsync(path.taxId, validateTaxId, { debounce: 1000 });

// Very expensive (credit check, etc.)
validateAsync(path.amount, checkCreditLimit, { debounce: 2000 });
```

## Error Handling

### Graceful Degradation

```typescript
validateAsync(
  path.email,
  async (email) => {
    if (!email) return null;

    try {
      const result = await checkEmailExists(email);

      if (result.exists) {
        return { code: 'exists', message: 'Email already registered' };
      }
    } catch (error) {
      // Option 1: Silent failure (allow submission)
      console.error('Email check failed:', error);
      return null;

      // Option 2: Show error but don't block
      // return { code: 'check-failed', message: 'Could not verify email' };

      // Option 3: Block submission
      // return { code: 'error', message: 'Service unavailable' };
    }

    return null;
  },
  { debounce: 500 }
);
```

### Retry Logic

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

validateAsync(
  path.taxId,
  async (taxId) => {
    if (!taxId) return null;

    try {
      const result = await withRetry(() => validateTaxId(taxId), 2, 500);

      if (!result.valid) {
        return { code: 'invalid', message: 'Invalid tax ID' };
      }
    } catch (error) {
      return { code: 'error', message: 'Validation service unavailable' };
    }

    return null;
  },
  { debounce: 500 }
);
```

## Best Practices

### 1. Always Check Prerequisites

```typescript
// ✅ Skip async validation if sync validation would fail
validateAsync(
  path.username,
  async (username) => {
    // Check length first
    if (!username || username.length < 3) {
      return null; // Let sync validators handle this
    }

    // Now do expensive async check
    const result = await checkAvailability(username);
    // ...
  },
  { debounce: 500 }
);

// ❌ Making API calls for invalid values
validateAsync(
  path.username,
  async (username) => {
    const result = await checkAvailability(username); // Wasteful for empty/short values
    // ...
  },
  { debounce: 500 }
);
```

### 2. Use Appropriate Debounce

```typescript
// ✅ Debounce based on API cost and user expectations
validateAsync(path.email, checkEmail, { debounce: 300 }); // Quick check
validateAsync(path.taxId, validateTaxId, { debounce: 1000 }); // Expensive API

// ❌ No debounce for expensive operations
validateAsync(path.taxId, validateTaxId); // API call on every keystroke
```

### 3. Handle Errors Gracefully

```typescript
// ✅ Catch errors and decide appropriate action
validateAsync(
  path.field,
  async (value) => {
    try {
      const result = await apiCall(value);
      if (!result.valid) {
        return { code: 'invalid', message: result.message };
      }
    } catch (error) {
      // Log and decide: block or allow?
      console.error('Validation error:', error);
      return null; // Allow submission, validate server-side
    }
    return null;
  },
  { debounce: 500 }
);

// ❌ Unhandled errors crash validation
validateAsync(
  path.field,
  async (value) => {
    const result = await apiCall(value); // Unhandled rejection possible
    return result.valid ? null : { code: 'invalid', message: 'Error' };
  },
  { debounce: 500 }
);
```

### 4. Provide Clear Loading States

The form automatically tracks async validation status through the field's `validating` signal:

```tsx
function FormField({ control }) {
  return (
    <div>
      <input {...control.inputProps} />
      {control.validating.value && <span>Checking...</span>}
      {control.errors.value.map(error => (
        <span key={error.code}>{error.message}</span>
      ))}
    </div>
  );
}
```

### 5. Order Sync Before Async

```typescript
// ✅ Sync validators first, then async
required(path.email, { message: 'Email is required' });
email(path.email, { message: 'Invalid email format' });
validateAsync(path.email, checkEmailExists, { debounce: 300 });

// ❌ Async without sync prerequisites
validateAsync(path.email, checkEmailExists, { debounce: 300 });
// User might see "email already exists" before "invalid format"
```

## Next Step

Now that you understand async validation, let's learn how to create custom validators with `validate`.
