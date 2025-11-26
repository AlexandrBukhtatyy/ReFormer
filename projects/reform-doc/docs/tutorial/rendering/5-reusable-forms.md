---
sidebar_position: 3
---

# Reusable Forms

Creating reusable nested form components and working with arrays.

## Overview

Reusable form components:
- Encapsulate a group of related fields
- Can be used multiple times in different contexts
- Accept a `control` prop typed to their specific structure
- Export both the schema and the component

This pattern is essential for:
- Reducing code duplication
- Ensuring consistent field layouts
- Managing arrays of complex objects

## Nested Form Components

### Creating a Reusable Address Form

Let's create an `AddressForm` component that can be reused for registration and residence addresses:

```tsx title="src/nested-forms/AddressForm.tsx"
import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { InputMask } from '@/components/ui/input-mask';

// 1. Define the type
export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
}

// 2. Define the reusable schema
export const addressFormSchema: FormSchema<Address> = {
  region: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Region',
      placeholder: 'Enter region',
    },
  },
  city: {
    value: '',
    component: Input,
    componentProps: {
      label: 'City',
      placeholder: 'Enter city',
    },
  },
  street: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Street',
      placeholder: 'Enter street',
    },
  },
  house: {
    value: '',
    component: Input,
    componentProps: {
      label: 'House',
      placeholder: '№',
    },
  },
  apartment: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Apartment',
      placeholder: '№',
    },
  },
  postalCode: {
    value: '',
    component: InputMask,
    componentProps: {
      label: 'Postal code',
      placeholder: '000000',
      mask: '999999',
    },
  },
};

// 3. Define props interface
interface AddressFormProps {
  control: GroupNodeWithControls<Address>;
  testIdPrefix?: string;
}

// 4. Create the component
const AddressFormComponent = ({ control, testIdPrefix = 'address' }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} testId={`${testIdPrefix}-region`} />
        <FormField control={control.city} testId={`${testIdPrefix}-city`} />
      </div>

      <FormField control={control.street} testId={`${testIdPrefix}-street`} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} testId={`${testIdPrefix}-house`} />
        <FormField control={control.apartment} testId={`${testIdPrefix}-apartment`} />
        <FormField control={control.postalCode} testId={`${testIdPrefix}-postalCode`} />
      </div>
    </div>
  );
};

// 5. Memoize to prevent unnecessary re-renders
export const AddressForm = memo(AddressFormComponent);
```

### Using Nested Forms in Parent Schema

Import and spread the nested schema in your parent form:

```tsx title="src/schemas/create-credit-application-form.ts"
import { addressFormSchema, type Address } from '../nested-forms/AddressForm';

interface CreditApplicationForm {
  // ... other fields
  registrationAddress: Address;
  residenceAddress: Address;
}

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ... other fields

  // Spread the reusable schema
  registrationAddress: addressFormSchema,
  residenceAddress: addressFormSchema,
};
```

### Using in Step Components

```tsx title="src/steps/ContactInfoForm.tsx"
import { AddressForm } from '../nested-forms/AddressForm';

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  return (
    <div className="space-y-6">
      {/* Registration address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Registration Address</h3>
        <AddressForm
          control={control.registrationAddress}
          testIdPrefix="registrationAddress"
        />
      </div>

      {/* Residence address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Residence Address</h3>
        <AddressForm
          control={control.residenceAddress}
          testIdPrefix="residenceAddress"
        />
      </div>
    </div>
  );
}
```

## Nested Structures with Groups

For complex nested structures, you can nest groups inside your form:

```tsx title="src/nested-forms/CoBorrowerForm.tsx"
import { memo } from 'react';
import type { FormSchema, GroupNodeWithControls } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

// Nested structure with groups
export interface CoBorrower {
  personalData: {
    lastName: string;
    firstName: string;
    middleName: string;
    birthDate: string;
  };
  phone: string;
  email: string;
  relationship: string;
  monthlyIncome: number;
}

export const coBorrowerFormSchema: FormSchema<CoBorrower> = {
  // Nested group
  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Last name', placeholder: 'Enter last name' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'First name', placeholder: 'Enter first name' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Middle name', placeholder: 'Enter middle name' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Birth date', type: 'date' },
    },
  },
  phone: {
    value: '',
    component: Input,
    componentProps: { label: 'Phone', placeholder: '+1 (___) ___-____' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', placeholder: 'example@mail.com', type: 'email' },
  },
  relationship: {
    value: 'spouse',
    component: Select,
    componentProps: {
      label: 'Relationship',
      options: [
        { value: 'spouse', label: 'Spouse' },
        { value: 'parent', label: 'Parent' },
        { value: 'sibling', label: 'Sibling' },
        { value: 'other', label: 'Other' },
      ],
    },
  },
  monthlyIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Monthly income', type: 'number', min: 0 },
  },
};

interface CoBorrowerFormProps {
  control: GroupNodeWithControls<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {
  return (
    <div className="space-y-3">
      {/* Access nested group fields */}
      <div className="grid grid-cols-3 gap-3">
        <FormField control={control.personalData.lastName} />
        <FormField control={control.personalData.firstName} />
        <FormField control={control.personalData.middleName} />
      </div>

      <FormField control={control.personalData.birthDate} />

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.phone} />
        <FormField control={control.email} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.relationship} />
        <FormField control={control.monthlyIncome} />
      </div>
    </div>
  );
};

export const CoBorrowerForm = memo(CoBorrowerFormComponent);
```

## Working with Arrays

### Array Schema Definition

Define arrays in your schema using the `array` wrapper:

```tsx title="src/schemas/create-credit-application-form.ts"
import { array } from 'reformer';
import { propertyFormSchema, type Property } from '../nested-forms/PropertyForm';
import { coBorrowerFormSchema, type CoBorrower } from '../nested-forms/CoBorrowerForm';

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
}

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I have property to declare' },
  },

  // Array of properties
  properties: array(propertyFormSchema),

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I have a co-borrower' },
  },

  // Array of co-borrowers
  coBorrowers: array(coBorrowerFormSchema),
};
```

### Array Operations

The `ArrayNodeWithControls` provides these operations:

| Method | Description |
|--------|-------------|
| `push()` | Add new item with default values from schema |
| `removeAt(index)` | Remove item at specific index |
| `map(callback)` | Iterate over array items |
| `length` | Get current array length |

### FormArrayManager Component

Create a reusable component to render array items:

```tsx title="src/components/FormArrayManager.tsx"
import type { ComponentType } from 'react';
import { useFormControl, type ArrayNode, type FormFields, type GroupNodeWithControls } from 'reformer';
import { Button } from '@/components/ui/button';

interface FormArrayManagerProps {
  control: ArrayNode<FormFields>;
  component: ComponentType<{ control: unknown }>;
  itemLabel?: string;
  renderTitle?: (index: number) => string;
}

export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Item',
  renderTitle,
}: FormArrayManagerProps) {
  // Subscribe to array length changes
  const { length } = useFormControl(control);

  return (
    <>
      {control.map((itemControl: GroupNodeWithControls<FormFields>, index: number) => {
        const title = renderTitle ? renderTitle(index) : `${itemLabel} #${index + 1}`;
        const key = itemControl.id || index;

        return (
          <div key={key} className="mb-4 p-4 bg-white rounded border">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">{title}</h4>
              <Button onClick={() => control.removeAt(index)}>Remove</Button>
            </div>

            <ItemComponent control={itemControl} />
          </div>
        );
      })}
    </>
  );
}
```

### FormArraySection Component

A higher-level component that combines array management with section UI:

```tsx title="src/components/FormArraySection.tsx"
import {
  useFormControl,
  type ArrayNodeWithControls,
  type FormFields,
  type GroupNodeWithControls,
} from 'reformer';
import type { ComponentType } from 'react';
import { FormArrayManager } from './FormArrayManager';
import { Button } from '@/components/ui/button';

interface FormArraySectionProps<T extends object> {
  title: string;
  control: ArrayNodeWithControls<FormFields> | undefined;
  itemComponent: ComponentType<{ control: GroupNodeWithControls<T> }>;
  itemLabel: string;
  addButtonLabel: string;
  emptyMessage: string;
  hasItems: boolean;
}

export function FormArraySection<T extends object>({
  title,
  control,
  itemComponent,
  itemLabel,
  addButtonLabel,
  emptyMessage,
  hasItems,
}: FormArraySectionProps<T>) {
  const { length } = useFormControl(control);

  if (!hasItems || !control) {
    return null;
  }

  const isEmpty = length === 0;

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <Button onClick={() => control.push()}>{addButtonLabel}</Button>
      </div>

      <FormArrayManager
        control={control}
        component={itemComponent}
        itemLabel={itemLabel}
      />

      {isEmpty && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded text-center text-gray-600">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
```

### Using Arrays in Step Components

```tsx title="src/steps/AdditionalInfoForm.tsx"
import { useFormControl } from 'reformer';
import { FormField } from '@/components/ui/form-field';
import { FormArraySection } from '../components/FormArraySection';
import { PropertyForm } from '../nested-forms/PropertyForm';
import { CoBorrowerForm } from '../nested-forms/CoBorrowerForm';

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      {/* Property array */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />
        {hasProperty && (
          <FormArraySection
            title="Property"
            control={control.properties}
            itemComponent={PropertyForm}
            itemLabel="Property"
            addButtonLabel="+ Add property"
            emptyMessage="Click to add property information"
            hasItems={hasProperty}
          />
        )}
      </div>

      {/* Co-borrowers array */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />
        {hasCoBorrower && (
          <FormArraySection
            title="Co-borrowers"
            control={control.coBorrowers}
            itemComponent={CoBorrowerForm}
            itemLabel="Co-borrower"
            addButtonLabel="+ Add co-borrower"
            emptyMessage="Click to add co-borrower information"
            hasItems={hasCoBorrower}
          />
        )}
      </div>
    </div>
  );
}
```

## Best Practices

### 1. Always Export Schema and Type

Export both the schema and TypeScript interface so they can be reused:

```tsx
// Export type for typing
export interface Address { ... }

// Export schema for form composition
export const addressFormSchema: FormSchema<Address> = { ... }

// Export component for rendering
export const AddressForm = memo(AddressFormComponent);
```

### 2. Use Memoization

Wrap nested form components with `memo` to prevent unnecessary re-renders:

```tsx
const AddressFormComponent = ({ control }: AddressFormProps) => { ... };

export const AddressForm = memo(AddressFormComponent);
```

### 3. Use Unique Keys for Array Items

Use the `id` property from controls as keys instead of array index:

```tsx
{control.map((itemControl, index) => (
  <div key={itemControl.id || index}>
    ...
  </div>
))}
```

### 4. Subscribe to Array Length

When rendering arrays, subscribe to the `length` property to trigger re-renders when items are added or removed:

```tsx
const { length } = useFormControl(control);
```

### 5. Keep Components Focused

Each nested form component should handle only its own fields. Don't pass the entire form to nested components.

## Next Step

Now that you understand how to create reusable forms and work with arrays, let's move on to adding behaviors to your form fields.
