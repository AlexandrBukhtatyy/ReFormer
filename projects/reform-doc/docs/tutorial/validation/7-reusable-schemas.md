---
sidebar_position: 7
---

# Reusable Validation Schemas

Creating reusable validation schemas for common patterns.

## Overview

As your application grows, you'll find yourself validating the same patterns repeatedly:

- Address fields (street, city, postal code)
- Contact information (email, phone)
- Date ranges (start/end dates)
- User credentials (username, password)

Reusable validation schemas let you:
- **Write once, use anywhere** - Define validation logic in one place
- **Ensure consistency** - Same rules applied across your app
- **Simplify maintenance** - Update validation in one file
- **Compose complex forms** - Build from smaller, tested pieces

## Creating Reusable Schemas

A reusable schema is a `ValidationSchemaFn<T>` that validates a specific data structure:

```typescript
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, email } from 'reformer/validators';

interface EmailField {
  email: string;
}

export const emailValidation: ValidationSchemaFn<EmailField> = (
  path: FieldPath<EmailField>
) => {
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
};
```

This schema can now be reused across different forms.

## Composing Schemas with apply

Use the `apply` function to compose reusable schemas into larger forms:

```typescript
import { apply } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface UserForm {
  name: string;
  email: string;
  password: string;
}

export const userFormValidation: ValidationSchemaFn<UserForm> = (
  path: FieldPath<UserForm>
) => {
  // Apply email validation schema
  apply(path, emailValidation);

  // Add additional validation specific to UserForm
  required(path.name, { message: 'Name is required' });
  required(path.password, { message: 'Password is required' });
};
```

### Multiple Fields with Same Schema

Apply the same schema to multiple fields:

```typescript
interface ContactForm {
  primaryEmail: string;
  secondaryEmail: string;
}

export const contactValidation: ValidationSchemaFn<ContactForm> = (
  path: FieldPath<ContactForm>
) => {
  // Apply email validation to both fields
  apply(path.primaryEmail, emailValidation);
  apply(path.secondaryEmail, emailValidation);
};
```

Or use an array for multiple fields:

```typescript
interface RegistrationForm {
  registrationAddress: Address;
  mailingAddress: Address;
}

export const registrationValidation: ValidationSchemaFn<RegistrationForm> = (
  path: FieldPath<RegistrationForm>
) => {
  // Apply address validation to both address fields
  apply([path.registrationAddress, path.mailingAddress], addressValidation);
};
```

## Common Reusable Schemas

### Address Validation

```typescript title="src/validators/schemas/address-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, minLength, maxLength, pattern } from 'reformer/validators';

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Reusable address validation schema
 *
 * Usage:
 * ```typescript
 * apply(path.shippingAddress, addressValidation);
 * apply(path.billingAddress, addressValidation);
 * ```
 */
export const addressValidation: ValidationSchemaFn<Address> = (
  path: FieldPath<Address>
) => {
  required(path.street, { message: 'Street address is required' });
  minLength(path.street, 3, { message: 'Minimum 3 characters' });
  maxLength(path.street, 200, { message: 'Maximum 200 characters' });

  required(path.city, { message: 'City is required' });
  minLength(path.city, 2, { message: 'Minimum 2 characters' });
  maxLength(path.city, 100, { message: 'Maximum 100 characters' });

  required(path.state, { message: 'State is required' });

  required(path.postalCode, { message: 'Postal code is required' });
  pattern(path.postalCode, /^\d{5}(-\d{4})?$/, {
    message: 'Invalid postal code format (12345 or 12345-6789)'
  });

  required(path.country, { message: 'Country is required' });
};
```

### Email with Async Validation

```typescript title="src/validators/schemas/email-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, email, validateAsync } from 'reformer/validators';
import { checkEmailAvailability } from '../../api';

export interface EmailField {
  email: string;
}

/**
 * Reusable email validation with uniqueness check
 */
export const emailWithUniquenessValidation: ValidationSchemaFn<EmailField> = (
  path: FieldPath<EmailField>
) => {
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  validateAsync(
    path.email,
    async (emailValue) => {
      if (!emailValue) return null;

      const { available } = await checkEmailAvailability(emailValue);

      if (!available) {
        return {
          code: 'email-taken',
          message: 'This email is already registered',
        };
      }

      return null;
    },
    { debounce: 300 }
  );
};
```

### Phone Number Validation

```typescript title="src/validators/schemas/phone-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, pattern } from 'reformer/validators';

export interface PhoneField {
  phone: string;
}

/**
 * Reusable phone number validation (US format)
 */
export const phoneValidation: ValidationSchemaFn<PhoneField> = (
  path: FieldPath<PhoneField>
) => {
  required(path.phone, { message: 'Phone number is required' });
  pattern(path.phone, /^(\+1\s?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/, {
    message: 'Invalid phone number format'
  });
};

/**
 * International phone validation
 */
export const internationalPhoneValidation: ValidationSchemaFn<PhoneField> = (
  path: FieldPath<PhoneField>
) => {
  required(path.phone, { message: 'Phone number is required' });
  pattern(path.phone, /^\+?[1-9]\d{1,14}$/, {
    message: 'Invalid international phone format'
  });
};
```

### Date Range Validation

```typescript title="src/validators/schemas/date-range-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, validate } from 'reformer/validators';

export interface DateRange {
  startDate: string;
  endDate: string;
}

/**
 * Reusable date range validation
 *
 * Ensures end date is after start date
 */
export const dateRangeValidation: ValidationSchemaFn<DateRange> = (
  path: FieldPath<DateRange>
) => {
  required(path.startDate, { message: 'Start date is required' });
  required(path.endDate, { message: 'End date is required' });

  // Start date cannot be in the past
  validate(path.startDate, (value) => {
    if (!value) return null;

    const startDate = new Date(value);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (startDate < today) {
      return {
        code: 'past-date',
        message: 'Start date cannot be in the past',
      };
    }

    return null;
  });

  // End date must be after start date
  validate(path.endDate, (value, ctx) => {
    if (!value) return null;

    const startDate = ctx.form.startDate.value.value;
    if (!startDate) return null;

    const start = new Date(startDate);
    const end = new Date(value);

    if (end <= start) {
      return {
        code: 'invalid-range',
        message: 'End date must be after start date',
      };
    }

    return null;
  });
};
```

### Password with Confirmation

```typescript title="src/validators/schemas/password-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, minLength, validate } from 'reformer/validators';

export interface PasswordFields {
  password: string;
  confirmPassword: string;
}

/**
 * Reusable password validation with confirmation
 */
export const passwordValidation: ValidationSchemaFn<PasswordFields> = (
  path: FieldPath<PasswordFields>
) => {
  // Password validation
  required(path.password, { message: 'Password is required' });
  minLength(path.password, 8, { message: 'Minimum 8 characters' });

  validate(path.password, (value) => {
    if (!value) return null;

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

  // Confirm password
  required(path.confirmPassword, { message: 'Please confirm password' });

  validate(path.confirmPassword, (value, ctx) => {
    const passwordValue = ctx.form.password.value.value;

    if (value && passwordValue && value !== passwordValue) {
      return {
        code: 'passwords-mismatch',
        message: 'Passwords do not match',
      };
    }

    return null;
  });
};
```

## Real-World Example

Complete example of a multi-step credit application using reusable schemas:

```typescript title="src/validators/credit-application-validation.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { apply, required, min, max, applyWhen } from 'reformer/validators';

// Import reusable schemas
import { addressValidation, type Address } from './schemas/address-validation';
import { phoneValidation, type PhoneField } from './schemas/phone-validation';
import { dateRangeValidation, type DateRange } from './schemas/date-range-validation';

interface CreditApplicationForm {
  // Step 1: Loan Details
  loanAmount: number;
  loanTerm: number;
  loanType: 'consumer' | 'mortgage' | 'car';
  loanPurpose: string;

  // Step 2: Personal Information
  firstName: string;
  lastName: string;
  middleName: string;
  birthDate: string;
  phone: string;
  email: string;

  // Step 3: Address
  registrationAddress: Address;
  residenceAddress: Address;
  sameAddress: boolean;

  // Step 4: Employment
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed' | 'retired';
  employmentStartDate: string;
  employmentEndDate: string;
  monthlyIncome: number;
}

/**
 * Main credit application validation
 *
 * Composed from multiple reusable schemas
 */
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ===================================================================
  // Step 1: Loan Details
  // ===================================================================
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan amount is 50,000' });
  max(path.loanAmount, 5000000, { message: 'Maximum loan amount is 5,000,000' });

  required(path.loanTerm, { message: 'Loan term is required' });
  min(path.loanTerm, 6, { message: 'Minimum loan term is 6 months' });
  max(path.loanTerm, 360, { message: 'Maximum loan term is 360 months' });

  required(path.loanType, { message: 'Loan type is required' });
  required(path.loanPurpose, { message: 'Loan purpose is required' });

  // ===================================================================
  // Step 2: Personal Information - Reuse phone schema
  // ===================================================================
  required(path.firstName, { message: 'First name is required' });
  required(path.lastName, { message: 'Last name is required' });
  required(path.birthDate, { message: 'Birth date is required' });

  // Reuse phone validation
  apply(path, phoneValidation);

  required(path.email, { message: 'Email is required' });

  // ===================================================================
  // Step 3: Address - Reuse address schema for both fields
  // ===================================================================
  apply(path.registrationAddress, addressValidation);

  // Only validate residence address if different from registration
  applyWhen(
    path.sameAddress,
    (same) => !same,
    (path) => {
      apply(path.residenceAddress, addressValidation);
    }
  );

  // ===================================================================
  // Step 4: Employment - Reuse date range schema
  // ===================================================================
  required(path.employmentStatus, { message: 'Employment status is required' });

  // Apply employment date validation for employed applicants
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      // Reuse date range validation for employment period
      apply(path, dateRangeValidation);

      required(path.monthlyIncome, { message: 'Monthly income is required' });
      min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
    }
  );
};

// Export validation for individual steps (for step-by-step validation)
export const STEP_VALIDATIONS = {
  1: (path: FieldPath<CreditApplicationForm>) => {
    required(path.loanAmount, { message: 'Loan amount is required' });
    min(path.loanAmount, 50000, { message: 'Minimum loan amount is 50,000' });
    max(path.loanAmount, 5000000, { message: 'Maximum loan amount is 5,000,000' });
    required(path.loanTerm, { message: 'Loan term is required' });
    min(path.loanTerm, 6, { message: 'Minimum loan term is 6 months' });
    max(path.loanTerm, 360, { message: 'Maximum loan term is 360 months' });
    required(path.loanType, { message: 'Loan type is required' });
    required(path.loanPurpose, { message: 'Loan purpose is required' });
  },
  2: (path: FieldPath<CreditApplicationForm>) => {
    required(path.firstName, { message: 'First name is required' });
    required(path.lastName, { message: 'Last name is required' });
    required(path.birthDate, { message: 'Birth date is required' });
    apply(path, phoneValidation);
    required(path.email, { message: 'Email is required' });
  },
  3: (path: FieldPath<CreditApplicationForm>) => {
    apply(path.registrationAddress, addressValidation);
    applyWhen(
      path.sameAddress,
      (same) => !same,
      (path) => apply(path.residenceAddress, addressValidation)
    );
  },
  4: (path: FieldPath<CreditApplicationForm>) => {
    required(path.employmentStatus, { message: 'Employment status is required' });
    applyWhen(
      path.employmentStatus,
      (status) => status === 'employed',
      (path) => {
        apply(path, dateRangeValidation);
        required(path.monthlyIncome, { message: 'Monthly income is required' });
        min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
      }
    );
  },
};
```

## Parameterized Reusable Schemas

Create schemas that accept configuration:

```typescript title="src/validators/schemas/configurable-schemas.ts"
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import { required, minLength, maxLength, pattern } from 'reformer/validators';

interface TextFieldConfig {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  patternMessage?: string;
  required?: boolean;
}

/**
 * Factory for creating configurable text field validation
 */
export function createTextFieldValidation(
  config: TextFieldConfig = {}
): ValidationSchemaFn<{ value: string }> {
  return (path: FieldPath<{ value: string }>) => {
    if (config.required !== false) {
      required(path.value, { message: 'This field is required' });
    }

    if (config.minLength) {
      minLength(path.value, config.minLength, {
        message: `Minimum ${config.minLength} characters`,
      });
    }

    if (config.maxLength) {
      maxLength(path.value, config.maxLength, {
        message: `Maximum ${config.maxLength} characters`,
      });
    }

    if (config.pattern) {
      pattern(path.value, config.pattern, {
        message: config.patternMessage || 'Invalid format',
      });
    }
  };
}

// Usage
const usernameValidation = createTextFieldValidation({
  minLength: 3,
  maxLength: 20,
  pattern: /^[a-zA-Z0-9_]+$/,
  patternMessage: 'Only letters, numbers, and underscores allowed',
});

const bioValidation = createTextFieldValidation({
  maxLength: 500,
  required: false,
});
```

## Best Practices

### 1. Keep Schemas Focused

```typescript
// ✅ Single responsibility - validates just address fields
export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  required(path.street, { message: 'Street is required' });
  required(path.city, { message: 'City is required' });
  // ... address fields only
};

// ❌ Mixed responsibilities
export const addressAndContactValidation: ValidationSchemaFn<AddressAndContact> = (path) => {
  // Address fields
  required(path.street, { message: 'Street is required' });
  // Contact fields
  required(path.email, { message: 'Email is required' });
  // Too many concerns in one schema
};
```

### 2. Export Type Interfaces

```typescript
// ✅ Export the interface with the schema
export interface Address {
  street: string;
  city: string;
  postalCode: string;
}

export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  // ...
};

// Now consumers can import both
import { addressValidation, type Address } from './address-validation';
```

### 3. Document Usage

```typescript
/**
 * Validates address fields
 *
 * Usage:
 * ```typescript
 * apply(path.shippingAddress, addressValidation);
 * apply([path.billing, path.shipping], addressValidation);
 * ```
 *
 * Fields validated:
 * - street (required, 3-200 chars)
 * - city (required, 2-100 chars)
 * - postalCode (required, format: 12345 or 12345-6789)
 * - country (required)
 */
export const addressValidation: ValidationSchemaFn<Address> = (path) => {
  // ...
};
```

### 4. Organize Schema Files

```
src/validators/
  schemas/
    address-validation.ts    # Address fields
    email-validation.ts      # Email field
    phone-validation.ts      # Phone field
    password-validation.ts   # Password fields
    date-range-validation.ts # Date range
  forms/
    registration-validation.ts   # Uses schemas
    checkout-validation.ts       # Uses schemas
    profile-validation.ts        # Uses schemas
```

### 5. Test Schemas Independently

```typescript
// address-validation.test.ts
import { createForm } from 'reformer';
import { addressValidation, type Address } from './address-validation';

test('validates address fields', () => {
  const form = createForm<Address>({
    initialValue: {
      street: '',
      city: '',
      postalCode: '',
      country: '',
    },
    validation: addressValidation,
  });

  form.validate();

  expect(form.field('street').errors.value).toHaveLength(1);
  expect(form.field('city').errors.value).toHaveLength(1);
});
```

### 6. Compose, Don't Duplicate

```typescript
// ✅ Compose reusable schemas
export const userFormValidation: ValidationSchemaFn<UserForm> = (path) => {
  apply(path, emailValidation);
  apply(path, passwordValidation);
  apply(path.address, addressValidation);
};

// ❌ Copy-paste validation logic
export const userFormValidation: ValidationSchemaFn<UserForm> = (path) => {
  // Duplicated email validation
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email' });

  // Duplicated password validation
  required(path.password, { message: 'Password is required' });
  minLength(path.password, 8, { message: 'Minimum 8 characters' });
  // ...
};
```

## Summary

Reusable validation schemas help you:

1. **Write less code** - Define validation once, use everywhere
2. **Maintain consistency** - Same rules across your app
3. **Simplify updates** - Change validation in one place
4. **Build complex forms** - Compose from tested pieces
5. **Improve testability** - Test schemas independently

Use `apply()` to compose schemas, and organize them in dedicated files for maximum reusability.
