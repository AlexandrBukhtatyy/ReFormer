---
sidebar_position: 2
---

# Form Schema

Form Schema defines the structure of your form data and field configuration.

## FormSchema Type

`FormSchema<T>` automatically maps your TypeScript interface to field configurations:

```typescript
import { FormSchema, GroupNode } from '@reformer/core';

interface User {
  name: string;
  email: string;
  age: number;
}

const schema: FormSchema<User> = {
  name: { value: '' },
  email: { value: '' },
  age: { value: 0 },
};

const form = new GroupNode<User>({ form: schema });
```

## Type Mapping Rules

`FormSchema<T>` uses these rules to determine field types:

| TypeScript Type               | Schema Type        | Example                    |
| ----------------------------- | ------------------ | -------------------------- |
| `string`, `number`, `boolean` | `FieldConfig<T>`   | `name: { value: '' }`      |
| `Date`, `File`, `Blob`        | `FieldConfig<T>`   | `date: { value: null }`    |
| Nested object                 | `FormSchema<T>`    | `address: { city: {...} }` |
| Array of objects              | `[FormSchema<T>]`  | `items: [{ name: {...} }]` |
| Array of primitives           | `FieldConfig<T[]>` | `tags: { value: [] }`      |

### Primitives

```typescript
interface BasicForm {
  name: string;
  age: number;
  active: boolean;
}

const schema: FormSchema<BasicForm> = {
  name: { value: '' }, // FieldConfig<string>
  age: { value: 0 }, // FieldConfig<number>
  active: { value: false }, // FieldConfig<boolean>
};
```

### Nested Objects

Objects become nested `FormSchema`:

```typescript
interface WithAddress {
  name: string;
  address: {
    street: string;
    city: string;
  };
}

const schema: FormSchema<WithAddress> = {
  name: { value: '' },
  address: {
    // FormSchema<Address>
    street: { value: '' },
    city: { value: '' },
  },
};
```

### Arrays

Arrays of objects use tuple syntax `[{...}]`:

```typescript
interface WithItems {
  title: string;
  items: Array<{
    name: string;
    price: number;
  }>;
}

const schema: FormSchema<WithItems> = {
  title: { value: '' },
  items: [
    {
      // [FormSchema<Item>]
      name: { value: '' },
      price: { value: 0 },
    },
  ],
};
```

## FieldConfig

Each field uses `FieldConfig<T>`:

```typescript
interface FieldConfig<T> {
  value: T | null; // Initial value (required)
  disabled?: boolean; // Field disabled state
  updateOn?: 'change' | 'blur' | 'submit'; // When to update
  debounce?: number; // Debounce for async validation (ms)
}
```

### Field Options

```typescript
const schema: FormSchema<User> = {
  // Basic field
  name: { value: '' },

  // Disabled by default
  email: { value: '', disabled: true },

  // Update on blur (not on every keystroke)
  password: { value: '', updateOn: 'blur' },

  // Debounce async validation
  username: { value: '', debounce: 300 },
};
```

## Optional Fields

Handle optional fields with `null`:

```typescript
interface Profile {
  name: string;
  bio?: string;
  avatar?: File;
}

const schema: FormSchema<Profile> = {
  name: { value: '' },
  bio: { value: '' }, // Use empty string for optional string
  avatar: { value: null }, // Use null for optional File
};
```

## Complex Example

```typescript
interface Order {
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    product: string;
    quantity: number;
    price: number;
  }>;
  shipping: {
    address: string;
    city: string;
    notes?: string;
  };
  express: boolean;
}

const orderSchema: FormSchema<Order> = {
  customer: {
    name: { value: '' },
    email: { value: '' },
    phone: { value: '' },
  },
  items: [
    {
      product: { value: '' },
      quantity: { value: 1 },
      price: { value: 0 },
    },
  ],
  shipping: {
    address: { value: '' },
    city: { value: '' },
    notes: { value: '' },
  },
  express: { value: false },
};

const form = new GroupNode<Order>({ form: orderSchema });
```

## Type Inference

TypeScript infers types automatically:

```typescript
const form = new GroupNode({
  form: {
    name: { value: '' },
    age: { value: 0 },
  },
});

// TypeScript knows:
form.value.name; // string
form.value.age; // number
form.controls.name; // FieldNode<string>
form.controls.age; // FieldNode<number>
```

## Next Steps

- [Validation Schema](./validation-schema) — Add validation rules
- [Behavior Schema](./behavior-schema) — Add reactive logic
- [Composition](./composition) — Reuse form schemas
