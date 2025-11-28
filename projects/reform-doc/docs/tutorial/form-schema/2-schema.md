---
sidebar_position: 2
---

# Form Schema

Creating the complete form schema for the Credit Application form.

## Overview

The form schema is a JavaScript object that describes the structure of your form. It defines:

- **Field configurations** — initial values, components, and props
- **Nested objects** — using nested schema objects (creates `GroupNode`)
- **Arrays** — using array syntax (creates `ArrayNode`)

## Field Configuration

Each field in the schema has three main properties:

```typescript
{
  fieldName: {
    value: initialValue,        // Initial value
    component: UIComponent,     // React component to render
    componentProps: { ... }     // Props passed to component (typed based on component)
  }
}
```

:::info Type Safety
The `componentProps` field is fully typed based on the `component` you specify. TypeScript will only allow props that the component accepts.
:::

## Nested Objects

For nested data structures, use a nested schema object:

```typescript
personalData: {
  firstName: { value: '', component: Input, componentProps: { label: 'First Name' } },
  lastName: { value: '', component: Input, componentProps: { label: 'Last Name' } },
}
```

## Arrays

For repeating sections, wrap the item schema in array brackets:

```typescript
properties: [{
  type: { value: 'apartment', component: Select, componentProps: { ... } },
  value: { value: 0, component: Input, componentProps: { ... } },
}]
```

## Complete Credit Application Schema

Here is the complete schema matching our `CreditApplicationForm` interface:

```typescript title="src\forms\credit-application\schemas\credit-application.ts"
import type { FormSchema } from 'reformer';
import { Input, Select, Checkbox, Textarea, RadioGroup } from './components/ui';
import type { CreditApplicationForm } from './types';

export const creditApplicationSchema: FormSchema<CreditApplicationForm> = {
  // ============================================================================
  // Step 1: Basic Loan Information
  // ============================================================================

  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Loan Type',
      options: [
        { value: 'consumer', label: 'Consumer Loan' },
        { value: 'mortgage', label: 'Mortgage' },
        { value: 'car', label: 'Car Loan' },
        { value: 'business', label: 'Business Loan' },
        { value: 'refinancing', label: 'Refinancing' },
      ],
    },
  },

  loanAmount: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Loan Amount',
      type: 'number',
      placeholder: 'Enter amount',
      min: 50000,
      max: 10000000,
    },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: {
      label: 'Loan Term (months)',
      type: 'number',
      min: 6,
      max: 240,
    },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Loan Purpose',
      placeholder: 'Describe what you plan to use the funds for',
      rows: 3,
    },
  },

  // Mortgage-specific fields
  propertyValue: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Property Value',
      type: 'number',
      min: 1000000,
    },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Initial Payment',
      type: 'number',
      min: 0,
    },
  },

  // Car loan-specific fields
  carBrand: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Car Brand',
      placeholder: 'e.g., Toyota',
    },
  },

  carModel: {
    value: '',
    component: Input,
    componentProps: {
      label: 'Car Model',
      placeholder: 'e.g., Camry',
    },
  },

  carYear: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Year',
      type: 'number',
      min: 2000,
      max: new Date().getFullYear() + 1,
    },
  },

  carPrice: {
    value: null,
    component: Input,
    componentProps: {
      label: 'Car Price',
      type: 'number',
      min: 300000,
    },
  },

  // ============================================================================
  // Step 2: Personal Information (nested objects)
  // ============================================================================

  personalData: {
    lastName: {
      value: '',
      component: Input,
      componentProps: { label: 'Last Name', placeholder: 'Enter last name' },
    },
    firstName: {
      value: '',
      component: Input,
      componentProps: { label: 'First Name', placeholder: 'Enter first name' },
    },
    middleName: {
      value: '',
      component: Input,
      componentProps: { label: 'Middle Name', placeholder: 'Enter middle name' },
    },
    birthDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Birth Date', type: 'date' },
    },
    birthPlace: {
      value: '',
      component: Input,
      componentProps: { label: 'Birth Place', placeholder: 'Enter birth place' },
    },
    gender: {
      value: 'male',
      component: RadioGroup,
      componentProps: {
        label: 'Gender',
        options: [
          { value: 'male', label: 'Male' },
          { value: 'female', label: 'Female' },
        ],
      },
    },
  },

  passportData: {
    series: {
      value: '',
      component: Input,
      componentProps: { label: 'Passport Series', placeholder: '00 00' },
    },
    number: {
      value: '',
      component: Input,
      componentProps: { label: 'Passport Number', placeholder: '000000' },
    },
    issueDate: {
      value: '',
      component: Input,
      componentProps: { label: 'Issue Date', type: 'date' },
    },
    issuedBy: {
      value: '',
      component: Textarea,
      componentProps: { label: 'Issued By', placeholder: 'Issuing authority', rows: 2 },
    },
    departmentCode: {
      value: '',
      component: Input,
      componentProps: { label: 'Department Code', placeholder: '000-000' },
    },
  },

  inn: {
    value: '',
    component: Input,
    componentProps: { label: 'INN', placeholder: '000000000000' },
  },

  snils: {
    value: '',
    component: Input,
    componentProps: { label: 'SNILS', placeholder: '000-000-000 00' },
  },

  // ============================================================================
  // Step 3: Contact Information
  // ============================================================================

  phoneMain: {
    value: '',
    component: Input,
    componentProps: { label: 'Main Phone', placeholder: '+7 (000) 000-00-00' },
  },

  phoneAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Additional Phone', placeholder: '+7 (000) 000-00-00' },
  },

  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
  },

  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Additional Email', type: 'email', placeholder: 'example@mail.com' },
  },

  // Registration Address (nested)
  registrationAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Region', placeholder: 'Enter region' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: { label: 'City', placeholder: 'Enter city' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Street', placeholder: 'Enter street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'House', placeholder: 'House number' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Apartment', placeholder: 'Apt number' },
    },
    postalCode: {
      value: '',
      component: Input,
      componentProps: { label: 'Postal Code', placeholder: '000000' },
    },
  },

  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Residence address is the same as registration' },
  },

  // Residence Address (nested)
  residenceAddress: {
    region: {
      value: '',
      component: Input,
      componentProps: { label: 'Region', placeholder: 'Enter region' },
    },
    city: {
      value: '',
      component: Input,
      componentProps: { label: 'City', placeholder: 'Enter city' },
    },
    street: {
      value: '',
      component: Input,
      componentProps: { label: 'Street', placeholder: 'Enter street' },
    },
    house: {
      value: '',
      component: Input,
      componentProps: { label: 'House', placeholder: 'House number' },
    },
    apartment: {
      value: '',
      component: Input,
      componentProps: { label: 'Apartment', placeholder: 'Apt number' },
    },
    postalCode: {
      value: '',
      component: Input,
      componentProps: { label: 'Postal Code', placeholder: '000000' },
    },
  },

  // ============================================================================
  // Step 4: Employment Information
  // ============================================================================

  employmentStatus: {
    value: 'employed',
    component: Select,
    componentProps: {
      label: 'Employment Status',
      options: [
        { value: 'employed', label: 'Employed' },
        { value: 'selfEmployed', label: 'Self-Employed' },
        { value: 'unemployed', label: 'Unemployed' },
        { value: 'retired', label: 'Retired' },
        { value: 'student', label: 'Student' },
      ],
    },
  },

  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Company Name', placeholder: 'Enter company name' },
  },

  companyInn: {
    value: '',
    component: Input,
    componentProps: { label: 'Company INN', placeholder: '0000000000' },
  },

  companyPhone: {
    value: '',
    component: Input,
    componentProps: { label: 'Company Phone', placeholder: '+7 (000) 000-00-00' },
  },

  companyAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Company Address', placeholder: 'Full address' },
  },

  position: {
    value: '',
    component: Input,
    componentProps: { label: 'Position', placeholder: 'Your position' },
  },

  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Total Work Experience (months)', type: 'number', min: 0 },
  },

  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Current Job Experience (months)', type: 'number', min: 0 },
  },

  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Monthly Income', type: 'number', min: 0 },
  },

  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Additional Income', type: 'number', min: 0 },
  },

  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Additional Income Source', placeholder: 'Describe source' },
  },

  // Self-employed specific fields
  businessType: {
    value: '',
    component: Input,
    componentProps: { label: 'Business Type', placeholder: 'LLC, Sole Proprietor, etc.' },
  },

  businessInn: {
    value: '',
    component: Input,
    componentProps: { label: 'Business INN', placeholder: '000000000000' },
  },

  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Business Activity', placeholder: 'Describe your business', rows: 3 },
  },

  // ============================================================================
  // Step 5: Additional Information
  // ============================================================================

  maritalStatus: {
    value: 'single',
    component: RadioGroup,
    componentProps: {
      label: 'Marital Status',
      options: [
        { value: 'single', label: 'Single' },
        { value: 'married', label: 'Married' },
        { value: 'divorced', label: 'Divorced' },
        { value: 'widowed', label: 'Widowed' },
      ],
    },
  },

  dependents: {
    value: 0,
    component: Input,
    componentProps: { label: 'Number of Dependents', type: 'number', min: 0, max: 10 },
  },

  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Education',
      options: [
        { value: 'secondary', label: 'Secondary' },
        { value: 'specialized', label: 'Specialized Secondary' },
        { value: 'higher', label: 'Higher' },
        { value: 'postgraduate', label: 'Postgraduate' },
      ],
    },
  },

  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I have property' },
  },

  // Properties Array
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Property Type',
          options: [
            { value: 'apartment', label: 'Apartment' },
            { value: 'house', label: 'House' },
            { value: 'land', label: 'Land' },
            { value: 'commercial', label: 'Commercial' },
            { value: 'car', label: 'Car' },
            { value: 'other', label: 'Other' },
          ],
        },
      },
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Description', placeholder: 'Describe the property', rows: 2 },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Estimated Value', type: 'number', min: 0 },
      },
      hasEncumbrance: {
        value: false,
        component: Checkbox,
        componentProps: { label: 'Has encumbrance (mortgage, lien)' },
      },
    },
  ],

  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I have existing loans' },
  },

  // Existing Loans Array
  existingLoans: [
    {
      bank: {
        value: '',
        component: Input,
        componentProps: { label: 'Bank', placeholder: 'Bank name' },
      },
      type: {
        value: 'consumer',
        component: Select,
        componentProps: {
          label: 'Loan Type',
          options: [
            { value: 'consumer', label: 'Consumer' },
            { value: 'mortgage', label: 'Mortgage' },
            { value: 'car', label: 'Car Loan' },
            { value: 'credit_card', label: 'Credit Card' },
          ],
        },
      },
      amount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Loan Amount', type: 'number', min: 0 },
      },
      remainingAmount: {
        value: 0,
        component: Input,
        componentProps: { label: 'Remaining Amount', type: 'number', min: 0 },
      },
      monthlyPayment: {
        value: 0,
        component: Input,
        componentProps: { label: 'Monthly Payment', type: 'number', min: 0 },
      },
      maturityDate: {
        value: '',
        component: Input,
        componentProps: { label: 'Maturity Date', type: 'date' },
      },
    },
  ],

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Add co-borrower' },
  },

  // Co-Borrowers Array (with nested personalData)
  coBorrowers: [
    {
      personalData: {
        lastName: {
          value: '',
          component: Input,
          componentProps: { label: 'Last Name' },
        },
        firstName: {
          value: '',
          component: Input,
          componentProps: { label: 'First Name' },
        },
        middleName: {
          value: '',
          component: Input,
          componentProps: { label: 'Middle Name' },
        },
        birthDate: {
          value: '',
          component: Input,
          componentProps: { label: 'Birth Date', type: 'date' },
        },
      },
      phone: {
        value: '',
        component: Input,
        componentProps: { label: 'Phone', placeholder: '+7 (000) 000-00-00' },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email' },
      },
      relationship: {
        value: 'spouse',
        component: Select,
        componentProps: {
          label: 'Relationship',
          options: [
            { value: 'spouse', label: 'Spouse' },
            { value: 'parent', label: 'Parent' },
            { value: 'child', label: 'Child' },
            { value: 'sibling', label: 'Sibling' },
            { value: 'other', label: 'Other' },
          ],
        },
      },
      monthlyIncome: {
        value: 0,
        component: Input,
        componentProps: { label: 'Monthly Income', type: 'number', min: 0 },
      },
    },
  ],

  // ============================================================================
  // Step 6: Confirmations
  // ============================================================================

  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to the processing of personal data' },
  },

  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to credit history check' },
  },

  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to receive marketing materials' },
  },

  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to the loan terms' },
  },

  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I confirm the accuracy of the information provided' },
  },

  electronicSignature: {
    value: '',
    component: Input,
    componentProps: { label: 'SMS Confirmation Code', placeholder: '000000' },
  },

  // ============================================================================
  // Computed Fields (read-only, values set by behaviors)
  // ============================================================================

  interestRate: {
    value: 0,
    component: Input,
    componentProps: { label: 'Interest Rate (%)', type: 'number', disabled: true },
  },

  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Monthly Payment', type: 'number', disabled: true },
  },

  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Full Name', disabled: true },
  },

  age: {
    value: null,
    component: Input,
    componentProps: { label: 'Age', type: 'number', disabled: true },
  },

  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Total Income', type: 'number', disabled: true },
  },

  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Payment to Income Ratio (%)', type: 'number', disabled: true },
  },

  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Co-Borrowers Total Income', type: 'number', disabled: true },
  },
};
```

## Creating the Form Instance

```typescript title="src\forms\credit-application\createCreditApplicationForm.ts"
import { createForm } from 'reformer';
import type { CreditApplicationForm } from './types';
import { creditApplicationSchema } from './schemas/credit-application.schema';

export const createCreditApplicationForm = () => {
  return createForm<CreditApplicationForm>(creditApplicationSchema);
};
```

## Working with the Form

### Accessing Fields

```typescript
const form = createCreditApplicationForm();

// Simple fields
<FormField control={form.controls.loanAmount} />

// Nested fields
<FormField control={form.controls.personalData.firstName} />
<FormField control={form.controls.registrationAddress.city} />

// Array items
form.controls.properties.controls.map((property, index) => (
  <FormField control={property.controls.type} />
));
```

### Array Operations

```typescript
// Add item
form.controls.properties.push();

// Remove item
form.controls.properties.removeAt(index);

// Get length
const count = form.controls.properties.length.value;
```

## Schema Issues

As you can see, this schema has several problems:

1. **Duplication** — `registrationAddress` and `residenceAddress` have identical structure
2. **Large file** — over 700 lines, hard to navigate
3. **No reuse** — similar patterns repeated (addresses, personal data)
4. **Hard to maintain** — changing address fields requires changes in multiple places

In the next section, we'll learn how to decompose this schema into smaller, reusable parts.

## Next Steps

The schema works, but it's hard to maintain. Let's learn how to decompose it into reusable parts in the next section.
