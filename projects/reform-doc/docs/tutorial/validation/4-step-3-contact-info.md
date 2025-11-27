---
sidebar_position: 4
---

# Step 3: Contact Information Validation

Validating email, phone, and address fields with format validators and conditional rules.

## What We're Validating

Step 3 contains contact and address fields:

| Field | Validation Rules |
|-------|------------------|
| `phoneMain` | Required, phone format |
| `phoneAdditional` | Optional, phone format |
| `email` | Required, email format |
| `emailAdditional` | Optional, email format |
| `registrationAddress.city` | Required |
| `registrationAddress.street` | Required |
| `registrationAddress.house` | Required |
| `registrationAddress.postalCode` | Optional, 6 digits |
| `residenceAddress.*` | Required when `sameAsRegistration` is false |

## Creating the Validator File

Create the validator file for Step 3:

```bash
touch src/schemas/validators/steps/step-3-contact-info.validators.ts
```

## Implementation

### Phone and Email Validation

Start with phone and email format validation:

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
import { required, email, phone, pattern, requiredWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 3: Contact Information
 *
 * Validates:
 * - Phone numbers (main and additional)
 * - Email addresses (main and additional)
 * - Registration address (always required)
 * - Residence address (conditionally required)
 */
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Phone Numbers
  // ==========================================

  // Main phone (required)
  required(path.phoneMain, { message: 'Main phone number is required' });
  phone(path.phoneMain, { message: 'Invalid phone format' });

  // Additional phone (optional, but must be valid if provided)
  phone(path.phoneAdditional, { message: 'Invalid phone format' });

  // ==========================================
  // Email Addresses
  // ==========================================

  // Main email (required)
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  // Additional email (optional, but must be valid if provided)
  email(path.emailAdditional, { message: 'Invalid email format' });
};
```

:::tip Format Validators
Format validators like `email()` and `phone()` automatically skip empty values. That's why we use `required()` separately for mandatory fields.
:::

### Registration Address Validation

Add validation for registration address (always required):

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Registration Address (Always Required)
  // ==========================================

  required(path.registrationAddress.city, { message: 'City is required' });

  required(path.registrationAddress.street, { message: 'Street is required' });

  required(path.registrationAddress.house, { message: 'House number is required' });

  // Apartment is optional, no validation needed

  // Postal code (optional, but must be 6 digits if provided)
  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Postal code must be 6 digits',
  });
};
```

### Residence Address Conditional Validation

Add conditional validation for residence address (required only when different from registration):

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // ... previous validation ...

  // ==========================================
  // Residence Address (Conditionally Required)
  // ==========================================

  // City - required when sameAsRegistration is false
  requiredWhen(
    path.residenceAddress.city,
    path.sameAsRegistration,
    (same) => !same,
    { message: 'City is required' }
  );

  // Street - required when sameAsRegistration is false
  requiredWhen(
    path.residenceAddress.street,
    path.sameAsRegistration,
    (same) => !same,
    { message: 'Street is required' }
  );

  // House - required when sameAsRegistration is false
  requiredWhen(
    path.residenceAddress.house,
    path.sameAsRegistration,
    (same) => !same,
    { message: 'House number is required' }
  );

  // Apartment is optional

  // Postal code (optional, but must be 6 digits if provided)
  pattern(path.residenceAddress.postalCode, /^\d{6}$/, {
    message: 'Postal code must be 6 digits',
  });
};
```

## Complete Code

Here's the complete validator for Step 3:

```typescript title="src/schemas/validators/steps/step-3-contact-info.validators.ts"
import { required, email, phone, pattern, requiredWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '@/types';

/**
 * Validation for Step 3: Contact Information
 *
 * Validates:
 * - Phone numbers (main and additional)
 * - Email addresses (main and additional)
 * - Registration address (always required)
 * - Residence address (conditionally required)
 */
export const step3ContactValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // ==========================================
  // Phone Numbers
  // ==========================================

  required(path.phoneMain, { message: 'Main phone number is required' });
  phone(path.phoneMain, { message: 'Invalid phone format' });

  phone(path.phoneAdditional, { message: 'Invalid phone format' });

  // ==========================================
  // Email Addresses
  // ==========================================

  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  email(path.emailAdditional, { message: 'Invalid email format' });

  // ==========================================
  // Registration Address (Always Required)
  // ==========================================

  required(path.registrationAddress.city, { message: 'City is required' });
  required(path.registrationAddress.street, { message: 'Street is required' });
  required(path.registrationAddress.house, { message: 'House number is required' });

  pattern(path.registrationAddress.postalCode, /^\d{6}$/, {
    message: 'Postal code must be 6 digits',
  });

  // ==========================================
  // Residence Address (Conditionally Required)
  // ==========================================

  requiredWhen(
    path.residenceAddress.city,
    path.sameAsRegistration,
    (same) => !same,
    { message: 'City is required' }
  );

  requiredWhen(
    path.residenceAddress.street,
    path.sameAsRegistration,
    (same) => !same,
    { message: 'Street is required' }
  );

  requiredWhen(
    path.residenceAddress.house,
    path.sameAsRegistration,
    (same) => !same,
    { message: 'House number is required' }
  );

  pattern(path.residenceAddress.postalCode, /^\d{6}$/, {
    message: 'Postal code must be 6 digits',
  });
};
```

## How It Works

### Email Validator

```typescript
email(path.email, { message: 'Invalid email format' });
```

- Built-in email format validation
- Checks for basic email structure: `user@domain.com`
- Skips empty values (doesn't trigger on empty fields)
- Use with `required()` for mandatory fields

### Phone Validator

```typescript
phone(path.phoneMain, { message: 'Invalid phone format' });
```

- Built-in phone format validation
- Supports various formats:
  - `+7 (999) 123-45-67`
  - `+79991234567`
  - `89991234567`
  - `9991234567`
- Skips empty values
- Use with `required()` for mandatory fields

### Conditional Required

```typescript
requiredWhen(
  path.residenceAddress.city,
  path.sameAsRegistration,  // ← Watch this field
  (same) => !same,           // ← Condition: required when false
  { message: 'City is required' }
);
```

**How it works**:
1. Watches `sameAsRegistration` field
2. When `sameAsRegistration` changes, re-evaluates condition
3. If condition returns `true`, field becomes required
4. If condition returns `false`, requirement is removed

### Integration with Behaviors

Remember from Behaviors section:

```typescript
// Behavior: Hide residence address when same as registration
hideWhen(path.residenceAddress, path.sameAsRegistration, (same) => same === true);

// Behavior: Disable residence address when same as registration
disableWhen(path.residenceAddress, path.sameAsRegistration, (same) => same === true);

// Validation: Require residence address when different
requiredWhen(
  path.residenceAddress.city,
  path.sameAsRegistration,
  (same) => !same,  // Required when NOT same
  { message: 'City is required' }
);
```

Perfect synchronization:
- When `sameAsRegistration = true` → Field **hidden** and **not required**
- When `sameAsRegistration = false` → Field **visible** and **required**

## Testing the Validation

Test these scenarios:

### Phone Validation
- [ ] Leave main phone empty → Error shown
- [ ] Enter invalid main phone format → Error shown
- [ ] Enter valid main phone → No error
- [ ] Enter invalid additional phone → Error shown (even though optional)
- [ ] Leave additional phone empty → No error

### Email Validation
- [ ] Leave main email empty → Error shown
- [ ] Enter invalid email format (no @) → Error shown
- [ ] Enter invalid email format (no domain) → Error shown
- [ ] Enter valid email → No error
- [ ] Enter invalid additional email → Error shown (even though optional)
- [ ] Leave additional email empty → No error

### Registration Address
- [ ] Leave city empty → Error shown
- [ ] Leave street empty → Error shown
- [ ] Leave house empty → Error shown
- [ ] Leave apartment empty → No error (optional)
- [ ] Enter invalid postal code (5 digits) → Error shown
- [ ] Enter invalid postal code (letters) → Error shown
- [ ] Enter valid postal code (6 digits) → No error
- [ ] Leave postal code empty → No error (optional)

### Residence Address
- [ ] Check "same as registration" → Residence fields not required
- [ ] Uncheck "same as registration" → Residence fields become required
- [ ] Leave residence city empty (when different) → Error shown
- [ ] Leave residence street empty (when different) → Error shown
- [ ] Leave residence house empty (when different) → Error shown

## Supported Phone Formats

The `phone()` validator accepts various formats:

```typescript
// All valid formats:
'+7 (999) 123-45-67'
'+79991234567'
'89991234567'
'9991234567'
'+1 (234) 567-8901'  // International
```

## Supported Email Formats

The `email()` validator follows standard email format:

```typescript
// Valid emails:
'user@example.com'
'user.name@example.com'
'user+tag@example.co.uk'
'user_name123@sub.example.org'

// Invalid emails:
'user@'              // No domain
'@example.com'       // No user
'user @example.com'  // Space in username
'user@example'       // No TLD
```

## Key Takeaways

1. **Format Validators** - Use built-in `email()` and `phone()` for formats
2. **Separate Required** - Format validators skip empty values
3. **Conditional Required** - Use `requiredWhen()` for dynamic requirements
4. **Works with Behaviors** - Hidden/disabled fields skip validation
5. **Optional Validation** - Can validate format even when not required

## Common Patterns

### Required Email
```typescript
required(path.email, { message: 'Email is required' });
email(path.email, { message: 'Invalid email format' });
```

### Optional Email (validates format if provided)
```typescript
email(path.emailAdditional, { message: 'Invalid email format' });
// No required() - field is optional
```

### Russian Postal Code
```typescript
pattern(path.postalCode, /^\d{6}$/, {
  message: 'Postal code must be 6 digits',
});
```

## What's Next?

In the next section, we'll add validation for **Step 4: Employment**, including:
- Required employment status
- Conditional validation for employed vs self-employed
- Income validation with minimum thresholds
- Work experience validation
- Business-specific field validation

We'll continue using the conditional validation patterns learned here!
