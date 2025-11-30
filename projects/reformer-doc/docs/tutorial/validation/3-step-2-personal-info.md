---
sidebar_position: 3
---

# Step 2: Personal Information Validation

Validating names, birth date, passport, INN, and SNILS with patterns and custom validators.

## What We're Validating

Step 2 contains personal data fields that need careful validation:

| Field | Validation Rules |
|-------|------------------|
| `personalData.firstName` | Required, minLength 2, Cyrillic only |
| `personalData.lastName` | Required, minLength 2, Cyrillic only |
| `personalData.middleName` | Optional, Cyrillic only |
| `personalData.birthDate` | Required, not in future, age 18-70 |
| `passportData.series` | Required, exactly 4 digits |
| `passportData.number` | Required, exactly 6 digits |
| `passportData.issueDate` | Required, not in future, after birth date |
| `passportData.issuedBy` | Required, minLength 10 |
| `inn` | Required, 10 or 12 digits |
| `snils` | Required, exactly 11 digits |

## Creating the Validator File

Create the validator file for Step 2:

```bash
touch src/schemas/validators/personal-info.ts
```

## Implementation

### Name Validation with Patterns

Validate names using the Cyrillic pattern:

```typescript title="src/schemas/validators/personal-info.ts"
import { required, minLength, pattern, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 2: Personal Information
 *
 * Validates:
 * - Full name (Cyrillic characters only)
 * - Birth date (not in future, age requirements)
 * - Passport data (format and dates)
 * - INN and SNILS (Russian identification numbers)
 */
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Personal Data: Names
  // ==========================================

  // Last name
  required(path.personalData.lastName, { message: 'Last name is required' });
  minLength(path.personalData.lastName, 2, { message: 'Minimum 2 characters' });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  });

  // First name
  required(path.personalData.firstName, { message: 'First name is required' });
  minLength(path.personalData.firstName, 2, { message: 'Minimum 2 characters' });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  });

  // Middle name (optional, but must be Cyrillic if provided)
  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  });
};
```

:::tip Pattern Validation
The pattern `/^[А-ЯЁа-яё\s-]+$/` ensures:
- Only Cyrillic letters (А-Я, а-я, Ё, ё)
- Spaces allowed (for compound names like "Мария Анна")
- Hyphens allowed (for names like "Иван-Павел")
:::

### Birth Date Validation

Add custom validation for birth date:

```typescript title="src/schemas/validators/personal-info.ts"
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Birth Date
  // ==========================================

  required(path.personalData.birthDate, { message: 'Birth date is required' });

  // Custom: Not in the future
  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDate',
        message: 'Birth date cannot be in the future',
      };
    }

    return null;
  });

  // Custom: Age between 18 and 70
  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }

    if (age < 18) {
      return {
        code: 'underAge',
        message: 'Applicant must be at least 18 years old',
      };
    }

    if (age > 70) {
      return {
        code: 'overAge',
        message: 'Applicant must be 70 years old or younger',
      };
    }

    return null;
  });
};
```

### Passport Validation

Add validation for Russian passport format:

```typescript title="src/schemas/validators/personal-info.ts"
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Passport Data
  // ==========================================

  // Passport series (4 digits)
  required(path.passportData.series, { message: 'Passport series is required' });
  pattern(path.passportData.series, /^\d{4}$/, {
    message: 'Series must be exactly 4 digits',
  });

  // Passport number (6 digits)
  required(path.passportData.number, { message: 'Passport number is required' });
  pattern(path.passportData.number, /^\d{6}$/, {
    message: 'Number must be exactly 6 digits',
  });

  // Issue date
  required(path.passportData.issueDate, { message: 'Issue date is required' });

  // Custom: Issue date not in future
  validate(path.passportData.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDateIssue',
        message: 'Issue date cannot be in the future',
      };
    }

    return null;
  });

  // Custom: Issue date must be after birth date
  validate(path.passportData.issueDate, (issueDate, ctx) => {
    if (!issueDate) return null;

    const birthDate = ctx.form.personalData.birthDate.value.value;
    if (!birthDate) return null;

    const issue = new Date(issueDate);
    const birth = new Date(birthDate);

    if (issue <= birth) {
      return {
        code: 'issueDateBeforeBirth',
        message: 'Issue date must be after birth date',
      };
    }

    return null;
  });

  // Issued by
  required(path.passportData.issuedBy, { message: 'Issuing authority is required' });
  minLength(path.passportData.issuedBy, 10, { message: 'Minimum 10 characters' });
};
```

### INN and SNILS Validation

Add validation for Russian identification numbers:

```typescript title="src/schemas/validators/personal-info.ts"
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // INN (Individual Taxpayer Number)
  // ==========================================

  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{10}$|^\d{12}$/, {
    message: 'INN must be 10 or 12 digits',
  });

  // ==========================================
  // SNILS (Insurance Number)
  // ==========================================

  required(path.snils, { message: 'SNILS is required' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'SNILS must be exactly 11 digits',
  });
};
```

## Complete Code

Here's the complete validator for Step 2:

```typescript title="src/schemas/validators/personal-info.ts"
import { required, minLength, pattern, validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 2: Personal Information
 *
 * Validates:
 * - Full name (Cyrillic characters only)
 * - Birth date (not in future, age 18-70)
 * - Passport data (format and dates)
 * - INN and SNILS (Russian identification numbers)
 */
export const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Personal Data: Names
  // ==========================================

  required(path.personalData.lastName, { message: 'Last name is required' });
  minLength(path.personalData.lastName, 2, { message: 'Minimum 2 characters' });
  pattern(path.personalData.lastName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  });

  required(path.personalData.firstName, { message: 'First name is required' });
  minLength(path.personalData.firstName, 2, { message: 'Minimum 2 characters' });
  pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  });

  pattern(path.personalData.middleName, /^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  });

  // ==========================================
  // Birth Date
  // ==========================================

  required(path.personalData.birthDate, { message: 'Birth date is required' });

  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDate',
        message: 'Birth date cannot be in the future',
      };
    }

    return null;
  });

  validate(path.personalData.birthDate, (birthDate) => {
    if (!birthDate) return null;

    const date = new Date(birthDate);
    const today = new Date();

    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
      age--;
    }

    if (age < 18) {
      return {
        code: 'underAge',
        message: 'Applicant must be at least 18 years old',
      };
    }

    if (age > 70) {
      return {
        code: 'overAge',
        message: 'Applicant must be 70 years old or younger',
      };
    }

    return null;
  });

  // ==========================================
  // Passport Data
  // ==========================================

  required(path.passportData.series, { message: 'Passport series is required' });
  pattern(path.passportData.series, /^\d{4}$/, {
    message: 'Series must be exactly 4 digits',
  });

  required(path.passportData.number, { message: 'Passport number is required' });
  pattern(path.passportData.number, /^\d{6}$/, {
    message: 'Number must be exactly 6 digits',
  });

  required(path.passportData.issueDate, { message: 'Issue date is required' });

  validate(path.passportData.issueDate, (issueDate) => {
    if (!issueDate) return null;

    const date = new Date(issueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date > today) {
      return {
        code: 'futureDateIssue',
        message: 'Issue date cannot be in the future',
      };
    }

    return null;
  });

  validate(path.passportData.issueDate, (issueDate, ctx) => {
    if (!issueDate) return null;

    const birthDate = ctx.form.personalData.birthDate.value.value;
    if (!birthDate) return null;

    const issue = new Date(issueDate);
    const birth = new Date(birthDate);

    if (issue <= birth) {
      return {
        code: 'issueDateBeforeBirth',
        message: 'Issue date must be after birth date',
      };
    }

    return null;
  });

  required(path.passportData.issuedBy, { message: 'Issuing authority is required' });
  minLength(path.passportData.issuedBy, 10, { message: 'Minimum 10 characters' });

  // ==========================================
  // INN and SNILS
  // ==========================================

  required(path.inn, { message: 'INN is required' });
  pattern(path.inn, /^\d{10}$|^\d{12}$/, {
    message: 'INN must be 10 or 12 digits',
  });

  required(path.snils, { message: 'SNILS is required' });
  pattern(path.snils, /^\d{11}$/, {
    message: 'SNILS must be exactly 11 digits',
  });
};
```

## How It Works

### Pattern Validators

```typescript
pattern(path.personalData.firstName, /^[А-ЯЁа-яё\s-]+$/, {
  message: 'Use Cyrillic characters only',
});
```

- Tests value against regular expression
- Returns error if pattern doesn't match
- Skips validation for empty values (use `required` separately)

### Custom Validators

```typescript
validate(path.personalData.birthDate, (birthDate) => {
  // Validation logic
  if (/* invalid */) {
    return { code: 'errorCode', message: 'Error message' };
  }
  return null;  // Valid
});
```

**Key points**:
- Return `null` for valid values
- Return error object `{ code, message }` for invalid values
- First check if value exists
- Use `code` property instead of `type`

### Custom Validators with Dependencies

```typescript
validate(path.passportData.issueDate, (issueDate, ctx) => {
  if (!issueDate) return null;

  // Access other field values via context
  const birthDate = ctx.form.personalData.birthDate.value.value;
  if (!birthDate) return null;

  const issue = new Date(issueDate);
  const birth = new Date(birthDate);

  if (issue <= birth) {
    return {
      code: 'issueDateBeforeBirth',
      message: 'Issue date must be after birth date',
    };
  }

  return null;
});
```

**Dependencies**:
- Validator re-runs when any dependency changes
- Access other fields via `ctx.form`
- Useful for cross-field validation

## Testing the Validation

Test these scenarios:

### Name Validation
- [ ] Leave first name empty → Error shown
- [ ] Enter first name with < 2 characters → Error shown
- [ ] Enter first name with Latin characters → Error shown
- [ ] Enter first name with Cyrillic → No error
- [ ] Repeat for last name

### Birth Date Validation
- [ ] Leave birth date empty → Error shown
- [ ] Enter future date → Error shown
- [ ] Enter date that makes age < 18 → Error shown
- [ ] Enter date that makes age > 70 → Error shown
- [ ] Enter valid age (18-70) → No error

### Passport Validation
- [ ] Leave series empty → Error shown
- [ ] Enter series with < 4 digits → Error shown
- [ ] Enter series with > 4 digits → Error shown
- [ ] Enter series with letters → Error shown
- [ ] Enter exactly 4 digits → No error
- [ ] Repeat for passport number (6 digits)
- [ ] Enter issue date in future → Error shown
- [ ] Enter issue date before birth date → Error shown

### INN and SNILS
- [ ] Leave INN empty → Error shown
- [ ] Enter INN with 9 digits → Error shown
- [ ] Enter INN with 10 digits → No error
- [ ] Enter INN with 12 digits → No error
- [ ] Leave SNILS empty → Error shown
- [ ] Enter SNILS with 10 digits → Error shown
- [ ] Enter SNILS with 11 digits → No error

## Key Takeaways

1. **Pattern Validation** - Use regex for format checking (Cyrillic, digits)
2. **Custom Validators** - Create complex validation logic
3. **Dependencies** - Validate fields against other fields
4. **Age Calculation** - Consider month and day when calculating age
5. **Date Validation** - Check for future dates and logical relationships

## Common Patterns

### Cyrillic Names
```typescript
/^[А-ЯЁа-яё\s-]+$/
```

### Russian Passport Series/Number
```typescript
/^\d{4}$/  // Series: 4 digits
/^\d{6}$/  // Number: 6 digits
```

### INN (Individual Taxpayer Number)
```typescript
/^\d{10}$|^\d{12}$/  // 10 or 12 digits
```

### SNILS (Insurance Number)
```typescript
/^\d{11}$/  // 11 digits
```

## What's Next?

In the next section, we'll add validation for **Step 3: Contact Information**, including:
- Email format validation
- Phone number validation
- Address validation (required fields)
- Conditional residence address validation
- Postal code format validation

We'll continue building on the patterns learned here!
