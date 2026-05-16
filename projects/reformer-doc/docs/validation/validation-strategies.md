---
sidebar_position: 5
---

# Validation Strategies

Advanced validation patterns and strategies for complex forms.

## Validation Timing

### Validate on Change

Immediate feedback as user types:

```typescript
const form = new GroupNode({
  form: {
    username: { value: '', updateOn: 'change' },
  },
  validation: (path) => {
    validate(path.username, required());
    validate(path.username, minLength(3));
  },
});
```

**Best for:**

- Simple fields (text, numbers)
- Real-time feedback
- Client-side validation

**Avoid for:**

- Expensive validations
- API calls

### Validate on Blur

Validate when field loses focus:

```typescript
const form = new GroupNode({
  form: {
    email: { value: '', updateOn: 'blur' },
  },
  validation: (path) => {
    validate(path.email, required());
    validate(path.email, email());
  },
});
```

**Best for:**

- Most form fields
- Better UX (less intrusive)
- Async validation with debounce

### Validate on Submit

Only validate when form is submitted:

```typescript
const form = new GroupNode({
  form: {
    feedback: { value: '', updateOn: 'submit' },
  },
  validation: (path) => {
    validate(path.feedback, required());
    validate(path.feedback, minLength(10));
  },
});

// Trigger validation manually
const handleSubmit = () => {
  form.markAsTouched();
  if (form.valid.value) {
    console.log('Valid:', form.getValue());
  }
};
```

**Best for:**

- Optional fields
- Large text areas
- Complex forms where real-time validation is distracting

## Sync vs Async Validation

### Sync-First Strategy

Run sync validation first, then async:

```typescript
const form = new GroupNode({
  form: {
    username: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    // Sync validation first
    validate(path.username, required());
    validate(path.username, minLength(3));
    validate(path.username, maxLength(20));
    validate(path.username, pattern(/^[a-zA-Z0-9_]+$/, { message: 'Invalid characters' }));

    // Async validation only if sync passes
    validateAsync(
      path.username,
      async (value) => {
        if (!value || value.length < 3) return null;

        const response = await fetch(`/api/check-username?username=${value}`);
        const { available } = await response.json();

        return available ? null : { usernameTaken: true };
      },
      { debounce: 500 }
    );
  },
});
```

**Benefits:**

- Faster feedback for basic errors
- Reduces unnecessary API calls
- Better performance

### Parallel Async Validation

Run multiple async validations in parallel:

```typescript
const form = new GroupNode({
  form: {
    username: { value: '' },
    email: { value: '' },
  },
  validation: (path, { validateAsync }) => {
    // Check username availability
    validateAsync(
      path.username,
      async (value) => {
        const response = await fetch(`/api/check-username?username=${value}`);
        const { available } = await response.json();
        return available ? null : { usernameTaken: true };
      },
      { debounce: 500 }
    );

    // Check email availability
    validateAsync(
      path.email,
      async (value) => {
        const response = await fetch(`/api/check-email?email=${value}`);
        const { available } = await response.json();
        return available ? null : { emailTaken: true };
      },
      { debounce: 500 }
    );
  },
});
```

## Conditional Validation

### Simple Conditional

Validate based on another field:

```typescript
const form = new GroupNode({
  form: {
    hasCompany: { value: false },
    companyName: { value: '' },
    companyTaxId: { value: '' },
  },
  validation: (path) => {
    // Only validate company fields if hasCompany is true
    applyWhen(
      path.hasCompany,
      (hasCompany) => hasCompany === true,
      (path) => {
        validate(path.companyName, required());
        validate(path.companyTaxId, required());
        validate(path.companyTaxId, pattern(/^\d{9}$/, { message: 'Invalid Tax ID' }));
      }
    );
  },
});
```

### Complex Conditional

Multiple conditions:

```typescript
const form = new GroupNode({
  form: {
    accountType: { value: 'personal' },
    businessName: { value: '' },
    ein: { value: '' },
    ssn: { value: '' },
  },
  validation: (path) => {
    validate(path.accountType, required());

    // Business account validation
    applyWhen(
      path.accountType,
      (accountType) => accountType === 'business',
      (path) => {
        validate(path.businessName, required());
        validate(path.ein, required());
        validate(path.ein, pattern(/^\d{2}-\d{7}$/, { message: 'Invalid EIN' }));
      }
    );

    // Personal account validation
    applyWhen(
      path.accountType,
      (accountType) => accountType === 'personal',
      (path) => {
        validate(path.ssn, required());
        validate(path.ssn, pattern(/^\d{3}-\d{2}-\d{4}$/, { message: 'Invalid SSN' }));
      }
    );
  },
});
```

## Dependent Field Validation

### Sequential Validation

Validate based on previous field:

```typescript
const form = new GroupNode({
  form: {
    password: { value: '' },
    confirmPassword: { value: '' },
  },
  validation: (path) => {
    validate(path.password, required());
    validate(path.password, minLength(8));

    validate(path.confirmPassword, required());

    // Validate confirmPassword matches password
    validate(path.confirmPassword, (value, _control, root) => {
      const password = root.password.value.value;
      if (value && password && value !== password) {
        return { passwordMismatch: true };
      }
      return null;
    });
  },
});
```

### Date Range Validation

Validate date ranges:

```typescript
const form = new GroupNode({
  form: {
    startDate: { value: null as Date | null },
    endDate: { value: null as Date | null },
  },
  validation: (path) => {
    validate(path.startDate, required());
    validate(path.endDate, required());

    // Validate end date is after start date
    validate(path.endDate, (value, _control, root) => {
      const startDate = root.startDate.value.value;

      if (!value || !startDate) return null;

      if (new Date(value) < new Date(startDate)) {
        return { endBeforeStart: true };
      }

      return null;
    });

    // Validate date range is not more than 1 year
    validate(path.endDate, (value, _control, root) => {
      const startDate = root.startDate.value.value;

      if (!value || !startDate) return null;

      const start = new Date(startDate);
      const end = new Date(value);
      const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDays > 365) {
        return { rangeTooLong: { max: 365, actual: diffDays } };
      }

      return null;
    });
  },
});
```

## Multi-Field Validation

### Cross-Field Validation

Validate multiple fields together:

```typescript
const form = new GroupNode({
  form: {
    minPrice: { value: 0 },
    maxPrice: { value: 0 },
  },
  validation: (path) => {
    validate(path.minPrice, required());
    validate(path.maxPrice, required());
    validate(path.minPrice, min(0));
    validate(path.maxPrice, min(0));

    // Validate price range
    validate(path.maxPrice, (value, _control, root) => {
      const minPrice = root.minPrice.value.value;

      if (value && minPrice && value < minPrice) {
        return {
          invalidRange: {
            message: 'Max price must be greater than min price',
          },
        };
      }

      return null;
    });
  },
});
```

### Form-Level Validation

Validate entire form:

```typescript
import { validateGroup } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    paymentMethod: { value: 'card' },
    cardNumber: { value: '' },
    bankAccount: { value: '' },
  },
  validation: (path) => {
    validate(path.paymentMethod, required());

    // Form-level validation
    validateGroup(path, (scope, _root) => {
      const { paymentMethod, cardNumber, bankAccount } = root.getValue();

      if (paymentMethod === 'card' && !cardNumber) {
        return {
          cardNumber: { required: true },
        };
      }

      if (paymentMethod === 'bank' && !bankAccount) {
        return {
          bankAccount: { required: true },
        };
      }

      return null;
    });
  },
});
```

## Array Validation Strategies

### Validate All Items

```typescript
const form = new GroupNode({
  form: {
    emails: [{ value: '' }],
  },
  validation: (path) => {
    // Each email must be valid
    validate(path.emails.$each, required());
    validate(path.emails.$each, email());
  },
});
```

### Validate Array Length

```typescript
const form = new GroupNode({
  form: {
    phoneNumbers: [{ value: '' }],
  },
  validation: (path) => {
    validate(path.phoneNumbers.$each, required());
    validate(path.phoneNumbers.$each, pattern(/^\d{10}$/, { message: 'Invalid phone' }));

    // Custom validator for array length
    validateGroup(path, (scope, _root) => {
      const phones = root.phoneNumbers.getValue();

      if (phones.length < 1) {
        return {
          phoneNumbers: {
            minItems: { required: 1, actual: phones.length },
          },
        };
      }

      if (phones.length > 5) {
        return {
          phoneNumbers: {
            maxItems: { max: 5, actual: phones.length },
          },
        };
      }

      return null;
    });
  },
});
```

### Validate Unique Items

```typescript
const form = new GroupNode({
  form: {
    tags: [{ value: '' }],
  },
  validation: (path) => {
    validate(path.tags.$each, required());

    // Validate tags are unique
    validateGroup(path, (scope, _root) => {
      const tags = root.tags.getValue();
      const uniqueTags = new Set(tags);

      if (uniqueTags.size !== tags.length) {
        return {
          tags: {
            notUnique: { message: 'Tags must be unique' },
          },
        };
      }

      return null;
    });
  },
});
```

## Performance Optimization

### Debounce Async Validation

```typescript
validation: (path, { validateAsync }) => {
  // Debounce expensive API calls
  validateAsync(
    path.username,
    async (value) => {
      const response = await fetch(`/api/check-username?username=${value}`);
      const { available } = await response.json();
      return available ? null : { usernameTaken: true };
    },
    {
      debounce: 500, // Wait 500ms after user stops typing
    }
  );
};
```

### Cancel Previous Async Validations

ReFormer automatically cancels previous async validations when new ones start:

```typescript
validation: (path, { validateAsync }) => {
  validateAsync(
    path.search,
    async (value) => {
      // This validation is automatically cancelled
      // if user types again before it completes
      const results = await searchAPI(value);
      return results.length > 0 ? null : { noResults: true };
    },
    { debounce: 300 }
  );
};
```

### Lazy Validation

Only validate when needed:

```typescript
const form = new GroupNode({
  form: {
    optionalSection: {
      field1: { value: '' },
      field2: { value: '' },
    },
  },
  validation: (path) => {
    // Only validate when a guard field is set (e.g. `enabled: boolean` in the form)
    applyWhen(
      path.optionalSection.enabled,
      (enabled) => enabled === true,
      (path) => {
        validate(path.optionalSection.field1, required());
        validate(path.optionalSection.field2, required());
      }
    );
  },
});
```

## Validation Strategies by Use Case

### Registration Form

```typescript
const form = new GroupNode({
  form: {
    username: { value: '', updateOn: 'blur' },
    email: { value: '', updateOn: 'blur' },
    password: { value: '', updateOn: 'change' },
    confirmPassword: { value: '', updateOn: 'change' },
  },
  validation: (path, { validateAsync }) => {
    // Username: sync + async
    validate(path.username, required());
    validate(path.username, minLength(3));
    validateAsync(path.username, checkUsernameAvailability(), {
      debounce: 500,
    });

    // Email: sync + async
    validate(path.email, required());
    validate(path.email, email());
    validateAsync(path.email, checkEmailAvailability(), { debounce: 500 });

    // Password: sync only
    validate(path.password, required());
    validate(path.password, minLength(8));
    validate(path.password, strongPassword());

    // Confirm password: sync dependent
    validate(path.confirmPassword, required());
    validate(path.confirmPassword, matchesPassword());
  },
});
```

### Search Form

```typescript
const form = new GroupNode({
  form: {
    query: { value: '', updateOn: 'change' },
    filters: {
      category: { value: '' },
      minPrice: { value: 0 },
      maxPrice: { value: 0 },
    },
  },
  validation: (path) => {
    // Query: minimal validation, immediate
    validate(path.query, minLength(2));

    // Filters: validate on submit
    validate(path.filters.minPrice, min(0));
    validate(path.filters.maxPrice, min(0));
    validate(path.filters.maxPrice, (value, _control, root) => {
      const minPrice = root.filters.minPrice.value.value;
      if (value && minPrice && value < minPrice) {
        return { invalidRange: true };
      }
      return null;
    });
  },
});
```

### Payment Form

```typescript
const form = new GroupNode({
  form: {
    cardNumber: { value: '', updateOn: 'blur' },
    expiryDate: { value: '', updateOn: 'blur' },
    cvv: { value: '', updateOn: 'blur' },
    billingZip: { value: '', updateOn: 'blur' },
  },
  validation: (path, { validateAsync }) => {
    // Card number: sync + async
    validate(path.cardNumber, required());
    validate(path.cardNumber, creditCard());
    validateAsync(path.cardNumber, validateCardWithBank(), {
      debounce: 1000,
    });

    // Expiry: sync only
    validate(path.expiryDate, required());
    validate(path.expiryDate, notExpired());

    // CVV: sync only
    validate(path.cvv, required());
    validate(path.cvv, pattern(/^\d{3,4}$/, { message: 'Invalid CVV' }));

    // ZIP: sync only
    validate(path.billingZip, required());
    validate(path.billingZip, pattern(/^\d{5}$/, { message: 'Invalid ZIP' }));
  },
});
```

## Best Practices

### 1. Validate Early, Validate Often

```typescript
// ✅ Good - multiple validation checks
validate(path.password, required());
validate(path.password, minLength(8));
validate(path.password, strongPassword());

// ❌ Bad - single generic validation
validate(path.password, (value) => {
  if (!value || value.length < 8 || !isStrong(value)) {
    return { invalid: true };
  }
  return null;
});
```

### 2. Provide Specific Error Messages

```typescript
// ✅ Good - specific errors
if (value.length < 8) return { tooShort: { min: 8 } };
if (!/[A-Z]/.test(value)) return { noUppercase: true };
if (!/[0-9]/.test(value)) return { noNumber: true };

// ❌ Bad - generic error
if (!isValid(value)) return { invalid: true };
```

### 3. Debounce Expensive Operations

```typescript
// ✅ Good - debounced async validation
validateAsync(path.username, checkAvailability(), { debounce: 500 });

// ❌ Bad - validates on every keystroke
validateAsync(path.username, checkAvailability());
```

### 4. Use Conditional Validation

```typescript
// ✅ Good - only validate when needed
applyWhen(
  path.hasCompany,
  (hasCompany) => hasCompany === true,
  (path) => validate(path.companyName, required())
);

// ❌ Bad - always validate, hide errors
validate(path.companyName, required());
// Then hide errors in UI - wasteful
```

### 5. Separate Sync and Async

```typescript
// ✅ Good - sync first, then async
validate(path.email, required());
validate(path.email, email());
validateAsync(path.email, checkEmailAvailability());

// ❌ Bad - only async (slower feedback)
validateAsync(path.email, async (value) => {
  if (!value) return { required: true };
  if (!isEmail(value)) return { email: true };
  const available = await checkAvailability(value);
  return available ? null : { taken: true };
});
```

## Extracting Nested Rules

When the body of `applyWhen`, `validateGroup` or `validate` grows beyond a few lines,
extract it to a **named top-level function** typed with one of the public types from
`@reformer/core`. This keeps the schema body flat (reads like a table of contents) and
surfaces the **intent** of each rule via a meaningful name.

Use the existing public types:

- `ValidationSchemaFn<TForm>` — sub-schema for `applyWhen` or `apply`.
- `GroupValidator<TForm, TScope = TForm>` — cross-field validator for `validateGroup`.
- `Validator<TForm, TField>` / `AsyncValidator<TForm, TField>` — field-level validator
  for `validate` / `validateAsync`.

### Before — inline callbacks

```typescript
export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required());

  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      validate(path.propertyValue, required());
      validate(path.propertyValue, min(1000000));
      validate(path.initialPayment, required());

      validateGroup(
        path,
        (scope) => {
          const form = scope.getValue();
          if (
            form.initialPayment &&
            form.propertyValue &&
            form.initialPayment > form.propertyValue
          ) {
            return { code: 'initialPaymentTooHigh', message: '...' };
          }
          return null;
        },
        { targetField: path.initialPayment }
      );
    }
  );
};
```

### After — extracted named functions

```typescript
import type { GroupValidator, ValidationSchemaFn } from '@reformer/core';

const initialPaymentVsPropertyValue: GroupValidator<CreditApplicationForm> = (scope) => {
  const form = scope.getValue();
  if (form.initialPayment && form.propertyValue && form.initialPayment > form.propertyValue) {
    return { code: 'initialPaymentTooHigh', message: '...' };
  }
  return null;
};

const mortgageFieldsRules: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.propertyValue, required());
  validate(path.propertyValue, min(1000000));
  validate(path.initialPayment, required());
  validateGroup(path, initialPaymentVsPropertyValue, { targetField: path.initialPayment });
};

export const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  validate(path.loanType, required());
  applyWhen(path.loanType, (type) => type === 'mortgage', mortgageFieldsRules);
};
```

### Naming convention

Use **semantic** names (not just echoing the operator):

- `applyWhen` sub-schema → describes the conditional branch:
  `mortgageFieldsRules`, `employedFieldsRules`, `residenceAddressRules`.
- `GroupValidator` → describes the invariant being checked:
  `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`, `currentExperienceVsTotal`.
- `Validator` → describes the field-level check:
  `validateAdultAge`, `validatePasswordsMatch`, `validatePassportIssueDateNotFuture`.

### When to extract

- **Extract** any body that spans more than ~3 lines or contains a nested
  `validateGroup` / `applyWhen`.
- **Keep inline** short one-line conditions inside `applyWhen` —
  `(type) => type === 'mortgage'` doesn't benefit from being named.

## Next Steps

- [Error Handling](/docs/validation/error-handling) — Handle and display validation errors
- [Custom Validators](/docs/validation/custom) — Create custom validation logic
- [Async Validation](/docs/validation/async) — Server-side validation patterns
