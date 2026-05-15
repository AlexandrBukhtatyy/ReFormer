---
sidebar_position: 3
---

# Step 2: Personal Information Validation

Validating names, birth date, passport, INN, and SNILS with patterns and custom validators.

## What We're Validating

Step 2 contains personal data fields that need careful validation:

| Field                     | Validation Rules                          |
| ------------------------- | ----------------------------------------- |
| `personalData.firstName`  | Required, minLength 2, Cyrillic only      |
| `personalData.lastName`   | Required, minLength 2, Cyrillic only      |
| `personalData.middleName` | Optional, Cyrillic only                   |
| `personalData.birthDate`  | Required, not in future, age 18-70        |
| `passportData.series`     | Required, exactly 4 digits                |
| `passportData.number`     | Required, exactly 6 digits                |
| `passportData.issueDate`  | Required, not in future, after birth date |
| `passportData.issuedBy`   | Required, minLength 10                    |
| `inn`                     | Required, 10 or 12 digits                 |
| `snils`                   | Required, exactly 11 digits               |

## Creating the Validator File

Create the validator file for Step 2:

```bash
touch src/schemas/validators/personal-info.ts
```

## Implementation

### Name Validation with Patterns

Validate names using the Cyrillic pattern:

```typescript title="src/schemas/validators/personal-info.ts"
import { required, minLength, pattern, validate } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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
  validate(path.personalData.lastName, required({ message: 'Last name is required' }));
  validate(path.personalData.lastName, minLength(2, { message: 'Minimum 2 characters' }));
  validate(path.personalData.lastName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  }));

  // First name
  validate(path.personalData.firstName, required({ message: 'First name is required' }));
  validate(path.personalData.firstName, minLength(2, { message: 'Minimum 2 characters' }));
  validate(path.personalData.firstName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  }));

  // Middle name (optional, but must be Cyrillic if provided)
  validate(path.personalData.middleName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  }));
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

  validate(path.personalData.birthDate, required({ message: 'Birth date is required' }));

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
  validate(path.passportData.series, required({ message: 'Passport series is required' }));
  validate(path.passportData.series, pattern(/^\d{4}$/, {
    message: 'Series must be exactly 4 digits',
  }));

  // Passport number (6 digits)
  validate(path.passportData.number, required({ message: 'Passport number is required' }));
  validate(path.passportData.number, pattern(/^\d{6}$/, {
    message: 'Number must be exactly 6 digits',
  }));

  // Issue date
  validate(path.passportData.issueDate, required({ message: 'Issue date is required' }));

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

    const birthDate = root.personalData.birthDate.value.value;
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
  validate(path.passportData.issuedBy, required({ message: 'Issuing authority is required' }));
  validate(path.passportData.issuedBy, minLength(10, { message: 'Minimum 10 characters' }));
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

  validate(path.inn, required({ message: 'INN is required' }));
  validate(path.inn, pattern(/^\d{10}$|^\d{12}$/, {
    message: 'INN must be 10 or 12 digits',
  }));

  // ==========================================
  // SNILS (Insurance Number)
  // ==========================================

  validate(path.snils, required({ message: 'SNILS is required' }));
  validate(path.snils, pattern(/^\d{11}$/, {
    message: 'SNILS must be exactly 11 digits',
  }));
};
```

## Complete Code

Here's the complete validator for Step 2:

```typescript title="src/schemas/validators/personal-info.ts"
import { required, minLength, pattern, validate } from '@reformer/core/validators';
import type { ValidationSchemaFn, FieldPath } from '@reformer/core';
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

  validate(path.personalData.lastName, required({ message: 'Last name is required' }));
  validate(path.personalData.lastName, minLength(2, { message: 'Minimum 2 characters' }));
  validate(path.personalData.lastName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  }));

  validate(path.personalData.firstName, required({ message: 'First name is required' }));
  validate(path.personalData.firstName, minLength(2, { message: 'Minimum 2 characters' }));
  validate(path.personalData.firstName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  }));

  validate(path.personalData.middleName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
    message: 'Use Cyrillic characters only',
  }));

  // ==========================================
  // Birth Date
  // ==========================================

  validate(path.personalData.birthDate, required({ message: 'Birth date is required' }));

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

  validate(path.passportData.series, required({ message: 'Passport series is required' }));
  validate(path.passportData.series, pattern(/^\d{4}$/, {
    message: 'Series must be exactly 4 digits',
  }));

  validate(path.passportData.number, required({ message: 'Passport number is required' }));
  validate(path.passportData.number, pattern(/^\d{6}$/, {
    message: 'Number must be exactly 6 digits',
  }));

  validate(path.passportData.issueDate, required({ message: 'Issue date is required' }));

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

    const birthDate = root.personalData.birthDate.value.value;
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

  validate(path.passportData.issuedBy, required({ message: 'Issuing authority is required' }));
  validate(path.passportData.issuedBy, minLength(10, { message: 'Minimum 10 characters' }));

  // ==========================================
  // INN and SNILS
  // ==========================================

  validate(path.inn, required({ message: 'INN is required' }));
  validate(path.inn, pattern(/^\d{10}$|^\d{12}$/, {
    message: 'INN must be 10 or 12 digits',
  }));

  validate(path.snils, required({ message: 'SNILS is required' }));
  validate(path.snils, pattern(/^\d{11}$/, {
    message: 'SNILS must be exactly 11 digits',
  }));
};
```

## How It Works

### Pattern Validators

```typescript
validate(path.personalData.firstName, pattern(/^[А-ЯЁа-яё\s-]+$/, {
  message: 'Use Cyrillic characters only',
}));
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
  const birthDate = root.personalData.birthDate.value.value;
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
- Access other fields via `root`
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
/^[А-ЯЁа-яё\s-]+$/;
```

### Russian Passport Series/Number

```typescript
/^\d{4}$/  // Series: 4 digits
/^\d{6}$/  // Number: 6 digits
```

### INN (Individual Taxpayer Number)

```typescript
/^\d{10}$|^\d{12}$/; // 10 or 12 digits
```

### SNILS (Insurance Number)

```typescript
/^\d{11}$/; // 11 digits
```

## What's Next?

In the next section, we'll add validation for **Step 3: Contact Information**, including:

- Email format validation
- Phone number validation
- Address validation (required fields)
- Conditional residence address validation
- Postal code format validation

We'll continue building on the patterns learned here!
