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
    required(path.username);
    minLength(path.username, 3);
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
    required(path.email);
    email(path.email);
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
    required(path.feedback);
    minLength(path.feedback, 10);
  },
});

// Trigger validation manually
const handleSubmit = () => {
  form.markAllAsTouched();
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
    required(path.username);
    minLength(path.username, 3);
    maxLength(path.username, 20);
    pattern(path.username, /^[a-zA-Z0-9_]+$/, 'Invalid characters');

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
    when(
      () => form.controls.hasCompany.value.value,
      (path) => {
        required(path.companyName);
        required(path.companyTaxId);
        pattern(path.companyTaxId, /^\d{9}$/, 'Invalid Tax ID');
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
    required(path.accountType);

    // Business account validation
    when(
      () => form.controls.accountType.value.value === 'business',
      (path) => {
        required(path.businessName);
        required(path.ein);
        pattern(path.ein, /^\d{2}-\d{7}$/, 'Invalid EIN');
      }
    );

    // Personal account validation
    when(
      () => form.controls.accountType.value.value === 'personal',
      (path) => {
        required(path.ssn);
        pattern(path.ssn, /^\d{3}-\d{2}-\d{4}$/, 'Invalid SSN');
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
    required(path.password);
    minLength(path.password, 8);

    required(path.confirmPassword);

    // Validate confirmPassword matches password
    validate(path.confirmPassword, (value, ctx) => {
      const password = ctx.form.password.value.value;
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
    required(path.startDate);
    required(path.endDate);

    // Validate end date is after start date
    validate(path.endDate, (value, ctx) => {
      const startDate = ctx.form.startDate.value.value;

      if (!value || !startDate) return null;

      if (new Date(value) < new Date(startDate)) {
        return { endBeforeStart: true };
      }

      return null;
    });

    // Validate date range is not more than 1 year
    validate(path.endDate, (value, ctx) => {
      const startDate = ctx.form.startDate.value.value;

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
    required(path.minPrice);
    required(path.maxPrice);
    min(path.minPrice, 0);
    min(path.maxPrice, 0);

    // Validate price range
    validate(path.maxPrice, (value, ctx) => {
      const minPrice = ctx.form.minPrice.value.value;

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
import { validateTree } from 'reformer/validators';

const form = new GroupNode({
  form: {
    paymentMethod: { value: 'card' },
    cardNumber: { value: '' },
    bankAccount: { value: '' },
  },
  validation: (path) => {
    required(path.paymentMethod);

    // Form-level validation
    validateTree((ctx) => {
      const { paymentMethod, cardNumber, bankAccount } = ctx.form.getValue();

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
    required(path.emails.$each);
    email(path.emails.$each);
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
    required(path.phoneNumbers.$each);
    pattern(path.phoneNumbers.$each, /^\d{10}$/, 'Invalid phone');

    // Custom validator for array length
    validateTree((ctx) => {
      const phones = ctx.form.phoneNumbers.getValue();

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
    required(path.tags.$each);

    // Validate tags are unique
    validateTree((ctx) => {
      const tags = ctx.form.tags.getValue();
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
}
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
}
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
    // Only validate if section is visible/enabled
    when(
      () => form.controls.optionalSection.visible.value,
      (path) => {
        required(path.optionalSection.field1);
        required(path.optionalSection.field2);
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
    required(path.username);
    minLength(path.username, 3);
    validateAsync(path.username, checkUsernameAvailability(), {
      debounce: 500,
    });

    // Email: sync + async
    required(path.email);
    email(path.email);
    validateAsync(path.email, checkEmailAvailability(), { debounce: 500 });

    // Password: sync only
    required(path.password);
    minLength(path.password, 8);
    validate(path.password, strongPassword());

    // Confirm password: sync dependent
    required(path.confirmPassword);
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
    minLength(path.query, 2);

    // Filters: validate on submit
    min(path.filters.minPrice, 0);
    min(path.filters.maxPrice, 0);
    validate(path.filters.maxPrice, (value, ctx) => {
      const minPrice = ctx.form.filters.minPrice.value.value;
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
    required(path.cardNumber);
    validate(path.cardNumber, creditCard());
    validateAsync(path.cardNumber, validateCardWithBank(), {
      debounce: 1000,
    });

    // Expiry: sync only
    required(path.expiryDate);
    validate(path.expiryDate, notExpired());

    // CVV: sync only
    required(path.cvv);
    pattern(path.cvv, /^\d{3,4}$/, 'Invalid CVV');

    // ZIP: sync only
    required(path.billingZip);
    pattern(path.billingZip, /^\d{5}$/, 'Invalid ZIP');
  },
});
```

## Best Practices

### 1. Validate Early, Validate Often

```typescript
// ✅ Good - multiple validation checks
required(path.password);
minLength(path.password, 8);
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
when(
  () => form.controls.hasCompany.value.value,
  (path) => required(path.companyName)
);

// ❌ Bad - always validate, hide errors
required(path.companyName);
// Then hide errors in UI - wasteful
```

### 5. Separate Sync and Async

```typescript
// ✅ Good - sync first, then async
required(path.email);
email(path.email);
validateAsync(path.email, checkEmailAvailability());

// ❌ Bad - only async (slower feedback)
validateAsync(path.email, async (value) => {
  if (!value) return { required: true };
  if (!isEmail(value)) return { email: true };
  const available = await checkAvailability(value);
  return available ? null : { taken: true };
});
```

## Next Steps

- [Error Handling](/docs/patterns/error-handling) — Handle and display validation errors
- [Custom Validators](/docs/validation/custom) — Create custom validation logic
- [Async Validation](/docs/validation/async) — Server-side validation patterns
