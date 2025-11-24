---
sidebar_position: 2
---

# Reusable Schemas

Create reusable form schemas, validators, and behaviors to share across your application.

## Why Reuse Schemas?

Reusable schemas help you:
- Avoid code duplication
- Maintain consistency across forms
- Centralize validation logic
- Speed up development
- Make testing easier

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

export const numberField = (defaultValue = 0): FieldConfig<number> => ({
  value: defaultValue,
});
```

### Usage

```typescript
import { GroupNode } from 'reformer';
import { emailField, phoneField } from './schemas/common-fields';

const form = new GroupNode({
  form: {
    email: emailField(),
    phone: phoneField(),
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
  country: string;
}

export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
  state: { value: '' },
  zipCode: { value: '' },
  country: { value: 'US' },
});
```

```typescript title="schemas/phone-schema.ts"
import { FormSchema } from 'reformer';

export interface Phone {
  type: 'mobile' | 'home' | 'work';
  number: string;
  extension?: string;
}

export const phoneSchema = (): FormSchema<Phone> => ({
  type: { value: 'mobile' },
  number: { value: '' },
  extension: { value: '' },
});
```

```typescript title="schemas/person-schema.ts"
import { FormSchema } from 'reformer';

export interface Person {
  firstName: string;
  lastName: string;
  email: string;
  birthDate: Date | null;
}

export const personSchema = (): FormSchema<Person> => ({
  firstName: { value: '' },
  lastName: { value: '' },
  email: { value: '' },
  birthDate: { value: null },
});
```

### Composing Schemas

Combine schemas to create complex forms:

```typescript title="forms/user-form.ts"
import { GroupNode } from 'reformer';
import { personSchema, Person } from '../schemas/person-schema';
import { addressSchema, Address } from '../schemas/address-schema';
import { phoneSchema, Phone } from '../schemas/phone-schema';

interface UserForm {
  person: Person;
  address: Address;
  phones: Phone[];
}

export const createUserForm = () =>
  new GroupNode<UserForm>({
    form: {
      person: personSchema(),
      address: addressSchema(),
      phones: [phoneSchema()],
    },
  });
```

## Reusable Validation Sets

Create validation sets for common patterns:

```typescript title="validators/address-validators.ts"
import { required, pattern } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { Address } from '../schemas/address-schema';

export function validateAddress(path: FieldPath<Address>) {
  required(path.street);
  required(path.city);
  required(path.state);
  required(path.zipCode);
  pattern(path.zipCode, /^\d{5}(-\d{4})?$/, 'Invalid ZIP code');
  required(path.country);
}
```

```typescript title="validators/person-validators.ts"
import { required, email, minLength } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { Person } from '../schemas/person-schema';

export function validatePerson(path: FieldPath<Person>) {
  required(path.firstName);
  minLength(path.firstName, 2);
  required(path.lastName);
  minLength(path.lastName, 2);
  required(path.email);
  email(path.email);
}
```

```typescript title="validators/phone-validators.ts"
import { required, pattern } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { Phone } from '../schemas/phone-schema';

export function validatePhone(path: FieldPath<Phone>) {
  required(path.type);
  required(path.number);
  pattern(path.number, /^\d{10}$/, 'Must be 10 digits');
}
```

### Using Validation Sets

```typescript
import { GroupNode } from 'reformer';
import { personSchema } from './schemas/person-schema';
import { addressSchema } from './schemas/address-schema';
import { validatePerson } from './validators/person-validators';
import { validateAddress } from './validators/address-validators';

const form = new GroupNode({
  form: {
    person: personSchema(),
    address: addressSchema(),
  },
  validation: (path) => {
    validatePerson(path.person);
    validateAddress(path.address);
  },
});
```

## Reusable Behaviors

Create behavior sets for common patterns:

```typescript title="behaviors/address-behaviors.ts"
import { FieldPath, Behavior } from 'reformer';
import { Address } from '../schemas/address-schema';

/**
 * Auto-format ZIP code on input
 */
export function addressBehaviors<T extends { address: Address }>(
  path: FieldPath<T>
): Behavior<T>[] {
  return [
    {
      key: 'formatZipCode',
      paths: [path.address.zipCode],
      run: (values, ctx) => {
        const zipCode = values[path.address.zipCode.__key];
        if (zipCode && /^\d{5}\d{4}$/.test(zipCode)) {
          // Format 123456789 -> 12345-6789
          const formatted = `${zipCode.slice(0, 5)}-${zipCode.slice(5)}`;
          ctx.form.address.zipCode.setValue(formatted);
        }
      },
    },
  ];
}
```

```typescript title="behaviors/phone-behaviors.ts"
import { FieldPath, Behavior } from 'reformer';
import { Phone } from '../schemas/phone-schema';

/**
 * Auto-format phone number
 */
export function phoneBehaviors<T extends { phone: Phone }>(
  path: FieldPath<T>
): Behavior<T>[] {
  return [
    {
      key: 'formatPhone',
      paths: [path.phone.number],
      run: (values, ctx) => {
        const phone = values[path.phone.number.__key];
        if (phone) {
          // Remove non-digits
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 10) {
            // Format as (555) 123-4567
            const formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            ctx.form.phone.number.setValue(formatted);
          }
        }
      },
    },
  ];
}
```

### Using Behavior Sets

```typescript
import { GroupNode } from 'reformer';
import { addressSchema } from './schemas/address-schema';
import { phoneSchema } from './schemas/phone-schema';
import { addressBehaviors } from './behaviors/address-behaviors';
import { phoneBehaviors } from './behaviors/phone-behaviors';

const form = new GroupNode({
  form: {
    address: addressSchema(),
    phone: phoneSchema(),
  },
  behaviors: (path, { use }) => [
    ...addressBehaviors(path).map(use),
    ...phoneBehaviors(path).map(use),
  ],
});
```

## Complete Reusable Form Module

Combine schema, validation, and behaviors into a complete module:

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
import { required, email, pattern } from 'reformer/validators';
import { FieldPath } from 'reformer';
import { ContactInfo } from './schema';

export function validateContactInfo(path: FieldPath<ContactInfo>) {
  required(path.email);
  email(path.email);
  required(path.phone);
  pattern(path.phone, /^\d{10}$/, 'Must be 10 digits');
  required(path.preferredContact);
}
```

```typescript title="modules/contact-info/behaviors.ts"
import { FieldPath, Behavior } from 'reformer';
import { ContactInfo } from './schema';

export function contactInfoBehaviors<T extends { contactInfo: ContactInfo }>(
  path: FieldPath<T>
): Behavior<T>[] {
  return [
    {
      key: 'formatPhone',
      paths: [path.contactInfo.phone],
      run: (values, ctx) => {
        const phone = values[path.contactInfo.phone.__key];
        if (phone) {
          const digits = phone.replace(/\D/g, '');
          if (digits.length === 10) {
            ctx.form.contactInfo.phone.setValue(
              `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
            );
          }
        }
      },
    },
  ];
}
```

```typescript title="modules/contact-info/index.ts"
export { contactInfoSchema, type ContactInfo } from './schema';
export { validateContactInfo } from './validators';
export { contactInfoBehaviors } from './behaviors';
```

### Using Complete Module

```typescript
import { GroupNode } from 'reformer';
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
  behaviors: (path, { use }) => [
    ...contactInfoBehaviors(path).map(use),
  ],
});
```

## Schema Factory Pattern

Create schema factories for configurable reuse:

```typescript title="schemas/configurable-person-schema.ts"
import { FormSchema } from 'reformer';

export interface Person {
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface PersonSchemaOptions {
  includeMiddleName?: boolean;
  includePhone?: boolean;
  defaultCountryCode?: string;
}

export function createPersonSchema(
  options: PersonSchemaOptions = {}
): FormSchema<Person> {
  const {
    includeMiddleName = false,
    includePhone = false,
  } = options;

  const schema: FormSchema<Person> = {
    firstName: { value: '' },
    lastName: { value: '' },
    email: { value: '' },
  };

  if (includeMiddleName) {
    schema.middleName = { value: '' };
  }

  if (includePhone) {
    schema.phone = { value: '' };
  }

  return schema;
}
```

### Using Schema Factory

```typescript
// Simple person form
const simplePerson = createPersonSchema();

// Person with middle name and phone
const detailedPerson = createPersonSchema({
  includeMiddleName: true,
  includePhone: true,
});
```

## Project Organization

Recommended structure for reusable schemas:

```
src/
├── forms/                    # Form definitions
│   ├── user-form.ts
│   ├── order-form.ts
│   └── settings-form.ts
│
├── schemas/                  # Reusable schemas
│   ├── common-fields.ts      # Basic field configs
│   ├── address-schema.ts
│   ├── person-schema.ts
│   └── phone-schema.ts
│
├── validators/               # Reusable validators
│   ├── address-validators.ts
│   ├── person-validators.ts
│   ├── phone-validators.ts
│   └── custom/               # Custom validators
│       ├── credit-card.ts
│       └── username.ts
│
├── behaviors/                # Reusable behaviors
│   ├── address-behaviors.ts
│   ├── phone-behaviors.ts
│   └── common/               # Common behaviors
│       ├── auto-save.ts
│       ├── analytics.ts
│       └── keyboard-shortcuts.ts
│
└── modules/                  # Complete form modules
    ├── contact-info/
    │   ├── schema.ts
    │   ├── validators.ts
    │   ├── behaviors.ts
    │   └── index.ts
    └── payment-info/
        ├── schema.ts
        ├── validators.ts
        ├── behaviors.ts
        └── index.ts
```

## Best Practices

### 1. Use Factory Functions

```typescript
// ✅ Good - factory function
export const personSchema = (): FormSchema<Person> => ({
  firstName: { value: '' },
  lastName: { value: '' },
});

// ❌ Bad - direct object (shares reference)
export const personSchema = {
  firstName: { value: '' },
  lastName: { value: '' },
};
```

### 2. Export Types with Schemas

```typescript
// ✅ Good - export both schema and type
export interface Address {
  street: string;
  city: string;
}

export const addressSchema = (): FormSchema<Address> => ({
  street: { value: '' },
  city: { value: '' },
});

// ❌ Bad - only schema, no type
export const addressSchema = () => ({
  street: { value: '' },
  city: { value: '' },
});
```

### 3. Create Validation Sets

```typescript
// ✅ Good - validation function
export function validateAddress(path: FieldPath<Address>) {
  required(path.street);
  required(path.city);
}

// Usage
validation: (path) => {
  validateAddress(path.address);
}

// ❌ Bad - repeat validation logic everywhere
validation: (path) => {
  required(path.address.street);
  required(path.address.city);
}
```

### 4. Bundle Related Schemas

```typescript
// ✅ Good - complete module
export { contactInfoSchema, type ContactInfo } from './schema';
export { validateContactInfo } from './validators';
export { contactInfoBehaviors } from './behaviors';

// Single import
import { contactInfoSchema, validateContactInfo } from './modules/contact-info';
```

### 5. Make Schemas Configurable

```typescript
// ✅ Good - configurable schema
export function createAddressSchema(options: {
  includeApartment?: boolean;
  requireState?: boolean;
}) {
  const schema: FormSchema<Address> = {
    street: { value: '' },
    city: { value: '' },
  };

  if (options.includeApartment) {
    schema.apartment = { value: '' };
  }

  return schema;
}

// ❌ Bad - rigid schema
export const addressSchema = {
  street: { value: '' },
  city: { value: '' },
  // Can't customize
};
```

## Testing Reusable Schemas

```typescript title="schemas/__tests__/person-schema.test.ts"
import { GroupNode } from 'reformer';
import { personSchema } from '../person-schema';
import { validatePerson } from '../../validators/person-validators';

describe('personSchema', () => {
  it('creates valid schema', () => {
    const form = new GroupNode({
      form: personSchema(),
    });

    expect(form.controls.firstName.value.value).toBe('');
    expect(form.controls.lastName.value.value).toBe('');
  });

  it('validates correctly', () => {
    const form = new GroupNode({
      form: personSchema(),
      validation: (path) => validatePerson(path),
    });

    expect(form.valid.value).toBe(false);

    form.controls.firstName.setValue('John');
    form.controls.lastName.setValue('Doe');
    form.controls.email.setValue('john@example.com');

    expect(form.valid.value).toBe(true);
  });
});
```

## Next Steps

- [Form Composition](/docs/patterns/form-composition) — Compose complex forms from simple parts
- [Validation Strategies](/docs/patterns/validation-strategies) — Advanced validation patterns
- [Custom Validators](/docs/validation/custom) — Create custom validators
- [Custom Behaviors](/docs/behaviors/custom) — Create custom behaviors
