---
sidebar_position: 4
---

# Custom Validators

Create reusable validators for your application.

## Simple Custom Validator

A custom validator is just a pure function placed in a field's `validators` array.
It receives `(value, scope, root)` and returns a `ValidationError` (`{ code, message, params? }`)
or `null` when valid:

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ age: number }>({ age: 0 });

const schema = {
  age: {
    value: model.$.age,
    component: Input,
    // Inline custom validator
    validators: [
      (value: number) => (value < 18 ? { code: 'mustBeAdult', message: 'Must be 18+' } : null),
    ],
  },
};

const form = createForm({ model, schema });
```

## Reusable Validator Factory

Create validator functions that can be reused across your application. In M1 every
validator returns a single error, so express password strength as one rule per validator —
all validators in a field's `validators` array run and their errors accumulate:

```typescript title="validators/password.ts"
import type { Validator } from '@reformer/core';

export const hasUppercase = (): Validator<unknown, string> => (value) =>
  !value || /[A-Z]/.test(value)
    ? null
    : { code: 'noUppercase', message: 'Must contain an uppercase letter' };

export const hasLowercase = (): Validator<unknown, string> => (value) =>
  !value || /[a-z]/.test(value)
    ? null
    : { code: 'noLowercase', message: 'Must contain a lowercase letter' };

export const hasNumber = (): Validator<unknown, string> => (value) =>
  !value || /[0-9]/.test(value) ? null : { code: 'noNumber', message: 'Must contain a number' };

export const minChars =
  (min: number): Validator<unknown, string> =>
  (value) =>
    !value || value.length >= min
      ? null
      : { code: 'tooShort', message: `Must be at least ${min} characters` };
```

```typescript
// Usage in form
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';
import { hasUppercase, hasLowercase, hasNumber, minChars } from './validators/password';

// Inside the form schema:
password: {
  value: model.$.password,
  component: Input,
  validators: [required(), hasUppercase(), hasLowercase(), hasNumber(), minChars(8)],
},
```

### Display Specific Errors

```tsx
import { useFormControl } from '@reformer/core';

const { touched, errors } = useFormControl(form.password);

{
  touched && errors.find((e) => e.code === 'noUppercase') && (
    <span className="error">Must contain uppercase letter</span>
  );
}
{
  touched && errors.find((e) => e.code === 'noNumber') && (
    <span className="error">Must contain a number</span>
  );
}
{
  touched && errors.find((e) => e.code === 'tooShort') && (
    <span className="error">Must be at least 8 characters</span>
  );
}
```

## Validator with Parameters

Create configurable validators. Attach structured data through `params`:

```typescript title="validators/range.ts"
import type { Validator } from '@reformer/core';

export function range(min: number, max: number): Validator<unknown, number> {
  return (value) => {
    if (value == null) return null; // Skip if empty

    if (value < min || value > max) {
      return {
        code: 'range',
        message: `Must be between ${min} and ${max}`,
        params: { min, max, actual: value },
      };
    }
    return null;
  };
}
```

```typescript
// Usage
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';
import { range } from './validators/range';

// Inside the form schema:
quantity: {
  value: model.$.quantity,
  component: Input,
  validators: [required(), range(1, 100)],
},
```

### Error Object with Data

```tsx
import { useFormControl } from '@reformer/core';

const { touched, errors } = useFormControl(form.quantity);
const rangeError = errors.find((e) => e.code === 'range');

{
  touched && rangeError && (
    <span className="error">
      Value must be between {rangeError.params.min} and {rangeError.params.max}
    </span>
  );
}
```

## Validator with Context

Access the entire form during validation. The third argument `root` is the form model —
reading `root.someField` returns that field's current value:

```typescript title="validators/match-field.ts"
/**
 * Validates that field matches another field
 */
import type { ModelValidator } from '@reformer/core';

export function matchesPassword<TForm extends { password: string }>(): ModelValidator<
  string,
  unknown,
  TForm
> {
  return (value, _scope, root) => {
    const password = root.password;

    if (value && password && value !== password) {
      return { code: 'passwordMismatch', message: 'Passwords do not match' };
    }
    return null;
  };
}
```

```typescript
// Usage — inside the form schema:
password: { value: model.$.password, component: Input, validators: [required()] },
confirmPassword: {
  value: model.$.confirmPassword,
  component: Input,
  validators: [required(), matchesPassword()],
},
```

## Complex Custom Validator

Validator with multiple rules and custom messages. Return the first failing rule as a
distinct `code`:

```typescript title="validators/username.ts"
import type { Validator } from '@reformer/core';

export function username(): Validator<unknown, string> {
  return (value) => {
    if (!value) return null;

    // Length check
    if (value.length < 3 || value.length > 20) {
      return {
        code: 'usernameLength',
        message: 'Username must be 3–20 characters',
        params: { min: 3, max: 20, actual: value.length },
      };
    }

    // Character check
    if (!/^[a-zA-Z0-9_]+$/.test(value)) {
      return { code: 'usernameInvalidChars', message: 'Only letters, numbers and underscore' };
    }

    // Reserved words
    const reserved = ['admin', 'root', 'system'];
    if (reserved.includes(value.toLowerCase())) {
      return { code: 'usernameReserved', message: 'This username is reserved' };
    }

    return null;
  };
}
```

```typescript
// Usage — inside the form schema:
username: {
  value: model.$.username,
  component: Input,
  validators: [required(), username()],
},
```

## Cross-Field Validation

Validate relationships between fields. The third argument `root` gives access to the entire
form model. Attach the rule to the field that should carry the error and read siblings
through `root`:

```typescript
import type { ModelValidator } from '@reformer/core';

// Validate end date is after start date
const endAfterStart: ModelValidator<string, unknown, { startDate: string }> = (
  value,
  _scope,
  root
) => {
  const startDate = root.startDate;

  if (value && startDate && new Date(value) < new Date(startDate)) {
    return { code: 'endBeforeStart', message: 'End date must be after start date' };
  }
  return null;
};

// Inside the form schema:
startDate: { value: model.$.startDate, component: Input, validators: [required()] },
endDate: { value: model.$.endDate, component: Input, validators: [required(), endAfterStart] },
```

For validation that depends on multiple fields and attaches the error to a specific field,
place the validator on the chosen target field and read siblings through `root`. Run
whole-form validation with `validateFormModel(model, schema)`:

```typescript
import type { ModelValidator } from '@reformer/core';

const endAfterStart: ModelValidator<string, unknown, { startDate: string }> = (
  value,
  _scope,
  root
) => {
  const startDate = root.startDate;
  if (startDate && value && new Date(value) < new Date(startDate)) {
    return { code: 'endBeforeStart', message: 'End date must be after start date' };
  }
  return null;
};

// endDate carries the error and reads startDate through root:
endDate: { value: model.$.endDate, component: Input, validators: [endAfterStart] },
```

## Array Item Validation

Validate items in dynamic arrays. Array sections are declared as
`{ array: model.<path>, item: (itemModel) => subSchema }`:

```typescript
import { createModel, createForm, type FormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type ContactForm = {
  name: string;
  emails: { address: string }[];
};

const model = createModel<ContactForm>({
  name: '',
  emails: [{ address: '' }],
});

// Sub-schema for one array item
const emailItem = (item: FormModel<{ address: string }>) => ({
  address: {
    value: item.$.address,
    component: Input,
    // Validate each email in the array
    validators: [required(), email()],
  },
});

const schema = {
  name: { value: model.$.name, component: Input, validators: [required()] },
  emails: { array: model.emails, item: emailItem },
};

const form = createForm<ContactForm>({ model, schema });
```

## Conditional Validation with Custom Logic

Use a conditional branch node (`{ when, children }`) for conditional custom validators. When
`when` is false the subtree is skipped and its errors are cleared:

```typescript
import { validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const isNineDigits = (value: string) =>
  /^\d{9}$/.test(value) ? null : { code: 'invalidTaxId', message: 'Tax ID must be 9 digits' };

const schema = {
  children: [
    { value: model.$.country, component: Input, validators: [required()] },
    {
      // Require tax ID only for US users
      when: (_scope, root) => root.country === 'US',
      children: [
        {
          value: model.$.taxId,
          component: Input,
          validators: [required(), isNineDigits],
        },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Async Custom Validator

Check server-side data. Async validators live in `asyncValidators` and return a
`Promise<ValidationError | null>`:

```typescript title="validators/username-availability.ts"
import type { AsyncValidatorFn } from '@reformer/core';

export function checkUsernameAvailability(): AsyncValidatorFn<string> {
  return async (value) => {
    if (!value || value.length < 3) return null;

    try {
      const response = await fetch(`/api/check-username?username=${encodeURIComponent(value)}`);
      const { available } = await response.json();

      if (!available) {
        return { code: 'usernameTaken', message: 'Username is already taken' };
      }
      return null;
    } catch (error) {
      return { code: 'serverError', message: 'Could not verify username' };
    }
  };
}
```

```typescript
// Usage
import { required } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';
import { username } from './validators/username';
import { checkUsernameAvailability } from './validators/username-availability';

// Inside the form schema — async validators live in `asyncValidators`, with an
// optional per-field `debounce` (ms):
username: {
  value: model.$.username,
  component: Input,
  validators: [required(), username()],
  asyncValidators: [checkUsernameAvailability()],
  debounce: 500,
},
```

## Practical Examples

### Credit Card Validator

```typescript title="validators/credit-card.ts"
import type { Validator } from '@reformer/core';

export function creditCard(): Validator<unknown, string> {
  return (value) => {
    if (!value) return null;

    // Remove spaces and dashes
    const cleaned = value.replace(/[\s-]/g, '');

    // Check length
    if (cleaned.length < 13 || cleaned.length > 19) {
      return { code: 'invalidCardLength', message: 'Card number length is invalid' };
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
      return { code: 'invalidCard', message: 'Card number is invalid' };
    }

    return null;
  };
}
```

### Phone Number Validator

```typescript title="validators/phone.ts"
import type { Validator } from '@reformer/core';

export function phoneNumber(countryCode: string = 'US'): Validator<unknown, string> {
  return (value) => {
    if (!value) return null;

    const patterns: Record<string, RegExp> = {
      US: /^\+?1?\s*\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})$/,
      UK: /^\+?44\s?[0-9]{10}$/,
      RU: /^\+?7\s?\(?\d{3}\)?\s?\d{3}[-\s]?\d{2}[-\s]?\d{2}$/,
    };

    const pattern = patterns[countryCode];
    if (!pattern) {
      return {
        code: 'unsupportedCountry',
        message: 'Unsupported country',
        params: { countryCode },
      };
    }

    if (!pattern.test(value)) {
      return {
        code: 'invalidPhone',
        message: 'Invalid phone number',
        params: { country: countryCode },
      };
    }

    return null;
  };
}
```

```typescript
// Usage — inside the form schema:
phone: {
  value: model.$.phone,
  component: Input,
  validators: [required(), phoneNumber('US')],
},
```

### File Upload Validator

```typescript title="validators/file.ts"
import type { Validator } from '@reformer/core';

interface FileValidatorOptions {
  maxSize?: number; // in bytes
  allowedTypes?: string[];
}

export function fileValidator(options: FileValidatorOptions = {}): Validator<unknown, File> {
  return (file) => {
    if (!file) return null;

    const { maxSize = 5 * 1024 * 1024, allowedTypes } = options;

    // Check file size
    if (file.size > maxSize) {
      return {
        code: 'fileTooLarge',
        message: 'File is too large',
        params: {
          maxSize: maxSize / 1024 / 1024,
          actual: file.size / 1024 / 1024,
        },
      };
    }

    // Check file type
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      return {
        code: 'invalidFileType',
        message: 'File type is not allowed',
        params: {
          allowed: allowedTypes,
          actual: file.type,
        },
      };
    }

    return null;
  };
}
```

```typescript
// Usage — inside the form schema:
avatar: {
  value: model.$.avatar,
  component: Input,
  validators: [
    required(),
    fileValidator({
      maxSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    }),
  ],
},
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
      return { code: 'myError', message: 'Value is invalid' };
    }

    return null;
  };
}
```

### 3. Use Descriptive Error Codes

```typescript
// ✅ Good - descriptive
return { code: 'passwordTooWeak', message: 'Password is too weak' };
return { code: 'usernameTaken', message: 'Username is already taken' };

// ❌ Bad - generic
return { code: 'invalid', message: 'Invalid' };
return { code: 'error', message: 'Error' };
```

### 4. Include Useful Error Data

```typescript
// ✅ Good - provides context
return {
  code: 'tooLong',
  message: 'Value is too long',
  params: {
    max: 100,
    actual: value.length,
  },
};

// ❌ Bad - no context
return { code: 'tooLong', message: 'Value is too long' };
```

## Next Steps

- [Async Validation](/docs/validation/async) — Server-side validation
- [Behaviors](/docs/behaviors/overview) — Reactive form logic
- [Schema Composition](/docs/core-concepts/schemas/composition) — Share validators across forms
  </content>
  </invoke>
