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
    validate(path.name, required());
    validate(path.name, minLength(2));
    validate(path.email, required());
    validate(path.email, email());
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
  validate(path.name, required()); // ✅ Valid
  validate(path.email, required()); // ✅ Valid
  validate(path.address.city, required()); // ✅ Valid - nested access
  validate(path.phone, required()); // ❌ TypeScript error!
};
```

### Benefits

1. **Autocomplete** — IDE shows available fields
2. **Compile-time checks** — Catch typos early
3. **Refactoring support** — Rename fields safely

## Built-in Validators

| Validator                    | Description           |
| ---------------------------- | --------------------- |
| `validate(path.field, required())`       | Field must have value |
| `validate(path.field, email())`          | Valid email format    |
| `validate(path.field, minLength(n))`   | Minimum string length |
| `validate(path.field, maxLength(n))`   | Maximum string length |
| `validate(path.field, min(n))`         | Minimum number        |
| `validate(path.field, max(n))`         | Maximum number        |
| `validate(path.field, pattern(regex))` | Match regex           |

See [Built-in Validators](/docs/validation/built-in) for full list.

## Conditional Validation

Apply validators based on conditions:

```typescript
import { applyWhen, validate, required, pattern } from '@reformer/core/validators';

validation: (path) => {
  validate(path.email, required());

  // Only validate phone if user wants SMS
  applyWhen(
    path.wantsSms,
    (wantsSms) => wantsSms === true,
    (path) => {
      validate(path.phone, required());
      validate(path.phone, pattern(/^\d{10}$/));
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
  validate(path.customer.name, required());
  validate(path.customer.email, email());

  // Array items (validates each item's template)
  validate(path.items.product, required());
  validate(path.items.quantity, min(1));
};
```

## Cross-Field Validation

Validate fields against each other:

```typescript
import { custom } from '@reformer/core/validators';

validation: (path) => {
  validate(path.password, required());
  validate(path.confirmPassword, required());

  custom(path.confirmPassword, (value, _control, root) => {
    const password = root.password.value;
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
  validate(path.username, required());

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
  validate(path.firstName, required());
  validate(path.firstName, minLength(2));
  validate(path.lastName, required());
  validate(path.email, required());
  validate(path.email, email());
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
