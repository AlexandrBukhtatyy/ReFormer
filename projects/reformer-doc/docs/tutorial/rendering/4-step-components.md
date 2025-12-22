---
sidebar_position: 4
---

# Step Components

Creating individual step components for the multi-step form.

## Overview

Each step component:

- Receives the form instance as a `control` prop
- Renders its specific fields using `FormField`
- Can show/hide fields based on form values
- Uses `useFormControl` to subscribe to value changes

## Step Component Structure

All step components follow the same pattern:

```tsx
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface StepProps {
  control: FormProxy<CreditApplicationForm>;
}

export function StepName({ control }: StepProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Step Title</h2>

      <FormField control={control.fieldName} />
      {/* More fields... */}
    </div>
  );
}
```

## Step 1: Basic Loan Information

The first step collects loan details with conditional fields:

```tsx title="src/steps/BasicInfoForm.tsx"
import type { FormProxy } from '@reformer/core';
import { useFormControl } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface BasicInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function BasicInfoForm({ control }: BasicInfoFormProps) {
  // Subscribe to loanType changes
  const { value: loanType } = useFormControl(control.loanType);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Basic Loan Information</h2>

      {/* Common fields */}
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      <FormField control={control.loanTerm} />
      <FormField control={control.loanPurpose} />

      {/* Conditional: Mortgage fields */}
      {loanType === 'mortgage' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Property Information</h3>
          <FormField control={control.propertyValue} />
          <FormField control={control.initialPayment} />
        </>
      )}

      {/* Conditional: Car loan fields */}
      {loanType === 'car' && (
        <>
          <h3 className="text-lg font-semibold mt-4">Car Information</h3>
          <FormField control={control.carBrand} />
          <FormField control={control.carModel} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.carYear} />
            <FormField control={control.carPrice} />
          </div>
        </>
      )}
    </div>
  );
}
```

### Key Points

1. **`useFormControl`** — subscribes to field value changes and triggers re-render
2. **Conditional rendering** — show/hide fields based on `loanType`
3. **Grid layout** — use CSS grid for side-by-side fields

## Step 2: Personal Information

This step demonstrates nested form usage:

```tsx title="src/steps/PersonalInfoForm.tsx"
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import { PersonalDataForm } from '../nested-forms/PersonalDataForm';
import { PassportDataForm } from '../nested-forms/PassportDataForm';
import type { CreditApplicationForm } from '../types';

interface PersonalInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function PersonalInfoForm({ control }: PersonalInfoFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Personal Information</h2>

      {/* Nested form: Personal Data */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Personal Data</h3>
        <PersonalDataForm control={control.personalData} />
      </div>

      {/* Nested form: Passport Data */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Passport Data</h3>
        <PassportDataForm control={control.passportData} />
      </div>

      {/* Additional documents */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Additional Documents</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.inn} />
          <FormField control={control.snils} />
        </div>
      </div>
    </div>
  );
}
```

## Step 3: Contact Information

Demonstrates reusing nested forms and group operations:

```tsx title="src/steps/ContactInfoForm.tsx"
import type { FormProxy } from '@reformer/core';
import { useFormControl } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '../nested-forms/AddressForm';
import type { CreditApplicationForm } from '../types';

interface ContactInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function ContactInfoForm({ control }: ContactInfoFormProps) {
  const { value: sameAsRegistration } = useFormControl(control.sameAsRegistration);

  // Copy registration address to residence address
  const copyAddress = () => {
    const regAddress = control.registrationAddress.getValue();
    control.residenceAddress.setValue(regAddress);
  };

  // Clear residence address
  const clearAddress = () => {
    control.residenceAddress.reset();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Contact Information</h2>

      {/* Phone numbers */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Phone Numbers</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.phoneMain} />
          <FormField control={control.phoneAdditional} />
        </div>
      </div>

      {/* Email addresses */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Email</h3>
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.email} />
          <FormField control={control.emailAdditional} />
        </div>
      </div>

      {/* Registration address */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Registration Address</h3>
        <AddressForm control={control.registrationAddress} />
      </div>

      {/* Same address checkbox */}
      <FormField control={control.sameAsRegistration} />

      {/* Residence address (conditional) */}
      {!sameAsRegistration && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Residence Address</h3>
            <button
              type="button"
              onClick={copyAddress}
              className="text-sm text-blue-600 hover:underline"
            >
              Copy from registration
            </button>
          </div>

          <AddressForm control={control.residenceAddress} />

          <button
            type="button"
            onClick={clearAddress}
            className="text-sm text-gray-600 hover:underline"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
```

### Group Operations

- **`getValue()`** — get all values from a nested group
- **`setValue()`** — set all values in a nested group
- **`reset()`** — reset group to initial values

## Step 4: Employment Information

Shows conditional sections based on employment status:

```tsx title="src/steps/EmploymentForm.tsx"
import type { FormProxy } from '@reformer/core';
import { useFormControl } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface EmploymentFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function EmploymentForm({ control }: EmploymentFormProps) {
  const { value: employmentStatus } = useFormControl(control.employmentStatus);

  const isEmployed = employmentStatus === 'employed';
  const isSelfEmployed = employmentStatus === 'selfEmployed';

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Employment Information</h2>

      <FormField control={control.employmentStatus} />

      {/* Employed section */}
      {isEmployed && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold">Company Information</h3>
          <FormField control={control.companyName} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.companyInn} />
            <FormField control={control.companyPhone} />
          </div>
          <FormField control={control.companyAddress} />
          <FormField control={control.position} />
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.workExperienceTotal} />
            <FormField control={control.workExperienceCurrent} />
          </div>
        </div>
      )}

      {/* Self-employed section */}
      {isSelfEmployed && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
          <h3 className="text-lg font-semibold">Business Information</h3>
          <FormField control={control.businessType} />
          <FormField control={control.businessInn} />
          <FormField control={control.businessActivity} />
        </div>
      )}

      {/* Income section (for employed and self-employed) */}
      {(isEmployed || isSelfEmployed) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Income</h3>
          <div className="grid grid-cols-2 gap-4">
            <FormField control={control.monthlyIncome} />
            <FormField control={control.additionalIncome} />
          </div>
          <FormField control={control.additionalIncomeSource} />
        </div>
      )}
    </div>
  );
}
```

## Шаг 5: Дополнительная информация

Демонстрирует работу с массивами через `FormArray` из `@reformer/ui`:

```tsx title="src/steps/AdditionalInfoForm.tsx"
import type { FormProxy } from '@reformer/core';
import { useFormControlValue } from '@reformer/core';
import { FormArray } from '@reformer/ui/form-array';
import { FormField } from '@/components/ui/FormField';
import { PropertyForm } from '../sub-forms/property/PropertyForm';
import { ExistingLoanForm } from '../sub-forms/existing-loan/ExistingLoanForm';
import { CoBorrowerForm } from '../sub-forms/co-borrower/CoBorrowerForm';
import { Button } from '@/components/ui/button';
import type { CreditApplicationForm } from '../types';

interface AdditionalInfoFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasExistingLoans = useFormControlValue(control.hasExistingLoans);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Дополнительная информация</h2>

      {/* Общая информация */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Общие сведения</h3>
        <FormField control={control.maritalStatus} />
        <div className="grid grid-cols-2 gap-4">
          <FormField control={control.dependents} />
          <FormField control={control.education} />
        </div>
      </div>

      {/* Массив имущества */}
      <div className="space-y-4">
        <FormField control={control.hasProperty} />
        {hasProperty && (
          <FormArray.Root control={control.properties}>
            <div className="flex justify-between items-center">
              <FormArray.Count render={(count) => (
                <span className="text-sm text-muted-foreground">{count} Имущество</span>
              )} />
              <FormArray.AddButton asChild>
                <Button type="button" variant="outline" size="sm">
                  + Добавить имущество
                </Button>
              </FormArray.AddButton>
            </div>

            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <div className="p-4 bg-white rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Имущество #{index + 1}</h4>
                    <Button variant="destructive" size="sm" onClick={remove}>
                      Удалить
                    </Button>
                  </div>
                  <PropertyForm control={itemControl} />
                </div>
              )}
            </FormArray.List>

            <FormArray.Empty>
              <div className="p-6 bg-gray-50 border-dashed border rounded-lg text-center text-gray-500">
                Нет имущества. Нажмите кнопку выше, чтобы добавить.
              </div>
            </FormArray.Empty>
          </FormArray.Root>
        )}
      </div>

      {/* Массив существующих кредитов */}
      <div className="space-y-4">
        <FormField control={control.hasExistingLoans} />
        {hasExistingLoans && (
          <FormArray.Root control={control.existingLoans}>
            <div className="flex justify-between items-center">
              <FormArray.Count render={(count) => (
                <span className="text-sm text-muted-foreground">{count} Существующие кредиты</span>
              )} />
              <FormArray.AddButton asChild>
                <Button type="button" variant="outline" size="sm">
                  + Добавить кредит
                </Button>
              </FormArray.AddButton>
            </div>

            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <div className="p-4 bg-white rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Кредит #{index + 1}</h4>
                    <Button variant="destructive" size="sm" onClick={remove}>
                      Удалить
                    </Button>
                  </div>
                  <ExistingLoanForm control={itemControl} />
                </div>
              )}
            </FormArray.List>

            <FormArray.Empty>
              <div className="p-6 bg-gray-50 border-dashed border rounded-lg text-center text-gray-500">
                Нет кредитов. Нажмите кнопку выше, чтобы добавить.
              </div>
            </FormArray.Empty>
          </FormArray.Root>
        )}
      </div>

      {/* Массив созаёмщиков */}
      <div className="space-y-4">
        <FormField control={control.hasCoBorrower} />
        {hasCoBorrower && (
          <FormArray.Root control={control.coBorrowers}>
            <div className="flex justify-between items-center">
              <FormArray.Count render={(count) => (
                <span className="text-sm text-muted-foreground">{count} Созаёмщики</span>
              )} />
              <FormArray.AddButton asChild>
                <Button type="button" variant="outline" size="sm">
                  + Добавить созаёмщика
                </Button>
              </FormArray.AddButton>
            </div>

            <FormArray.List>
              {({ control: itemControl, index, remove }) => (
                <div className="p-4 bg-white rounded-lg border shadow-sm">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium">Созаёмщик #{index + 1}</h4>
                    <Button variant="destructive" size="sm" onClick={remove}>
                      Удалить
                    </Button>
                  </div>
                  <CoBorrowerForm control={itemControl} />
                </div>
              )}
            </FormArray.List>

            <FormArray.Empty>
              <div className="p-6 bg-gray-50 border-dashed border rounded-lg text-center text-gray-500">
                Нет созаёмщиков. Нажмите кнопку выше, чтобы добавить.
              </div>
            </FormArray.Empty>
          </FormArray.Root>
        )}
      </div>
    </div>
  );
}
```

## Шаг 6: Подтверждение

Финальный шаг со всеми подтверждениями:

```tsx title="src/steps/ConfirmationForm.tsx"
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/form-field';
import type { CreditApplicationForm } from '../types';

interface ConfirmationFormProps {
  control: FormProxy<CreditApplicationForm>;
}

export function ConfirmationForm({ control }: ConfirmationFormProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Confirmation</h2>

      <div className="space-y-4">
        <FormField control={control.agreePersonalData} />
        <FormField control={control.agreeCreditHistory} />
        <FormField control={control.agreeMarketing} />
        <FormField control={control.agreeTerms} />
        <FormField control={control.confirmAccuracy} />
      </div>

      <div className="mt-6">
        <FormField control={control.electronicSignature} />
      </div>
    </div>
  );
}
```

## Best Practices

### 1. Use Semantic Sections

Group related fields together with headings:

```tsx
<div className="space-y-4">
  <h3 className="text-lg font-semibold">Section Title</h3>
  <FormField control={control.field1} />
  <FormField control={control.field2} />
</div>
```

### 2. Leverage Grid for Layout

Use CSS grid for side-by-side fields:

```tsx
<div className="grid grid-cols-2 gap-4">
  <FormField control={control.firstName} />
  <FormField control={control.lastName} />
</div>
```

### 3. Conditional Rendering with `useFormControl`

Subscribe only to the fields you need:

```tsx
const { value: status } = useFormControl(control.status);

// Only re-renders when status changes
{
  status === 'active' && <ActiveSection />;
}
```

### 4. Extract Reusable Patterns

If you use the same layout multiple times, extract it:

```tsx
function TwoColumnFields({ left, right }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField control={left} />
      <FormField control={right} />
    </div>
  );
}
```

## Next Steps

Now let's learn how to create reusable nested form components and work with arrays.
