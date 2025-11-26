---
sidebar_position: 3
---

# Conditional Access

Enabling and disabling fields with `enableWhen` and `disableWhen`.

## Overview

Conditional access controls whether form fields are enabled or disabled based on the values of other fields. Common use cases:

- Disable city field until country is selected
- Enable submit button only when terms are accepted
- Disable mortgage fields when loan type is not mortgage
- Disable residence address when "same as registration" is checked

## enableWhen

The `enableWhen` behavior enables a field when a condition is true, and disables it otherwise.

```typescript
import { enableWhen } from 'reformer/behaviors';

enableWhen(
  field,      // Field path to control
  condition,  // Function that returns true to enable, false to disable
  options     // Optional: { resetOnDisable: boolean }
);
```

### Basic Example: Enable City When Country Selected

```typescript title="src/behaviors/address-behavior.ts"
import { enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface AddressForm {
  country: string;
  city: string;
}

export const addressBehavior: BehaviorSchemaFn<AddressForm> = (path: FieldPath<AddressForm>) => {
  // City is enabled only when country is selected
  enableWhen(path.city, (form) => Boolean(form.country), {
    resetOnDisable: true,
  });
};
```

### Multiple Conditions

```typescript title="src/behaviors/loan-behavior.ts"
interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed';
  // Mortgage fields
  propertyValue: number;
  initialPayment: number;
  // Employment fields
  companyName: string;
  position: string;
  // Self-employment fields
  businessType: string;
  businessInn: string;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Mortgage fields - enabled only for mortgage
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Employment fields - enabled only when employed
  enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });
  enableWhen(path.position, (form) => form.employmentStatus === 'employed', {
    resetOnDisable: true,
  });

  // Self-employment fields - enabled only when self-employed
  enableWhen(path.businessType, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
  enableWhen(path.businessInn, (form) => form.employmentStatus === 'selfEmployed', {
    resetOnDisable: true,
  });
};
```

### Enable Groups

You can enable/disable entire groups:

```typescript title="src/behaviors/contact-behavior.ts"
interface ContactForm {
  sameAsRegistration: boolean;
  residenceAddress: {
    city: string;
    street: string;
    house: string;
  };
}

export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path) => {
  // Disable entire residence address group when same as registration
  enableWhen(path.residenceAddress, (form) => form.sameAsRegistration === false, {
    resetOnDisable: true,
  });
};
```

## disableWhen

The `disableWhen` behavior is the inverse of `enableWhen` - it disables a field when the condition is true.

```typescript
import { disableWhen } from 'reformer/behaviors';

disableWhen(
  field,      // Field path to control
  condition,  // Function that returns true to disable, false to enable
  options     // Optional: { resetOnDisable: boolean }
);
```

### Example: Disable When Confirmed

```typescript title="src/behaviors/form-behavior.ts"
import { disableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface OrderForm {
  isConfirmed: boolean;
  productName: string;
  quantity: number;
  price: number;
}

export const orderBehavior: BehaviorSchemaFn<OrderForm> = (path: FieldPath<OrderForm>) => {
  // Disable all fields when order is confirmed
  disableWhen(path.productName, (form) => form.isConfirmed === true);
  disableWhen(path.quantity, (form) => form.isConfirmed === true);
  disableWhen(path.price, (form) => form.isConfirmed === true);
};
```

### Read-Only Mode

```typescript title="src/behaviors/profile-behavior.ts"
interface ProfileForm {
  isEditing: boolean;
  firstName: string;
  lastName: string;
  email: string;
}

export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
  // Disable fields when not in editing mode
  disableWhen(path.firstName, (form) => !form.isEditing);
  disableWhen(path.lastName, (form) => !form.isEditing);
  disableWhen(path.email, (form) => !form.isEditing);
};
```

## resetOnDisable Option

The `resetOnDisable` option resets the field value to its initial value when the field becomes disabled:

```typescript
enableWhen(path.city, (form) => Boolean(form.country), {
  resetOnDisable: true,  // Reset city when country is cleared
});
```

This is important for:
- Preventing stale data from being submitted
- Ensuring form state is consistent
- Avoiding validation errors on hidden/disabled fields

### When to Use resetOnDisable

```typescript
// ✅ Use resetOnDisable when field depends on parent field
enableWhen(path.carModel, (form) => Boolean(form.carBrand), {
  resetOnDisable: true,  // Clear model when brand changes
});

// ✅ Use resetOnDisable for conditional sections
enableWhen(path.businessInfo, (form) => form.employmentStatus === 'selfEmployed', {
  resetOnDisable: true,  // Clear business info when not self-employed
});

// ❌ Don't use resetOnDisable for simple toggle without data dependency
disableWhen(path.notes, (form) => form.isConfirmed);
// Notes should be preserved when toggling confirmation
```

## Combining with Conditional Rendering

For the best user experience, combine `enableWhen` with conditional rendering:

```tsx title="src/components/LoanForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';

function LoanForm({ control }: LoanFormProps) {
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-4">
      <FormField control={control.loanType} />

      {/* Fields are hidden AND disabled via enableWhen */}
      {loanType === 'mortgage' && (
        <div className="space-y-4">
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </div>
      )}
    </div>
  );
}
```

With the behavior:

```typescript title="src/behaviors/loan-behavior.ts"
export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path) => {
  // Even though fields are conditionally rendered,
  // enableWhen ensures they're disabled and reset when not applicable
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
};
```

## Disabled State in Components

The `disabled` state is automatically available via `useFormControl`:

```tsx title="src/components/ui/input.tsx"
import { useFormControl, type FieldNode } from 'reformer';

interface InputProps {
  control: FieldNode<string>;
  label: string;
}

export function Input({ control, label }: InputProps) {
  const { value, disabled, errors } = useFormControl(control);

  return (
    <div>
      <label>{label}</label>
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
        className={disabled ? 'bg-gray-100 cursor-not-allowed' : ''}
      />
      {errors.length > 0 && <span className="text-red-500">{errors[0].message}</span>}
    </div>
  );
}
```

## Complex Conditions

### Multiple Dependencies

```typescript
enableWhen(
  path.deliveryDate,
  (form) => form.hasDelivery && form.deliveryType === 'scheduled',
  { resetOnDisable: true }
);
```

### Numeric Conditions

```typescript
enableWhen(
  path.discountCode,
  (form) => form.orderTotal >= 100,
  { resetOnDisable: true }
);
```

### Array Length Conditions

```typescript
enableWhen(
  path.bulkDiscount,
  (form) => form.items.length >= 5,
  { resetOnDisable: true }
);
```

## Best Practices

### 1. Always Consider resetOnDisable

Decide whether to reset values when disabling:

```typescript
// Data depends on parent - use resetOnDisable
enableWhen(path.city, (form) => Boolean(form.region), {
  resetOnDisable: true,
});

// Just a toggle - don't reset
disableWhen(path.comments, (form) => form.isSubmitted);
```

### 2. Combine with Conditional Rendering

For hidden fields, use both approaches:

```typescript
// Behavior handles state
enableWhen(path.optionalField, (form) => form.showOptional, {
  resetOnDisable: true,
});
```

```tsx
// Component handles visibility
{showOptional && <FormField control={control.optionalField} />}
```

### 3. Group Related Fields

Apply the same condition to related fields:

```typescript
const isMortgage = (form: LoanForm) => form.loanType === 'mortgage';

enableWhen(path.propertyValue, isMortgage, { resetOnDisable: true });
enableWhen(path.initialPayment, isMortgage, { resetOnDisable: true });
enableWhen(path.propertyType, isMortgage, { resetOnDisable: true });
```

### 4. Consider Validation

Disabled fields typically skip validation. Make sure your validation logic handles this:

```typescript
// Validation only runs when field is enabled
required(path.companyName, {
  message: 'Company name is required for employed applicants'
});

// Combined with enableWhen
enableWhen(path.companyName, (form) => form.employmentStatus === 'employed', {
  resetOnDisable: true,
});
```

## Next Step

Now that you understand enabling and disabling fields, let's learn about copying and synchronizing values between fields with `copyFrom` and `syncFields`.
