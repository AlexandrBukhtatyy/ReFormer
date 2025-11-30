---
sidebar_position: 1
---

# Schemas Overview

ReFormer uses a three-schema architecture to separate concerns and enable maximum code reuse.

## The Three Schemas

| Schema | Purpose | Property |
|--------|---------|----------|
| **Form Schema** | Data structure and field configuration | `form` |
| **Validation Schema** | Validation rules | `validation` |
| **Behavior Schema** | Reactive logic and side effects | `behavior` |

```typescript
import { GroupNode } from 'reformer';
import { required, email } from 'reformer/validators';
import { computeFrom } from 'reformer/behaviors';

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
    required(path.firstName);
    required(path.lastName);
    required(path.email);
    email(path.email);
  },

  // 3. Behavior Schema - logic
  behavior: (path) => {
    computeFrom(
      [path.firstName, path.lastName],
      path.fullName,
      ({ firstName, lastName }) => `${firstName} ${lastName}`.trim()
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

### Reusability

Each schema can be extracted and reused independently:

```typescript
// Reusable validation set
export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  required(path.lastName);
  email(path.email);
}

// Use in multiple forms
const form1 = new GroupNode({
  form: { person: personSchema() },
  validation: (path) => validatePerson(path.person),
});

const form2 = new GroupNode({
  form: { user: personSchema() },
  validation: (path) => validatePerson(path.user),
});
```

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
  required(path.firstName);   // ✅ TypeScript knows this exists
  required(path.middleName);  // ❌ Error: 'middleName' doesn't exist
}
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
