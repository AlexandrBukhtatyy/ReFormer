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
Use functions that return schema fragments, not direct objects.
:::

```typescript
// ✅ Good — builder returns a fresh fragment bound to the given model signals
export const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input },
  city: { value: s.city, component: Input },
});

// ❌ Bad — a shared object literal: not bound to a model, reused by reference
export const addressNodes = {
  street: { value: '' },
  city: { value: '' },
};
```

## Reusable Field Schemas

Create common field configurations:

```typescript title="schemas/common-fields.ts"
import type { PathAwareSignal } from '@reformer/core';
import { Input, Checkbox } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';

// Field builders take a model signal; the initial value lives in the model
export const emailField = (value: PathAwareSignal<string>) => ({
  value,
  component: Input,
  componentProps: { type: 'email' },
  validators: [required(), email()],
});

export const phoneField = (value: PathAwareSignal<string>) => ({
  value,
  component: Input,
  componentProps: { type: 'tel' },
});

export const dateField = (value: PathAwareSignal<Date | null>) => ({
  value,
  component: Input,
  componentProps: { type: 'date' },
});

export const booleanField = (value: PathAwareSignal<boolean>) => ({
  value,
  component: Checkbox,
});
```

**Usage:**

```typescript
import { createModel, createForm } from '@reformer/core';

type ProfileForm = {
  email: string;
  phone: string;
  birthDate: Date | null;
  newsletter: boolean;
};

// Defaults (e.g. newsletter: true) live in the model, not the field builder
const model = createModel<ProfileForm>({
  email: '',
  phone: '',
  birthDate: null,
  newsletter: true,
});

const schema = {
  email: emailField(model.$.email),
  phone: phoneField(model.$.phone),
  birthDate: dateField(model.$.birthDate),
  newsletter: booleanField(model.$.newsletter),
};

const form = createForm<ProfileForm>({ model, schema });
```

## Reusable Group Schemas

Create schemas for common data structures:

```typescript title="schemas/address-schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Address = {
  street: string;
  city: string;
  state: string;
  zipCode: string;
};

// Builder binds each field to the passed sub-model signals
export const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input },
  city: { value: s.city, component: Input },
  state: { value: s.state, component: Input },
  zipCode: { value: s.zipCode, component: Input },
});
```

```typescript title="schemas/person-schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

export type Person = {
  firstName: string;
  lastName: string;
  email: string;
};

export const personNodes = (s: ModelSignals<Person>) => ({
  firstName: { value: s.firstName, component: Input },
  lastName: { value: s.lastName, component: Input },
  email: { value: s.email, component: Input },
});
```

**Composing schemas:**

```typescript
type UserForm = {
  person: Person;
  billingAddress: Address;
  shippingAddress: Address;
};

const model = createModel<UserForm>({
  person: { firstName: '', lastName: '', email: '' },
  billingAddress: { street: '', city: '', state: '', zipCode: '' },
  shippingAddress: { street: '', city: '', state: '', zipCode: '' },
});

// Each builder call returns a fresh fragment bound to its own sub-model
const schema = {
  person: personNodes(model.$.person),
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Reusable Validation Sets

Extract validation logic into functions:

```typescript title="validators/address-validators.ts"
import { required, pattern } from '@reformer/core/validators';

// Reusable validator lists — spread into a schema node's `validators`
export const addressValidators = {
  street: () => [required()],
  city: () => [required()],
  state: () => [required()],
  zipCode: () => [required(), pattern(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code' })],
};
```

```typescript title="validators/person-validators.ts"
import { required, email, minLength } from '@reformer/core/validators';

export const personValidators = {
  firstName: () => [required(), minLength(2)],
  lastName: () => [required()],
  email: () => [required(), email()],
};
```

**Usage:**

```typescript
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';
import { addressValidators } from './validators/address-validators';
import { personValidators } from './validators/person-validators';

// Bake the reusable validator lists into the builders
const addressNodes = (s: ModelSignals<Address>) => ({
  street: { value: s.street, component: Input, validators: addressValidators.street() },
  city: { value: s.city, component: Input, validators: addressValidators.city() },
  state: { value: s.state, component: Input, validators: addressValidators.state() },
  zipCode: { value: s.zipCode, component: Input, validators: addressValidators.zipCode() },
});

const personNodes = (s: ModelSignals<Person>) => ({
  firstName: { value: s.firstName, component: Input, validators: personValidators.firstName() },
  lastName: { value: s.lastName, component: Input, validators: personValidators.lastName() },
  email: { value: s.email, component: Input, validators: personValidators.email() },
});

// The same validator lists apply to billing and shipping addresses
const schema = {
  person: personNodes(model.$.person),
  billingAddress: addressNodes(model.$.billingAddress),
  shippingAddress: addressNodes(model.$.shippingAddress),
};

const form = createForm<UserForm>({ model, schema });
```

## Reusable Behavior Sets

Extract behavior logic into functions:

```typescript title="behaviors/address-behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { ModelSignals } from '@reformer/core';
import type { Address } from '../schemas/address-schema';

// Reusable behavior fragment — call it once per address inside defineFormBehavior
export function addressBehaviors(s: ModelSignals<Address>) {
  // Auto-format ZIP code (idempotent: reformatting a formatted value is a no-op)
  transformValue(s.zipCode, (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length === 9) {
      return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    return value;
  });
}
```

**Usage:**

```typescript
import { defineFormBehavior } from '@reformer/core/behaviors';
import { addressBehaviors } from './behaviors/address-behaviors';

const userBehavior = defineFormBehavior<UserForm>(({ model }) => {
  addressBehaviors(model.$.billingAddress);
  addressBehaviors(model.$.shippingAddress);
});

const form = createForm<UserForm>({ model, schema, behavior: userBehavior });
```

## Complete Module Pattern

Bundle schema, validation, and behaviors together:

```
modules/
└── contact-info/
    ├── schema.ts       # Type + schema builder
    ├── validators.ts   # Reusable validator lists
    ├── behaviors.ts    # Reactive logic
    └── index.ts        # Public exports
```

```typescript title="modules/contact-info/schema.ts"
import type { ModelSignals } from '@reformer/core';
import { Input, Select } from '@reformer/ui-kit';
import { contactInfoValidators } from './validators';

export type ContactInfo = {
  email: string;
  phone: string;
  preferredContact: 'email' | 'phone';
};

export const contactInfoNodes = (s: ModelSignals<ContactInfo>) => ({
  email: { value: s.email, component: Input, validators: contactInfoValidators.email() },
  phone: { value: s.phone, component: Input, validators: contactInfoValidators.phone() },
  preferredContact: {
    value: s.preferredContact,
    component: Select,
    componentProps: {
      options: [
        { value: 'email', label: 'Email' },
        { value: 'phone', label: 'Phone' },
      ],
    },
  },
});
```

```typescript title="modules/contact-info/validators.ts"
import { required, email, pattern } from '@reformer/core/validators';

export const contactInfoValidators = {
  email: () => [required(), email()],
  phone: () => [required(), pattern(/^\d{10}$/, { message: 'Must be 10 digits' })],
};
```

```typescript title="modules/contact-info/behaviors.ts"
import { transformValue } from '@reformer/core/behaviors';
import type { ModelSignals } from '@reformer/core';
import type { ContactInfo } from './schema';

export function contactInfoBehaviors(s: ModelSignals<ContactInfo>) {
  transformValue(s.phone, (value) => {
    const digits = (value ?? '').replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return value;
  });
}
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoNodes, type ContactInfo } from './schema';
export { contactInfoValidators } from './validators';
export { contactInfoBehaviors } from './behaviors';
```

**Usage:**

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';
import { required } from '@reformer/core/validators';
import { contactInfoNodes, contactInfoBehaviors, type ContactInfo } from './modules/contact-info';

type MyForm = {
  name: string;
  contactInfo: ContactInfo;
};

const model = createModel<MyForm>({
  name: '',
  contactInfo: { email: '', phone: '', preferredContact: 'email' },
});

const schema = {
  name: { value: model.$.name, component: Input, validators: [required()] },
  contactInfo: contactInfoNodes(model.$.contactInfo),
};

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  contactInfoBehaviors(model.$.contactInfo);
});

const form = createForm<MyForm>({ model, schema, behavior });
```

## Configurable Schemas

Create schema factories with options:

```typescript title="schemas/configurable-person.ts"
import type { ModelSignals } from '@reformer/core';
import { Input } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';

type Person = {
  firstName: string;
  lastName: string;
  email: string;
  middleName: string;
  phone: string;
};

type PersonSchemaOptions = {
  includeMiddleName?: boolean;
  includePhone?: boolean;
};

// The model materializes every field; the builder chooses which to expose
export function createPersonNodes(s: ModelSignals<Person>, options: PersonSchemaOptions = {}) {
  const nodes: Record<string, unknown> = {
    firstName: { value: s.firstName, component: Input, validators: [required()] },
    lastName: { value: s.lastName, component: Input, validators: [required()] },
    email: { value: s.email, component: Input, validators: [required(), email()] },
  };

  if (options.includeMiddleName) {
    nodes.middleName = { value: s.middleName, component: Input };
  }

  if (options.includePhone) {
    nodes.phone = { value: s.phone, component: Input };
  }

  return nodes;
}
```

**Usage:**

```typescript
// The model must materialize every field the builder can expose
const model = createModel<Person>({
  firstName: '',
  lastName: '',
  email: '',
  middleName: '',
  phone: '',
});

// Basic person — only the three required fields are exposed
const basicSchema = createPersonNodes(model.$);

// Person with all fields
const detailedSchema = createPersonNodes(model.$, {
  includeMiddleName: true,
  includePhone: true,
});
```

## Recommended Folder Structure

:::note App-level reuse, not per-form layout
This layout is about **schemas reused across many forms** — the app-level `schemas/` /
`validators/` / `behaviors/` directories below are shared building blocks, not the files that
make up a single form module. For how one form's own files are organized (flat per-concern
files by default, with a `form.` / `renderer.` dot-prefix on the schema and behavior files),
see [Project Structure](/docs/patterns/project-structure).
:::

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

| Practice                  | Why                              |
| ------------------------- | -------------------------------- |
| Use factory functions     | Avoid shared references          |
| Export types with schemas | Better type inference            |
| Bundle related schemas    | Single import for module         |
| Use descriptive names     | `validatePerson` not `validate1` |
| Test schemas separately   | Easier debugging                 |

## Next Steps

- [Project Structure](/docs/patterns/project-structure) — Organization tips
