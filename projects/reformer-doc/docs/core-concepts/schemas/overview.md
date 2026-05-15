---
sidebar_position: 1
---

# Schemas Overview

ReFormer uses a three-schema architecture to separate concerns and enable maximum code reuse.

## The Three Schemas

| Schema                | Purpose                                | Property     |
| --------------------- | -------------------------------------- | ------------ |
| **Form Schema**       | Data structure and field configuration | `form`       |
| **Validation Schema** | Validation rules                       | `validation` |
| **Behavior Schema**   | Reactive logic and side effects        | `behavior`   |

```typescript
import { GroupNode } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';

const form = new GroupNode({
  // 1. Form Schema - structure
  form: {
    firstName: { value: '' },
    lastName: { value: '' },
    fullName: { value: '' },
    email: { value: '' },
  },

  // 2. Validation Schema - rules
  validation: (path) => {
    validate(path.firstName, required());
    validate(path.lastName, required());
    validate(path.email, required());
    validate(path.email, email());
  },

  // 3. Behavior Schema - logic
  behavior: (path) => {
    computeFrom([path.firstName, path.lastName], path.fullName, ({ firstName, lastName }) =>
      `${firstName} ${lastName}`.trim()
    );
  },
});
```

## Why Three Schemas?

### Separation of Concerns

Each schema has a single responsibility:

- **Form Schema**: "What data do we collect?"
- **Validation Schema**: "Is the data correct?"
- **Behavior Schema**: "How should data react to changes?"

### Reusability & Decomposition

Each schema can be decomposed into reusable parts and combined using the `apply` function:

```typescript
import { apply, required } from '@reformer/core/validators';
import { apply as applyBehavior, watchField } from '@reformer/core/behaviors';

// 1. Reusable form schema (always use factory functions!)
const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
  zipCode: { value: '' },
});

// 2. Reusable validation schema
const addressValidation: ValidationSchemaFn<Address> = (path) => {
  validate(path.street, required());
  validate(path.city, required());
  validate(path.zipCode, required());
};

// 3. Reusable behavior schema
const addressBehavior: BehaviorSchemaFn<Address> = (path) => {
  watchField(path.zipCode, (value, ctx) => {
    // Format ZIP code
  });
};

// Compose into forms using apply()
const orderForm = new GroupNode<OrderForm>({
  form: {
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
  validation: (path) => {
    // Apply same validation to multiple fields
    apply([path.billingAddress, path.shippingAddress], addressValidation);
  },
  behavior: (path) => {
    // Apply same behavior to multiple fields
    applyBehavior([path.billingAddress, path.shippingAddress], addressBehavior);
  },
});
```

The `apply` function supports flexible composition:

```typescript
// Single field + single schema
apply(path.address, addressValidation);

// Multiple fields + single schema
apply([path.billingAddress, path.shippingAddress], addressValidation);

// Single field + multiple schemas
apply(path.email, [requiredValidation, emailValidation]);

// Multiple fields + multiple schemas
apply([path.email, path.phone], [requiredValidation, formatValidation]);
```

:::tip Factory Functions
Always use functions that return schemas (`addressSchema()`) instead of direct objects. This ensures each form gets its own instance and avoids shared state bugs.
:::

**Benefits of decomposition:**

- **DRY** — Write once, use everywhere
- **Consistency** — Same rules across all forms
- **Maintainability** — Update in one place
- **Testing** — Test each part in isolation

See [Composition](./composition) for complete patterns and best practices.

### Testability

Test each schema in isolation:

```typescript
// Test validation separately
describe('validatePerson', () => {
  it('requires firstName', () => {
    const form = new GroupNode({
      form: personSchema(),
      validation: validatePerson,
    });
    expect(form.controls.firstName.errors).toEqual({ required: true });
  });
});
```

### Type Safety

All three schemas use `FieldPath<T>` for compile-time type checking:

```typescript
validation: (path) => {
  validate(path.firstName, required()); // ✅ TypeScript knows this exists
  validate(path.middleName, required()); // ❌ Error: 'middleName' doesn't exist
};
```

## Schema Structure

```
GroupNode Config
├── form: FormSchema<T>           → Data structure
├── validation: ValidationSchemaFn<T>  → Validation rules
└── behavior: BehaviorSchemaFn<T>      → Reactive logic
```

## Next Steps

- [Form Schema](./form-schema) — Structure and field configuration
- [Validation Schema](./validation-schema) — Validation rules
- [Behavior Schema](./behavior-schema) — Reactive logic
- [Composition](./composition) — Reuse and decomposition patterns
