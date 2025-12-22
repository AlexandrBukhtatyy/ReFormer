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

1. **Props interface** — defines `control` type via `FormProxy<T>`
2. **Component** — responsible only for field layout using `FormField`
3. **Memoization** — wrap in `memo()` to prevent unnecessary re-renders

```tsx
// 1. Props interface
interface MyFormProps {
  control: FormProxy<MyType>;
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
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { Address } from '../types/credit-application.types';

interface AddressFormProps {
  control: FormProxy<Address>;
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
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { PersonalData } from '../types/credit-application.types';

interface PersonalDataFormProps {
  control: FormProxy<PersonalData>;
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
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { PassportData } from '../types/credit-application.types';

interface PassportDataFormProps {
  control: FormProxy<PassportData>;
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
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { CoBorrower } from '../types/credit-application.types';

interface CoBorrowerFormProps {
  control: FormProxy<CoBorrower>;
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
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { Property } from '../types/credit-application.types';

interface PropertyFormProps {
  control: FormProxy<Property>;
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
import type { FormProxy } from '@reformer/core';
import { FormField } from '@/components/ui/FormField';
import type { ExistingLoan } from '../types/credit-application.types';

interface ExistingLoanFormProps {
  control: FormProxy<ExistingLoan>;
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

## Работа с массивами

### Операции с массивами

`FormArrayProxy` предоставляет следующие операции:

| Метод             | Описание                                          |
| ----------------- | ------------------------------------------------- |
| `push()`          | Добавить элемент с дефолтными значениями из схемы |
| `removeAt(index)` | Удалить элемент по индексу                        |
| `map(callback)`   | Итерация по элементам массива                     |
| `length`          | Получить текущую длину массива                    |

### FormArray из @reformer/ui

Пакет `@reformer/ui` предоставляет `FormArray` — headless compound component для управления массивами форм:

```bash
npm install @reformer/ui
```

#### Базовое использование

```tsx
import { FormArray } from '@reformer/ui/form-array';
import { Button } from '@/components/ui/button';

<FormArray.Root control={form.items}>
  <FormArray.Empty>
    <p>Пока нет элементов</p>
  </FormArray.Empty>

  <FormArray.List>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Элемент #{index + 1}</h4>
        <ItemForm control={control} />
        <button onClick={remove}>Удалить</button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Добавить элемент</FormArray.AddButton>
</FormArray.Root>
```

#### Субкомпоненты

| Компонент              | Props                        | Назначение                           |
| ---------------------- | ---------------------------- | ------------------------------------ |
| `FormArray.Root`       | `control: ArrayNode<T>`      | Провайдер контекста                  |
| `FormArray.List`       | `children: (item) => Node`   | Итерация с render props              |
| `FormArray.AddButton`  | `initialValue?: Partial<T>`  | Добавить новый элемент               |
| `FormArray.Empty`      | `children: ReactNode`        | Показать когда массив пустой         |
| `FormArray.Count`      | `render?: (count) => Node`   | Отображение количества               |

#### Render Props в List

```typescript
interface FormArrayItemRenderProps<T> {
  control: FormProxy<T>;  // Контрол элемента
  index: number;                       // Индекс (с 0)
  id: string | number;                 // Уникальный ключ
  remove: () => void;                  // Удалить этот элемент
}
```

### Использование FormArray в AdditionalInfoForm

```tsx title="reformer-tutorial/src/forms/credit-application/steps/AdditionalInfoForm.tsx"
import { useFormControlValue } from '@reformer/core';
import { FormArray } from '@reformer/ui/form-array';
import { FormField } from '@/components/ui/FormField';
import { PropertyForm } from '../sub-forms/property/PropertyForm';
import { CoBorrowerForm } from '../sub-forms/co-borrower/CoBorrowerForm';
import { Button } from '@/components/ui/button';

export function AdditionalInfoForm({ control }: AdditionalInfoFormProps) {
  const hasProperty = useFormControlValue(control.hasProperty);
  const hasCoBorrower = useFormControlValue(control.hasCoBorrower);

  return (
    <div className="space-y-6">
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
  );
}
```

### Хук useFormArray

Для полной кастомизации без compound components:

```tsx
import { useFormArray } from '@reformer/ui/form-array';

function CustomList({ control }) {
  const { items, add, isEmpty, length } = useFormArray(control);

  return (
    <div>
      <span>Всего: {length}</span>
      {items.map(({ control, id, remove }) => (
        <div key={id}>
          <ItemForm control={control} />
          <button onClick={remove}>X</button>
        </div>
      ))}
      {isEmpty && <p>Пусто</p>}
      <button onClick={() => add()}>Добавить</button>
    </div>
  );
}
```

## Лучшие практики

### 1. Всегда используйте memo()

Оборачивайте вложенные компоненты форм в `memo` для предотвращения лишних ре-рендеров:

```tsx
const AddressFormComponent = ({ control }: AddressFormProps) => { ... };

export const AddressForm = memo(AddressFormComponent);
```

### 2. Типизируйте Props через FormProxy

```tsx
interface MyFormProps {
  control: FormProxy<MyType>;
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
