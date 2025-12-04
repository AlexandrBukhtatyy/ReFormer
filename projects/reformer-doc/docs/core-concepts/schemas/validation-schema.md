---
sidebar_position: 3
---

# Validation Schema

Validation Schema defines rules for validating form data.

## ValidationSchemaFn Type

```typescript
type ValidationSchemaFn<T> = (path: FieldPath<T>) => void;
```

The validation function receives a type-safe `path` object for declaring validation rules:

```typescript
import { GroupNode } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

const form = new GroupNode({
  form: {
    name: { value: '' },
    email: { value: '' },
  },
  validation: (path) => {
    required(path.name);
    minLength(path.name, 2);
    required(path.email);
    email(path.email);
  },
});
```

## FieldPath — Type-Safe Paths

`FieldPath<T>` provides type-safe access to form fields:

```typescript
interface User {
  name: string;
  email: string;
  address: {
    city: string;
    zip: string;
  };
}

validation: (path: FieldPath<User>) => {
  required(path.name); // ✅ Valid
  required(path.email); // ✅ Valid
  required(path.address.city); // ✅ Valid - nested access
  required(path.phone); // ❌ TypeScript error!
};
```

### Benefits

1. **Autocomplete** — IDE shows available fields
2. **Compile-time checks** — Catch typos early
3. **Refactoring support** — Rename fields safely

## Built-in Validators

| Validator                    | Description           |
| ---------------------------- | --------------------- |
| `required(path.field)`       | Field must have value |
| `email(path.field)`          | Valid email format    |
| `minLength(path.field, n)`   | Minimum string length |
| `maxLength(path.field, n)`   | Maximum string length |
| `min(path.field, n)`         | Minimum number        |
| `max(path.field, n)`         | Maximum number        |
| `pattern(path.field, regex)` | Match regex           |

See [Built-in Validators](/docs/validation/built-in) for full list.

## Conditional Validation

Apply validators based on conditions:

```typescript
import { when } from '@reformer/core/validators';

validation: (path) => {
  required(path.email);

  // Only validate phone if user wants SMS
  when(
    () => form.controls.wantsSms.value === true,
    () => {
      required(path.phone);
      pattern(path.phone, /^\d{10}$/);
    }
  );
};
```

## Nested Validation

Validate nested objects and arrays:

```typescript
interface Order {
  customer: {
    name: string;
    email: string;
  };
  items: Array<{
    product: string;
    quantity: number;
  }>;
}

validation: (path) => {
  // Nested object
  required(path.customer.name);
  email(path.customer.email);

  // Array items (validates each item's template)
  required(path.items.product);
  min(path.items.quantity, 1);
};
```

## Cross-Field Validation

Validate fields against each other:

```typescript
import { custom } from '@reformer/core/validators';

validation: (path) => {
  required(path.password);
  required(path.confirmPassword);

  custom(path.confirmPassword, (value, ctx) => {
    const password = ctx.form.password.value;
    if (value !== password) {
      return { match: 'Passwords must match' };
    }
    return null;
  });
};
```

## Async Validation

Server-side validation:

```typescript
import { asyncValidator } from '@reformer/core/validators';

validation: (path) => {
  required(path.username);

  asyncValidator(path.username, async (value) => {
    const exists = await checkUsername(value);
    if (exists) {
      return { taken: 'Username already taken' };
    }
    return null;
  });
};
```

See [Async Validation](/docs/validation/async) for details.

## Extracting Validation Sets

Create reusable validation functions:

```typescript
import { FieldPath } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';

// Reusable validation set
export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  minLength(path.firstName, 2);
  required(path.lastName);
  required(path.email);
  email(path.email);
}

// Usage
const form = new GroupNode({
  form: {
    user: personSchema(),
    admin: personSchema(),
  },
  validation: (path) => {
    validatePerson(path.user);
    validatePerson(path.admin);
  },
});
```

## Next Steps

- [Validation Overview](/docs/validation/overview) — Detailed validation guide
- [Built-in Validators](/docs/validation/built-in) — All validators
- [Custom Validators](/docs/validation/custom) — Create your own
- [Composition](./composition) — Reuse validation sets
