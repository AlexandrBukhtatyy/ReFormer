---
sidebar_position: 5
---

# Reusable Forms

Creating reusable nested form components and working with arrays.

## Overview

Reusable form components:

- Encapsulate a group of related fields
- Can be used multiple times in different contexts
- Accept a `control` prop typed to their specific structure

This pattern is essential for:

- Reducing code duplication
- Ensuring consistent field layouts
- Managing arrays of complex objects

## How Nested Forms Work

The nested forms pattern consists of three parts:

1. **Props interface** — defines `control` type via `GroupNodeWithControls<T>`
2. **Component** — responsible only for field layout using `FormField`
3. **Memoization** — wrap in `memo()` to prevent unnecessary re-renders

```tsx
// 1. Props interface
interface MyFormProps {
  control: GroupNodeWithControls<MyType>;
}

// 2. Component
const MyFormComponent = ({ control }: MyFormProps) => {
  return (
    <div className="space-y-4">
      <FormField control={control.field1} />
      <FormField control={control.field2} />
    </div>
  );
};

// 3. Memoization
export const MyForm = memo(MyFormComponent);
```

### Using a Nested Form

A nested form is used in the parent component by passing `control`:

```tsx
import { MyForm } from './sub-forms/MyForm';

export function ParentForm({ control }: ParentFormProps) {
  return (
    <div className="space-y-6">
      <h3>Section 1</h3>
      <MyForm control={control.section1} />

      <h3>Section 2</h3>
      <MyForm control={control.section2} />
    </div>
  );
}
```

## Where to Use Nested Forms

- **Addresses** — registration, residence, delivery
- **Personal data** — for borrower, co-borrower, contact person
- **Documents** — passport, license, ID
- **Repeating blocks** — properties, loans, income sources

## Tutorial Form Implementations

All forms are located in `reformer-tutorial/src/forms/credit-application/sub-forms/`.

### AddressForm

Address form — region, city, street, house, apartment, postal code.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/AddressForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { Address } from '../types/credit-application.types';

interface AddressFormProps {
  control: GroupNodeWithControls<Address>;
}

const AddressFormComponent = ({ control }: AddressFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.region} />
        <FormField control={control.city} />
      </div>

      <FormField control={control.street} />

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.house} />
        <FormField control={control.apartment} />
        <FormField control={control.postalCode} />
      </div>
    </div>
  );
};

export const AddressForm = memo(AddressFormComponent);
```

### PersonalDataForm

Personal data — full name, birth date, birth place, gender.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/PersonalDataForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { PersonalData } from '../types/credit-application.types';

interface PersonalDataFormProps {
  control: GroupNodeWithControls<PersonalData>;
}

const PersonalDataFormComponent = ({ control }: PersonalDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.lastName} />
        <FormField control={control.firstName} />
        <FormField control={control.middleName} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.birthDate} />
        <FormField control={control.birthPlace} />
      </div>

      <FormField control={control.gender} />
    </div>
  );
};

export const PersonalDataForm = memo(PersonalDataFormComponent);
```

### PassportDataForm

Passport data — series, number, issue date, department code, issued by.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/PassportDataForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { PassportData } from '../types/credit-application.types';

interface PassportDataFormProps {
  control: GroupNodeWithControls<PassportData>;
}

const PassportDataFormComponent = ({ control }: PassportDataFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.series} />
        <FormField control={control.number} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.issueDate} />
        <FormField control={control.departmentCode} />
      </div>

      <FormField control={control.issuedBy} />
    </div>
  );
};

export const PassportDataForm = memo(PassportDataFormComponent);
```

### CoBorrowerForm

Co-borrower data — personal data, phone, email, relationship, income.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/CoBorrowerForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { CoBorrower } from '../types/credit-application.types';

interface CoBorrowerFormProps {
  control: GroupNodeWithControls<CoBorrower>;
}

const CoBorrowerFormComponent = ({ control }: CoBorrowerFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
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

### PropertyForm

Property information — type, value, description, encumbrance.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/PropertyForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { Property } from '../types/credit-application.types';

interface PropertyFormProps {
  control: GroupNodeWithControls<Property>;
}

const PropertyFormComponent = ({ control }: PropertyFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.type} />
        <FormField control={control.estimatedValue} />
      </div>

      <FormField control={control.description} />

      <FormField control={control.hasEncumbrance} />
    </div>
  );
};

export const PropertyForm = memo(PropertyFormComponent);
```

### ExistingLoanForm

Existing loans — bank, type, amount, remaining, payment, maturity date.

```tsx title="reformer-tutorial/src/forms/credit-application/sub-forms/ExistingLoanForm.tsx"
import { memo } from 'react';
import type { GroupNodeWithControls } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { ExistingLoan } from '../types/credit-application.types';

interface ExistingLoanFormProps {
  control: GroupNodeWithControls<ExistingLoan>;
}

const ExistingLoanFormComponent = ({ control }: ExistingLoanFormProps) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={control.bank} />
        <FormField control={control.type} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField control={control.amount} />
        <FormField control={control.remainingAmount} />
        <FormField control={control.monthlyPayment} />
      </div>

      <FormField control={control.maturityDate} />
    </div>
  );
};

export const ExistingLoanForm = memo(ExistingLoanFormComponent);
```

## Working with Arrays

### Array Operations

`ArrayNodeWithControls` provides the following operations:

| Method            | Description                                  |
| ----------------- | -------------------------------------------- |
| `push()`          | Add new item with default values from schema |
| `removeAt(index)` | Remove item at specific index                |
| `map(callback)`   | Iterate over array items                     |
| `length`          | Get current array length                     |

### FormArrayManager

Universal component for managing form arrays:

```tsx title="reformer-tutorial/src/components/ui/FormArrayManager.tsx"
import type { ComponentType } from 'react';
import {
  useFormControl,
  type ArrayNode,
  type FormFields,
  type GroupNodeWithControls,
} from '@reformer/core';
import { Button } from '@/components/ui/button';

interface FormArrayManagerProps {
  control: ArrayNode<FormFields>;
  component: ComponentType<{ control: GroupNodeWithControls<FormFields> }>;
  itemLabel?: string;
  addButtonLabel?: string;
  emptyMessage?: string;
}

export function FormArrayManager({
  control,
  component: ItemComponent,
  itemLabel = 'Item',
  addButtonLabel = '+ Add',
  emptyMessage = 'No items yet. Click the button above to add one.',
}: FormArrayManagerProps) {
  const { length } = useFormControl(control);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-sm text-muted-foreground">
          {length} {itemLabel}(s)
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => control.push()}>
          {addButtonLabel}
        </Button>
      </div>

      {control.map((itemControl: GroupNodeWithControls<FormFields>, index: number) => {
        const key = itemControl.id || index;

        return (
          <div key={key} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium text-gray-900">
                {itemLabel} #{index + 1}
              </h4>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => control.removeAt(index)}
              >
                Remove
              </Button>
            </div>

            <ItemComponent control={itemControl} />
          </div>
        );
      })}

      {length === 0 && (
        <div className="p-6 bg-gray-50 border border-dashed border-gray-300 rounded-lg text-center text-gray-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}
```

### Using FormArrayManager

```tsx title="reformer-tutorial/src/forms/credit-application/steps/AdditionalInfoForm.tsx"
import { useFormControl } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import { FormArrayManager } from '@/components/forms/FormArrayManager';
import { PropertyForm } from '../sub-forms/PropertyForm';
import { CoBorrowerForm } from '../sub-forms/CoBorrowerForm';

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const { value: hasProperty } = useFormControl(control.hasProperty);
  const { value: hasCoBorrower } = useFormControl(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      <FormField control={control.hasProperty} />
      {hasProperty && (
        <FormArrayManager
          control={control.properties}
          component={PropertyForm}
          itemLabel="Property"
          addButtonLabel="+ Add property"
          emptyMessage="Click to add property information"
        />
      )}

      <FormField control={control.hasCoBorrower} />
      {hasCoBorrower && (
        <FormArrayManager
          control={control.coBorrowers}
          component={CoBorrowerForm}
          itemLabel="Co-borrower"
          addButtonLabel="+ Add co-borrower"
          emptyMessage="Click to add co-borrower information"
        />
      )}
    </div>
  );
}
```

## Best Practices

### 1. Always Use memo()

Wrap nested form components with `memo` to prevent unnecessary re-renders:

```tsx
const AddressFormComponent = ({ control }: AddressFormProps) => { ... };

export const AddressForm = memo(AddressFormComponent);
```

### 2. Type Props via GroupNodeWithControls

```tsx
interface MyFormProps {
  control: GroupNodeWithControls<MyType>;
}
```

### 3. Use Unique Keys for Array Items

Use the `id` property from controls as keys instead of array index:

```tsx
{
  control.map((itemControl, index) => <div key={itemControl.id || index}>...</div>);
}
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
