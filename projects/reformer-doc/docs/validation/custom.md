---
sidebar_position: 4
---

# Custom Validators

Create reusable validators for your application.

## Simple Custom Validator

Use `validate()` for inline custom validators:

```typescript
import { validate } from 'reformer/validators';

validation: (path) => {
  // Inline custom validator
  validate(path.age, (value) => {
    if (value < 18) {
      return { mustBeAdult: true };
    }
    return null;
  });
}
// Error: { mustBeAdult: true }
```

## Reusable Validator Factory

Create validator functions that can be reused across your application:

```typescript title="validators/password.ts"
/**
 * Validates password strength
 * Requires: uppercase, lowercase, number, min 8 chars
 */
export function strongPassword() {
  return (value: string) => {
    if (!value) return null; // Skip if empty (use required() separately)

    const errors: Record<string, boolean> = {};

    if (!/[A-Z]/.test(value)) {
      errors.noUppercase = true;
    }
    if (!/[a-z]/.test(value)) {
      errors.noLowercase = true;
    }
    if (!/[0-9]/.test(value)) {
      errors.noNumber = true;
    }
    if (value.length < 8) {
      errors.tooShort = true;
    }

    return Object.keys(errors).length ? errors : null;
  };
}

// Usage in form
import { required } from 'reformer/validators';
import { strongPassword } from './validators/password';

validation: (path) => {
  required(path.password);
  validate(path.password, strongPassword());
}
```

### Display Specific Errors

```tsx
{password.touched && password.errors?.noUppercase && (
  <span className="error">Must contain uppercase letter</span>
)}
{password.touched && password.errors?.noNumber && (
  <span className="error">Must contain a number</span>
)}
{password.touched && password.errors?.tooShort && (
  <span className="error">Must be at least 8 characters</span>
)}
```

## Validator with Parameters

Create configurable validators:

```typescript title="validators/range.ts"
export function range(min: number, max: number) {
  return (value: number) => {
    if (value == null) return null; // Skip if empty

    if (value < min || value > max) {
      return {
        range: {
          min,
          max,
          actual: value
        }
      };
    }
    return null;
  };
}

// Usage
import { range } from './validators/range';

validation: (path) => {
  required(path.quantity);
  validate(path.quantity, range(1, 100));
}
```

### Error Object with Data

```tsx
{quantity.touched && quantity.errors?.range && (
  <span className="error">
    Value must be between {quantity.errors.range.min} and {quantity.errors.range.max}
  </span>
)}
```

## Validator with Context

Access the entire form during validation:

```typescript title="validators/match-field.ts"
/**
 * Validates that field matches another field
 */
export function matchesPassword() {
  return (value: string, ctx) => {
    const password = ctx.form.password.value.value;

    if (value && password && value !== password) {
      return { passwordMismatch: true };
    }
    return null;
  };
}

// Usage
validation: (path) => {
  required(path.password);
  required(path.confirmPassword);
  validate(path.confirmPassword, matchesPassword());
}
```

## Complex Custom Validator

Validator with multiple rules and custom messages:

```typescript title="validators/username.ts"
export function username() {
  return (value: string) => {
    if (!value) return null;

    // Length check
    if (value.length < 3 || value.length > 20) {
      return {
        usernameLength: { min: 3, max: 20, actual: value.length }
      };
    }

    // Character check
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return { usernameInvalidChars: true };
    }

    // Reserved words
    const reserved = ['admin', 'root', 'system'];
    if (reserved.includes(value.toLowerCase())) {
      return { usernameReserved: true };
    }

    return null;
  };
}

// Usage
validation: (path) => {
  required(path.username);
  validate(path.username, username());
}
```

## Cross-Field Validation

Validate relationships between fields:

```typescript
validation: (path) => {
  required(path.startDate);
  required(path.endDate);

  // Validate end date is after start date
  validate(path.endDate, (value, ctx) => {
    const startDate = ctx.form.startDate.value.value;

    if (value && startDate && new Date(value) < new Date(startDate)) {
      return { endBeforeStart: true };
    }
    return null;
  });
}
```

## Array Item Validation

Validate items in dynamic arrays:

```typescript
interface ContactForm {
  name: string;
  emails: string[];
}

const form = new GroupNode<ContactForm>({
  form: {
    name: { value: '' },
    emails: [{ value: '' }],
  },
  validation: (path) => {
    required(path.name);

    // Validate each email in the array
    required(path.emails.$each);
    email(path.emails.$each);
  },
});
```

## Conditional Validation with Custom Logic

Use `when()` for conditional custom validators:

```typescript
import { when } from 'reformer/validators';

validation: (path) => {
  required(path.country);

  // Require tax ID only for US users
  when(
    () => form.controls.country.value === 'US',
    (path) => {
      required(path.taxId);
      validate(path.taxId, (value) => {
        if (!/^\d{9}$/.test(value)) {
          return { invalidTaxId: true };
        }
        return null;
      });
    }
  );
}
```

## Async Custom Validator

Check server-side data:

```typescript title="validators/username-availability.ts"
export function checkUsernameAvailability() {
  return async (value: string) => {
    if (!value || value.length < 3) return null;

    try {
      const response = await fetch(
        `/api/check-username?username=${encodeURIComponent(value)}`
      );
      const { available } = await response.json();

      if (!available) {
        return { usernameTaken: true };
      }
      return null;
    } catch (error) {
      return { serverError: true };
    }
  };
}

// Usage
import { validateAsync } from 'reformer/validators';

validation: (path, { validateAsync }) => {
  required(path.username);
  validate(path.username, username());

  // Async validation with debounce
  validateAsync(path.username, checkUsernameAvailability(), {
    debounce: 500,
  });
}
```

## Practical Examples

### Credit Card Validator

```typescript title="validators/credit-card.ts"
export function creditCard() {
  return (value: string) => {
    if (!value) return null;

    // Remove spaces and dashes
    const cleaned = value.replace(/[\s-]/g, '');

    // Check length
    if (cleaned.length < 13 || cleaned.length > 19) {
      return { invalidCardLength: true };
    }

    // Luhn algorithm
    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    if (sum % 10 !== 0) {
      return { invalidCard: true };
    }

    return null;
  };
}
```

### Phone Number Validator

```typescript title="validators/phone.ts"
export function phoneNumber(countryCode: string = 'US') {
  return (value: string) => {
    if (!value) return null;

    const patterns = {
      US: /^\+?1?\s*\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
      UK: /^\+?44\s?[0-9]{10}$/,
      RU: /^\+?7\s?\(?\d{3}\)?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/,
    };

    const pattern = patterns[countryCode];
    if (!pattern) {
      return { unsupportedCountry: true };
    }

    if (!pattern.test(value)) {
      return { invalidPhone: { country: countryCode } };
    }

    return null;
  };
}

// Usage
validation: (path) => {
  required(path.phone);
  validate(path.phone, phoneNumber('US'));
}
```

### File Upload Validator

```typescript title="validators/file.ts"
interface FileValidatorOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

export function fileValidator(options: FileValidatorOptions = {}) {
  return (file: File) => {
    if (!file) return null;

    const { maxSize = 5 * 1024 * 1024, allowedTypes } = options;

    // Check file size
    if (file.size > maxSize) {
      return {
        fileTooLarge: {
          maxSize: maxSize / 1024 / 1024,
          actual: file.size / 1024 / 1024,
        },
      };
    }

    // Check file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return {
        invalidFileType: {
          allowed: allowedTypes,
          actual: file.type,
        },
      };
    }

    return null;
  };
}

// Usage
validation: (path) => {
  required(path.avatar);
  validate(
    path.avatar,
    fileValidator({
      maxSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
  );
}
```

## Tips for Custom Validators

### 1. Return Null for Valid Values

```typescript
// ✅ Good
return null;

// ❌ Bad
return undefined;
return {};
```

### 2. Skip Empty Values

Let `required()` handle empty values:

```typescript
export function myValidator() {
  return (value: string) => {
    if (!value) return null; // Skip empty values

    // Validation logic
    if (isInvalid(value)) {
      return { myError: true };
    }

    return null;
  };
}
```

### 3. Use Descriptive Error Keys

```typescript
// ✅ Good - descriptive
return { passwordTooWeak: true };
return { usernameTaken: true };

// ❌ Bad - generic
return { invalid: true };
return { error: true };
```

### 4. Include Useful Error Data

```typescript
// ✅ Good - provides context
return {
  tooLong: {
    max: 100,
    actual: value.length
  }
};

// ❌ Bad - no context
return { tooLong: true };
```

## Next Steps

- [Async Validation](/docs/validation/async) — Server-side validation
- [Behaviors](/docs/behaviors/overview) — Reactive form logic
- [Patterns: Reusable Schemas](/docs/patterns/reusable-schemas) — Share validators across forms
