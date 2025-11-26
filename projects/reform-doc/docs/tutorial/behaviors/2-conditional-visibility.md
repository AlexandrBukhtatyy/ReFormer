---
sidebar_position: 2
---

# Conditional Visibility

Showing and hiding form fields based on conditions.

## Overview

Conditional visibility allows you to dynamically show or hide form fields based on the values of other fields. Common use cases:

- Show "Other" field when "Other" option is selected
- Display mortgage-specific fields only when loan type is "mortgage"
- Show co-borrower section when user indicates they have a co-borrower
- Hide optional fields until they're needed

## Approaches to Conditional Visibility

ReFormer provides two main approaches for conditional visibility:

1. **React Conditional Rendering** (Recommended) - Use `useFormControl` to subscribe to field values and conditionally render components
2. **enableWhen with resetOnDisable** - Disable fields when they shouldn't be accessible, optionally resetting their values

### React Conditional Rendering

The most common and flexible approach is to use React's conditional rendering:

```tsx title="src/components/LoanForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';

function LoanForm({ control }: LoanFormProps) {
  // Subscribe to loanType changes
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-4">
      <FormField control={control.loanType} />

      {/* Show mortgage fields only when mortgage is selected */}
      {loanType === 'mortgage' && (
        <div className="space-y-4">
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </div>
      )}

      {/* Show car fields only when car loan is selected */}
      {loanType === 'car' && (
        <div className="space-y-4">
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <FormField control={control.carYear} />
        </div>
      )}
    </div>
  );
}
```

### Checkbox-Controlled Sections

A common pattern is toggling sections with a checkbox:

```tsx title="src/components/AdditionalInfoForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { FormArraySection } from '@/components/FormArraySection';
import { PropertyForm } from '../nested-forms/PropertyForm';

function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      {/* Property section */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />

        {hasProperty && (
          <FormArraySection
            title="Property"
            control={control.properties}
            itemComponent={PropertyForm}
            itemLabel="Property"
            addButtonLabel="+ Add property"
            emptyMessage="Click to add property"
            hasItems={hasProperty}
          />
        )}
      </div>

      {/* Co-borrower section */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />

        {hasCoBorrower && (
          <div className="p-4 border rounded">
            <h3 className="font-semibold mb-4">Co-borrower Information</h3>
            <FormField control={control.coBorrowerName} />
            <FormField control={control.coBorrowerIncome} />
          </div>
        )}
      </div>
    </div>
  );
}
```

### Select-Driven Visibility

Show different fields based on select value:

```tsx title="src/components/EmploymentForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';

type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired';

function EmploymentForm({ control }: EmploymentFormProps) {
  const { value: status } = useFormControl(control.employmentStatus);

  return (
    <div className="space-y-4">
      <FormField control={control.employmentStatus} />

      {/* Employed - show company info */}
      {status === 'employed' && (
        <div className="space-y-4 p-4 bg-blue-50 rounded">
          <h3 className="font-medium">Company Information</h3>
          <FormField control={control.companyName} />
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
          <FormField control={control.employmentDate} />
        </div>
      )}

      {/* Self-employed - show business info */}
      {status === 'selfEmployed' && (
        <div className="space-y-4 p-4 bg-green-50 rounded">
          <h3 className="font-medium">Business Information</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </div>
      )}

      {/* Retired - show pension info */}
      {status === 'retired' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <h3 className="font-medium">Pension Information</h3>
          <FormField control={control.pensionType} />
          <FormField control={control.pensionAmount} />
        </div>
      )}

      {/* Unemployed - show additional income */}
      {status === 'unemployed' && (
        <div className="space-y-4 p-4 bg-yellow-50 rounded">
          <h3 className="font-medium">Additional Income Sources</h3>
          <FormField control={control.additionalIncomeSource} />
          <FormField control={control.additionalIncomeAmount} />
        </div>
      )}
    </div>
  );
}
```

## Combining Visibility with enableWhen

When fields are hidden, you often want to reset their values and disable validation. Use `enableWhen` with `resetOnDisable` option:

```typescript title="src/behaviors/loan-behavior.ts"
import { enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  // Mortgage fields
  propertyValue: number;
  initialPayment: number;
  // Car fields
  carBrand: string;
  carModel: string;
  carYear: number;
}

export const loanBehavior: BehaviorSchemaFn<LoanForm> = (path: FieldPath<LoanForm>) => {
  // Mortgage fields - enabled only for mortgage
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Car fields - enabled only for car loan
  enableWhen(path.carBrand, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carModel, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
  enableWhen(path.carYear, (form) => form.loanType === 'car', {
    resetOnDisable: true,
  });
};
```

Then in your component, combine both:

```tsx title="src/components/LoanForm.tsx"
function LoanForm({ control }: LoanFormProps) {
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-4">
      <FormField control={control.loanType} />

      {/* Conditional rendering + fields are disabled by enableWhen when hidden */}
      {loanType === 'mortgage' && (
        <div className="space-y-4">
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </div>
      )}

      {loanType === 'car' && (
        <div className="space-y-4">
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <FormField control={control.carYear} />
        </div>
      )}
    </div>
  );
}
```

## Clearing Arrays When Hidden

When hiding array sections, clear the array to avoid submitting stale data:

```typescript title="src/behaviors/application-behavior.ts"
import { watchField, type BehaviorSchemaFn } from 'reformer/behaviors';
import type { FieldPath } from 'reformer';

interface ApplicationForm {
  hasProperty: boolean;
  properties: Property[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

export const applicationBehavior: BehaviorSchemaFn<ApplicationForm> = (path) => {
  // Clear properties array when hasProperty becomes false
  watchField(
    path.hasProperty,
    (hasProperty, ctx) => {
      if (!hasProperty) {
        ctx.form.properties?.clear();
      }
    },
    { immediate: false }
  );

  // Clear co-borrowers array when hasCoBorrower becomes false
  watchField(
    path.hasCoBorrower,
    (hasCoBorrower, ctx) => {
      if (!hasCoBorrower) {
        ctx.form.coBorrowers?.clear();
      }
    },
    { immediate: false }
  );
};
```

## Nested Conditional Visibility

Handle multiple levels of conditional visibility:

```tsx title="src/components/AddressSection.tsx"
import { useFormControl } from 'reformer';
import { AddressForm } from '../nested-forms/AddressForm';

function AddressSection({ control }: AddressSectionProps) {
  const { value: hasResidenceAddress } = useFormControl(control.hasResidenceAddress);
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  return (
    <div className="space-y-6">
      {/* Registration address - always visible */}
      <div className="space-y-4">
        <h3 className="font-semibold">Registration Address</h3>
        <AddressForm control={control.registrationAddress} testIdPrefix="registration" />
      </div>

      {/* Option to add different residence address */}
      <FormField control={control.hasResidenceAddress} />

      {/* Residence address section - shown only if hasResidenceAddress */}
      {hasResidenceAddress && (
        <div className="space-y-4">
          <FormField control={control.sameAsRegistration} />

          {/* Show residence form only if NOT same as registration */}
          {!sameAsRegistration && (
            <div className="space-y-4">
              <h3 className="font-semibold">Residence Address</h3>
              <AddressForm control={control.residenceAddress} testIdPrefix="residence" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

## Best Practices

### 1. Always Use resetOnDisable for Hidden Fields

When a field is hidden, its value should typically be reset:

```typescript
enableWhen(path.optionalField, (form) => form.showOptional, {
  resetOnDisable: true,  // Reset value when hidden
});
```

### 2. Clear Arrays When Hiding Sections

```typescript
watchField(path.hasItems, (hasItems, ctx) => {
  if (!hasItems) {
    ctx.form.items?.clear();
  }
}, { immediate: false });
```

### 3. Combine Behaviors with Conditional Rendering

Use both approaches together for robust handling:

- **enableWhen** - Handles field state (disabled, reset values)
- **Conditional rendering** - Controls what's visible to the user

### 4. Subscribe Only to What You Need

Use targeted subscriptions to avoid unnecessary re-renders:

```tsx
// ✅ Good - subscribe only to needed field
const { value: loanType } = useFormControl(control.loanType);

// ❌ Avoid - subscribing to entire form when not needed
const formValues = useFormControl(control);
```

### 5. Use Consistent Patterns

Establish a consistent pattern in your project:

```tsx
// Pattern: checkbox + conditional section
<FormField control={control.hasFeature} />
{hasFeature && <FeatureSection control={control.feature} />}
```

## Next Step

Now that you understand conditional visibility, let's learn about enabling and disabling fields with `enableWhen` and `disableWhen`.
