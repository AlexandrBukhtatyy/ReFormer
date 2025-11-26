---
sidebar_position: 4
---

# Copy and Sync

Copying and synchronizing field values with `copyFrom` and `syncFields`.

## Overview

Copy and sync behaviors automate data transfer between form fields:

- **copyFrom** - One-way copy from source to target based on a condition
- **syncFields** - Two-way synchronization between fields

Common use cases:
- Copy registration address to residence address
- Sync billing and shipping addresses
- Copy email to additional email field

## copyFrom

The `copyFrom` behavior copies values from a source field to a target field when a condition is met.

```typescript
import { copyFrom } from 'reformer/behaviors';

copyFrom(
  targetField,  // Field to copy TO
  sourceField,  // Field to copy FROM
  options       // { when: condition, fields?: 'all' | string[] }
);
```

### Basic Example: Copy Address

```typescript title="src/behaviors/address-behavior.ts"
import { copyFrom, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface ContactForm {
  sameAsRegistration: boolean;
  registrationAddress: {
    city: string;
    street: string;
    house: string;
    postalCode: string;
  };
  residenceAddress: {
    city: string;
    street: string;
    house: string;
    postalCode: string;
  };
}

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path: FieldPath<ContactForm>) => {
  // Copy registration address to residence when checkbox is checked
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });
};
```

### Copy Single Field

```typescript title="src/behaviors/email-behavior.ts"
interface EmailForm {
  sameEmail: boolean;
  email: string;
  emailAdditional: string;
}

export const emailBehavior: BehaviorSchemaFn<EmailForm> = (path) => {
  // Copy primary email to additional email
  copyFrom(path.emailAdditional, path.email, {
    when: (form) => form.sameEmail === true,
  });
};
```

### Copy Specific Fields

You can specify which fields to copy from a group:

```typescript title="src/behaviors/billing-behavior.ts"
interface OrderForm {
  useShippingAsBilling: boolean;
  shippingAddress: {
    name: string;
    street: string;
    city: string;
    postalCode: string;
    phone: string;
  };
  billingAddress: {
    name: string;
    street: string;
    city: string;
    postalCode: string;
    phone: string;
  };
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Copy only address fields, not phone
  copyFrom(path.billingAddress, path.shippingAddress, {
    when: (form) => form.useShippingAsBilling === true,
    fields: ['street', 'city', 'postalCode'], // Only these fields
  });
};
```

### Combining with enableWhen

For a complete "same as" pattern, combine `copyFrom` with `enableWhen`:

```typescript title="src/behaviors/full-address-behavior.ts"
import { copyFrom, enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';

interface AddressForm {
  sameAsRegistration: boolean;
  registrationAddress: Address;
  residenceAddress: Address;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  // Copy when checked
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  // Disable residence address when same as registration
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });
};
```

## syncFields

The `syncFields` behavior creates a two-way synchronization between two fields - when either changes, the other updates.

```typescript
import { syncFields } from 'reformer/behaviors';

syncFields(
  field1,  // First field
  field2   // Second field (synchronized with first)
);
```

### Basic Example: Sync Two Fields

```typescript title="src/behaviors/sync-behavior.ts"
import { syncFields, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface DemoForm {
  field1: string;
  field2: string;
}

export const demoBehavior: BehaviorSchemaFn<DemoForm> = (path: FieldPath<DemoForm>) => {
  // Changes to field1 update field2, and vice versa
  syncFields(path.field1, path.field2);
};
```

### Sync Username and Display Name

```typescript title="src/behaviors/user-behavior.ts"
interface UserForm {
  username: string;
  displayName: string;
  allowDifferentDisplayName: boolean;
}

export const userBehavior: BehaviorSchemaFn<UserForm> = (path) => {
  // Only sync when allowDifferentDisplayName is false
  // Note: for conditional sync, use watchField instead
};
```

## Practical Examples

### Complete "Same Address" Implementation

```tsx title="src/components/AddressSection.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '../nested-forms/AddressForm';

function AddressSection({ control }: AddressSectionProps) {
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  return (
    <div className="space-y-6">
      {/* Registration address */}
      <div className="space-y-4">
        <h3 className="font-semibold">Registration Address</h3>
        <AddressForm control={control.registrationAddress} />
      </div>

      {/* Same as registration checkbox */}
      <FormField control={control.sameAsRegistration} />

      {/* Residence address - hidden when same */}
      {!sameAsRegistration && (
        <div className="space-y-4">
          <h3 className="font-semibold">Residence Address</h3>
          <AddressForm control={control.residenceAddress} />
        </div>
      )}

      {/* Show copied info when same */}
      {sameAsRegistration && (
        <div className="p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">
            Residence address is the same as registration address
          </p>
        </div>
      )}
    </div>
  );
}
```

With behavior:

```typescript title="src/behaviors/address-behavior.ts"
export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path) => {
  copyFrom(path.residenceAddress, path.registrationAddress, {
    when: (form) => form.sameAsRegistration === true,
    fields: 'all',
  });

  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });
};
```

### Copy with Transformation

For copying with transformation, use `watchField` instead:

```typescript title="src/behaviors/transform-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';

interface FormWithTransform {
  sourceValue: string;
  uppercaseValue: string;
}

export const transformBehavior: BehaviorSchemaFn<FormWithTransform> = (path) => {
  // Copy with transformation
  watchField(path.sourceValue, (value, ctx) => {
    ctx.form.uppercaseValue.setValue(value?.toUpperCase() || '');
  });
};
```

### Conditional Copy Based on Value

```typescript title="src/behaviors/conditional-copy-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';

interface OrderForm {
  orderType: 'standard' | 'rush' | 'express';
  standardPrice: number;
  rushPrice: number;
  expressPrice: number;
  finalPrice: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Copy different price based on order type
  watchField(path.orderType, (orderType, ctx) => {
    switch (orderType) {
      case 'standard':
        ctx.form.finalPrice.setValue(ctx.form.standardPrice.getValue());
        break;
      case 'rush':
        ctx.form.finalPrice.setValue(ctx.form.rushPrice.getValue());
        break;
      case 'express':
        ctx.form.finalPrice.setValue(ctx.form.expressPrice.getValue());
        break;
    }
  });
};
```

## When to Use Each

| Behavior | Use When |
|----------|----------|
| `copyFrom` | One-way copy based on checkbox/condition |
| `syncFields` | Two-way sync always active |
| `watchField` | Copy with transformation or complex logic |
| `computeFrom` | Derived value from multiple sources |

## Best Practices

### 1. Combine with enableWhen for "Same As" Patterns

```typescript
// Copy when checked
copyFrom(path.target, path.source, {
  when: (form) => form.sameAsSource === true,
  fields: 'all',
});

// Disable target when copying
enableWhen(path.target, (form) => form.sameAsSource === false, {
  resetOnDisable: true,
});
```

### 2. Use Conditional Rendering

Hide the target field when copying to avoid confusion:

```tsx
{!sameAsSource && <FormField control={control.target} />}
```

### 3. Consider Field Types

When copying groups, ensure source and target have the same structure:

```typescript
// ✅ Same structure
copyFrom(path.billingAddress, path.shippingAddress, { ... });

// ❌ Different structures will cause issues
// copyFrom(path.simpleField, path.complexGroup, { ... });
```

### 4. Handle Arrays Carefully

Arrays need special handling - use `watchField` for more control:

```typescript
watchField(path.sourceArray, (sourceItems, ctx) => {
  // Clear and repopulate target array
  ctx.form.targetArray.clear();
  sourceItems.forEach(item => {
    ctx.form.targetArray.push();
    // Set values for each item
  });
}, { immediate: false });
```

## Next Step

Now that you understand copying and syncing fields, let's learn about watching field changes with `watchField`.
