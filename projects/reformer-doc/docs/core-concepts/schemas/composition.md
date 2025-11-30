---
sidebar_position: 5
---

# Schema Composition

Decompose and reuse schemas across your application.

## Why Composition?

- **Avoid duplication** — Write schemas once, use everywhere
- **Consistency** — Same validation rules across forms
- **Maintainability** — Update in one place
- **Testing** — Test schemas in isolation

## Factory Functions

:::warning Always Use Factory Functions
Use functions that return schemas, not direct objects.
:::

```typescript
// ✅ Good — factory function (new object each time)
export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
});

// ❌ Bad — shared reference (forms share same object)
export const addressSchema = {
  street: { value: '' },
  city: { value: '' },
};
```

## Reusable Field Schemas

Create common field configurations:

```typescript title="schemas/common-fields.ts"
import { FieldConfig } from 'reformer';

export const emailField = (): FieldConfig<string> => ({
  value: '',
});

export const phoneField = (): FieldConfig<string> => ({
  value: '',
});

export const dateField = (): FieldConfig<Date | null> => ({
  value: null,
});

export const booleanField = (defaultValue = false): FieldConfig<boolean> => ({
  value: defaultValue,
});
```

**Usage:**

```typescript
const form = new GroupNode({
  form: {
    email: emailField(),
    phone: phoneField(),
    birthDate: dateField(),
    newsletter: booleanField(true),
  },
});
```

## Reusable Group Schemas

Create schemas for common data structures:

```typescript title="schemas/address-schema.ts"
import { FormSchema } from 'reformer';

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
}

export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
  state: { value: '' },
  zipCode: { value: '' },
});
```

```typescript title="schemas/person-schema.ts"
import { FormSchema } from 'reformer';

export interface Person {
  firstName: string;
  lastName: string;
  email: string;
}

export const personSchema = (): FormSchema<Person> => ({
  firstName: { value: '' },
  lastName: { value: '' },
  email: { value: '' },
});
```

**Composing schemas:**

```typescript
interface UserForm {
  person: Person;
  billingAddress: Address;
  shippingAddress: Address;
}

const form = new GroupNode<UserForm>({
  form: {
    person: personSchema(),
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
});
```

## Reusable Validation Sets

Extract validation logic into functions:

```typescript title="validators/address-validators.ts"
import { FieldPath } from 'reformer';
import { required, pattern } from 'reformer/validators';
import { Address } from '../schemas/address-schema';

export function validateAddress(path: FieldPath<Address>) {
  required(path.street);
  required(path.city);
  required(path.state);
  required(path.zipCode);
  pattern(path.zipCode, /^\d{5}(-\d{4})?$/, 'Invalid ZIP code');
}
```

```typescript title="validators/person-validators.ts"
import { FieldPath } from 'reformer';
import { required, email, minLength } from 'reformer/validators';
import { Person } from '../schemas/person-schema';

export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  minLength(path.firstName, 2);
  required(path.lastName);
  required(path.email);
  email(path.email);
}
```

**Usage:**

```typescript
const form = new GroupNode<UserForm>({
  form: {
    person: personSchema(),
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
  validation: (path) => {
    validatePerson(path.person);
    validateAddress(path.billingAddress);
    validateAddress(path.shippingAddress);
  },
});
```

## Reusable Behavior Sets

Extract behavior logic into functions:

```typescript title="behaviors/address-behaviors.ts"
import { FieldPath } from 'reformer';
import { transformValue } from 'reformer/behaviors';
import { Address } from '../schemas/address-schema';

export function addressBehaviors(path: FieldPath<Address>) {
  // Auto-format ZIP code
  transformValue(path.zipCode, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}
```

**Usage:**

```typescript
const form = new GroupNode<UserForm>({
  form: {
    person: personSchema(),
    billingAddress: addressSchema(),
    shippingAddress: addressSchema(),
  },
  behavior: (path) => {
    addressBehaviors(path.billingAddress);
    addressBehaviors(path.shippingAddress);
  },
});
```

## Complete Module Pattern

Bundle schema, validation, and behaviors together:

```
modules/
└── contact-info/
    ├── schema.ts       # Type + form schema
    ├── validators.ts   # Validation rules
    ├── behaviors.ts    # Reactive logic
    └── index.ts        # Public exports
```

```typescript title="modules/contact-info/schema.ts"
import { FormSchema } from 'reformer';

export interface ContactInfo {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
}

export const contactInfoSchema = (): FormSchema<ContactInfo> => ({
  email: { value: '' },
  phone: { value: '' },
  preferredContact: { value: 'email' },
});
```

```typescript title="modules/contact-info/validators.ts"
import { FieldPath } from 'reformer';
import { required, email, pattern } from 'reformer/validators';
import { ContactInfo } from './schema';

export function validateContactInfo(path: FieldPath<ContactInfo>) {
  required(path.email);
  email(path.email);
  required(path.phone);
  pattern(path.phone, /^\d{10}$/, 'Must be 10 digits');
}
```

```typescript title="modules/contact-info/behaviors.ts"
import { FieldPath } from 'reformer';
import { transformValue } from 'reformer/behaviors';
import { ContactInfo } from './schema';

export function contactInfoBehaviors(path: FieldPath<ContactInfo>) {
  transformValue(path.phone, (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
}
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoSchema, type ContactInfo } from './schema';
export { validateContactInfo } from './validators';
export { contactInfoBehaviors } from './behaviors';
```

**Usage:**

```typescript
import {
  contactInfoSchema,
  validateContactInfo,
  contactInfoBehaviors,
  type ContactInfo,
} from './modules/contact-info';

interface MyForm {
  name: string;
  contactInfo: ContactInfo;
}

const form = new GroupNode<MyForm>({
  form: {
    name: { value: '' },
    contactInfo: contactInfoSchema(),
  },
  validation: (path) => {
    required(path.name);
    validateContactInfo(path.contactInfo);
  },
  behavior: (path) => {
    contactInfoBehaviors(path.contactInfo);
  },
});
```

## Configurable Schemas

Create schema factories with options:

```typescript title="schemas/configurable-person.ts"
interface PersonSchemaOptions {
  includeMiddleName?: boolean;
  includePhone?: boolean;
}

export function createPersonSchema(
  options: PersonSchemaOptions = {}
): FormSchema<Person> {
  const schema: FormSchema<Person> = {
    firstName: { value: '' },
    lastName: { value: '' },
    email: { value: '' },
  };

  if (options.includeMiddleName) {
    schema.middleName = { value: '' };
  }

  if (options.includePhone) {
    schema.phone = { value: '' };
  }

  return schema;
}
```

**Usage:**

```typescript
// Basic person
const simple = createPersonSchema();

// Person with all fields
const detailed = createPersonSchema({
  includeMiddleName: true,
  includePhone: true,
});
```

## Recommended Folder Structure

```
src/
├── forms/                    # Form instances
│   ├── user-form.ts
│   └── order-form.ts
│
├── schemas/                  # Reusable schemas
│   ├── common-fields.ts
│   ├── address-schema.ts
│   └── person-schema.ts
│
├── validators/               # Reusable validators
│   ├── address-validators.ts
│   └── person-validators.ts
│
├── behaviors/                # Reusable behaviors
│   ├── address-behaviors.ts
│   └── format-behaviors.ts
│
└── modules/                  # Complete modules
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validators.ts
    │   ├── behaviors.ts
    │   └── index.ts
    └── payment-info/
        └── ...
```

## Best Practices

| Practice | Why |
|----------|-----|
| Use factory functions | Avoid shared references |
| Export types with schemas | Better type inference |
| Bundle related schemas | Single import for module |
| Use descriptive names | `validatePerson` not `validate1` |
| Test schemas separately | Easier debugging |

## Next Steps

- [Project Structure](/docs/patterns/project-structure) — Organization tips
