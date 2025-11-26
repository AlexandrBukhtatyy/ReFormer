---
sidebar_position: 1
---

# Built-in Validators

All built-in validators in ReFormer.

## Overview

ReFormer provides a comprehensive set of built-in validators for common validation scenarios:

| Validator | Purpose | Value Type |
|-----------|---------|------------|
| `required` | Ensure field has a value | Any |
| `min` | Minimum numeric value | `number` |
| `max` | Maximum numeric value | `number` |
| `minLength` | Minimum string/array length | `string` / `array` |
| `maxLength` | Maximum string/array length | `string` / `array` |
| `email` | Valid email format | `string` |
| `url` | Valid URL format | `string` |
| `phone` | Valid phone format | `string` |
| `pattern` | Match regular expression | `string` |
| `number` | Valid numeric value | `string` / `number` |
| `date` | Valid date format | `string` / `Date` |

## Basic Usage

Import validators from `reformer/validators`:

```typescript
import { required, email, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  loanAmount: number;
  loanTerm: number;
  email: string;
  phoneMain: string;
}

export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan: 50,000' });
  max(path.loanAmount, 5000000, { message: 'Maximum loan: 5,000,000' });

  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
};
```

## Validator API

All validators follow a consistent API pattern:

```typescript
validator(field, [value], options);
```

- **field** — Field path to validate
- **value** — Validator-specific value (limit, pattern, etc.) — optional for some validators
- **options** — Configuration object with `message` property

## required

Validates that a field has a non-empty value.

```typescript
import { required } from 'reformer/validators';

// Basic usage
required(path.loanAmount);

// With custom message
required(path.loanAmount, { message: 'Loan amount is required' });
```

Considers empty:
- `null`, `undefined`
- Empty string `''`
- Empty array `[]`

```typescript title="src/validators/basic-info-validation.ts"
interface BasicInfoForm {
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  phoneMain: string;
  email: string;
  agreeTerms: boolean;
}

export const basicInfoValidation: ValidationSchemaFn<BasicInfoForm> = (path) => {
  required(path.loanAmount, { message: 'Loan amount is required' });
  required(path.loanTerm, { message: 'Loan term is required' });
  required(path.loanPurpose, { message: 'Loan purpose is required' });
  required(path.phoneMain, { message: 'Phone number is required' });
  required(path.email, { message: 'Email is required' });
  required(path.agreeTerms, { message: 'You must accept the terms' });
};
```

## min and max

Validate numeric boundaries.

```typescript
import { min, max } from 'reformer/validators';

// Minimum value
min(path.loanAmount, 50000, { message: 'Minimum loan: 50,000' });

// Maximum value
max(path.loanAmount, 5000000, { message: 'Maximum loan: 5,000,000' });
```

```typescript title="src/validators/loan-amount-validation.ts"
interface LoanForm {
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
  dependents: number;
}

export const loanValidation: ValidationSchemaFn<LoanForm> = (path) => {
  // Loan amount: 50,000 - 5,000,000
  required(path.loanAmount, { message: 'Loan amount is required' });
  min(path.loanAmount, 50000, { message: 'Minimum loan amount: 50,000' });
  max(path.loanAmount, 5000000, { message: 'Maximum loan amount: 5,000,000' });

  // Loan term: 6 - 360 months
  required(path.loanTerm, { message: 'Loan term is required' });
  min(path.loanTerm, 6, { message: 'Minimum term: 6 months' });
  max(path.loanTerm, 360, { message: 'Maximum term: 360 months' });

  // Monthly income: minimum 10,000
  required(path.monthlyIncome, { message: 'Monthly income is required' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income: 10,000' });

  // Dependents: 0-10
  min(path.dependents, 0, { message: 'Dependents cannot be negative' });
  max(path.dependents, 10, { message: 'Maximum 10 dependents' });
};
```

## minLength and maxLength

Validate string or array length.

```typescript
import { minLength, maxLength } from 'reformer/validators';

// Minimum length
minLength(path.loanPurpose, 10, { message: 'Minimum 10 characters' });

// Maximum length
maxLength(path.loanPurpose, 500, { message: 'Maximum 500 characters' });
```

```typescript title="src/validators/text-fields-validation.ts"
interface EmploymentForm {
  companyName: string;
  position: string;
  loanPurpose: string;
  additionalIncomeSource: string;
}

export const employmentValidation: ValidationSchemaFn<EmploymentForm> = (path) => {
  // Company name: 2-100 chars
  required(path.companyName, { message: 'Company name is required' });
  minLength(path.companyName, 2, { message: 'Minimum 2 characters' });
  maxLength(path.companyName, 100, { message: 'Maximum 100 characters' });

  // Position: 2-50 chars
  required(path.position, { message: 'Position is required' });
  minLength(path.position, 2, { message: 'Minimum 2 characters' });
  maxLength(path.position, 50, { message: 'Maximum 50 characters' });

  // Loan purpose: 10-500 chars
  required(path.loanPurpose, { message: 'Please describe loan purpose' });
  minLength(path.loanPurpose, 10, { message: 'Please provide more details (min 10 chars)' });
  maxLength(path.loanPurpose, 500, { message: 'Maximum 500 characters' });

  // Additional income source (optional)
  maxLength(path.additionalIncomeSource, 200, { message: 'Maximum 200 characters' });
};
```

## email

Validates email format.

```typescript
import { email } from 'reformer/validators';

email(path.email, { message: 'Invalid email format' });
```

```typescript title="src/validators/contact-validation.ts"
interface ContactForm {
  email: string;
  emailAdditional: string;
}

export const contactValidation: ValidationSchemaFn<ContactForm> = (path) => {
  // Primary email
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  // Additional email (optional)
  email(path.emailAdditional, { message: 'Invalid email format' });
};
```

## url

Validates URL format.

```typescript
import { url } from 'reformer/validators';

url(path.companyWebsite, { message: 'Invalid URL format' });
```

```typescript title="src/validators/company-validation.ts"
interface CompanyForm {
  companyWebsite: string;
  linkedInProfile: string;
}

export const companyValidation: ValidationSchemaFn<CompanyForm> = (path) => {
  url(path.companyWebsite, { message: 'Invalid website URL' });
  url(path.linkedInProfile, { message: 'Invalid LinkedIn URL' });
};
```

## phone

Validates phone number format.

```typescript
import { phone } from 'reformer/validators';

phone(path.phoneMain, { message: 'Invalid phone format' });
```

```typescript title="src/validators/phone-validation.ts"
interface PhoneForm {
  phoneMain: string;
  phoneAdditional: string;
  companyPhone: string;
}

export const phoneValidation: ValidationSchemaFn<PhoneForm> = (path) => {
  // Main phone
  required(path.phoneMain, { message: 'Phone number is required' });
  phone(path.phoneMain, { message: 'Invalid phone format' });

  // Additional phone (optional)
  phone(path.phoneAdditional, { message: 'Invalid phone format' });

  // Company phone
  phone(path.companyPhone, { message: 'Invalid company phone format' });
};
```

## pattern

Validates against a regular expression.

```typescript
import { pattern } from 'reformer/validators';

// Russian INN (10-12 digits)
pattern(path.inn, /^\d{10,12}$/, {
  message: 'INN must be 10-12 digits'
});

// Russian SNILS (11 digits)
pattern(path.snils, /^\d{11}$/, {
  message: 'SNILS must be 11 digits'
});
```

```typescript title="src/validators/documents-validation.ts"
interface DocumentsForm {
  inn: string;
  snils: string;
  passportSeries: string;
  passportNumber: string;
}

export const documentsValidation: ValidationSchemaFn<DocumentsForm> = (path) => {
  // INN: 10-12 digits
  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{10,12}$/, {
    message: 'INN must be 10-12 digits'
  });

  // SNILS: 11 digits
  required(path.snils, { message: 'SNILS is required' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'SNILS must be 11 digits'
  });

  // Passport series: 4 digits
  required(path.passportSeries, { message: 'Passport series is required' });
  pattern(path.passportSeries, /^\d{4}$/, {
    message: 'Series must be 4 digits'
  });

  // Passport number: 6 digits
  required(path.passportNumber, { message: 'Passport number is required' });
  pattern(path.passportNumber, /^\d{6}$/, {
    message: 'Number must be 6 digits'
  });
};
```

## number

Validates that a value is a valid number.

```typescript
import { number } from 'reformer/validators';

number(path.loanAmount, { message: 'Must be a valid number' });
```

```typescript title="src/validators/numeric-validation.ts"
interface NumericForm {
  loanAmount: number;
  loanTerm: number;
  monthlyIncome: number;
  additionalIncome: number;
}

export const numericValidation: ValidationSchemaFn<NumericForm> = (path) => {
  required(path.loanAmount, { message: 'Loan amount is required' });
  number(path.loanAmount, { message: 'Loan amount must be a valid number' });

  required(path.loanTerm, { message: 'Loan term is required' });
  number(path.loanTerm, { message: 'Loan term must be a valid number' });

  required(path.monthlyIncome, { message: 'Monthly income is required' });
  number(path.monthlyIncome, { message: 'Income must be a valid number' });

  // Additional income (optional)
  number(path.additionalIncome, { message: 'Must be a valid number' });
};
```

## date

Validates date format.

```typescript
import { date } from 'reformer/validators';

date(path.birthDate, { message: 'Invalid date format' });
```

```typescript title="src/validators/date-validation.ts"
interface PersonalDataForm {
  birthDate: string;
  passportIssueDate: string;
}

export const personalDataValidation: ValidationSchemaFn<PersonalDataForm> = (path) => {
  // Birth date
  required(path.birthDate, { message: 'Birth date is required' });
  date(path.birthDate, { message: 'Invalid date format' });

  // Passport issue date
  required(path.passportIssueDate, { message: 'Issue date is required' });
  date(path.passportIssueDate, { message: 'Invalid date format' });
};
```

## Combining Validators

You can apply multiple validators to the same field:

```typescript title="src/validators/combined-validation.ts"
interface CreditApplicationForm {
  loanAmount: number;
  email: string;
  phoneMain: string;
  inn: string;
  loanPurpose: string;
}

export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Loan amount: required, number, min, max
  required(path.loanAmount, { message: 'Loan amount is required' });
  number(path.loanAmount, { message: 'Must be a valid number' });
  min(path.loanAmount, 50000, { message: 'Minimum: 50,000' });
  max(path.loanAmount, 5000000, { message: 'Maximum: 5,000,000' });

  // Email: required, email format
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  // Phone: required, phone format
  required(path.phoneMain, { message: 'Phone is required' });
  phone(path.phoneMain, { message: 'Invalid phone format' });

  // INN: required, pattern
  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{10,12}$/, { message: 'INN must be 10-12 digits' });

  // Loan purpose: required, minLength, maxLength
  required(path.loanPurpose, { message: 'Loan purpose is required' });
  minLength(path.loanPurpose, 10, { message: 'Minimum 10 characters' });
  maxLength(path.loanPurpose, 500, { message: 'Maximum 500 characters' });
};
```

## Best Practices

### 1. Always Provide Clear Messages

```typescript
// ✅ Clear, specific message
min(path.loanAmount, 50000, { message: 'Minimum loan amount: 50,000' });

// ❌ Generic message
min(path.loanAmount, 50000, { message: 'Invalid value' });
```

### 2. Order Validators Logically

```typescript
// ✅ Check existence first, then format, then boundaries
required(path.loanAmount, { message: 'Loan amount is required' });
number(path.loanAmount, { message: 'Must be a valid number' });
min(path.loanAmount, 50000, { message: 'Minimum: 50,000' });
max(path.loanAmount, 5000000, { message: 'Maximum: 5,000,000' });

// ❌ Checking boundaries before existence
min(path.loanAmount, 50000, { message: 'Minimum: 50,000' });
required(path.loanAmount, { message: 'Loan amount is required' });
```

### 3. Optional Fields Don't Need `required`

```typescript
// ✅ Optional field - only validate format if provided
email(path.emailAdditional, { message: 'Invalid email format' });
phone(path.phoneAdditional, { message: 'Invalid phone format' });

// ❌ Making optional field required
required(path.emailAdditional, { message: 'Email is required' });
email(path.emailAdditional, { message: 'Invalid format' });
```

### 4. Use Appropriate Validator Types

```typescript
// ✅ Use specific validators
email(path.email, { message: 'Invalid email' });
phone(path.phoneMain, { message: 'Invalid phone' });

// ❌ Using pattern for common formats
pattern(path.email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'Invalid email' });
```

## Next Step

Now that you understand built-in validators, let's learn about array validation.
