---
sidebar_position: 3
---

# Schema Decomposition

Breaking down the schema into reusable parts.

## Why Decompose?

In the previous section, we created a complete schema with over 700 lines of code. This schema has several problems:

1. **Duplication** — `registrationAddress` and `residenceAddress` are identical
2. **Large file** — hard to navigate and maintain
3. **No reuse** — can't use `Address` or `PersonalData` in other forms
4. **Error-prone** — changing address fields requires changes in multiple places

Schema decomposition solves these problems by extracting common patterns into reusable modules.

## Extracting Reusable Schemas

### Address Schema

The address structure is used twice in our form. Let's extract it:

```typescript title="src/schemas/address.ts"
import type { FormSchema } from '@reformer/core';
import { Input } from '@/components/ui/input';

export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;
  postalCode: string;
}

export const addressSchema: FormSchema<Address> = {
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
};
```

### Personal Data Schema

Personal data is also a common pattern:

```typescript title="src/schemas/personal-data.ts"
import type { FormSchema } from '@reformer/core';
import { Input, RadioGroup } from '@/components/ui';

export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}

export const personalDataSchema: FormSchema<PersonalData> = {
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
};
```

### Passport Data Schema

```typescript title="src/schemas/passport-data.ts"
import type { FormSchema } from '@reformer/core';
import { Input, Textarea } from '@/components/ui';

export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}

export const passportDataSchema: FormSchema<PassportData> = {
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
};
```

### Property Schema (for arrays)

```typescript title="src/schemas/property.ts"
import type { FormSchema } from '@reformer/core';
import { Input, Select, Textarea, Checkbox } from '@/components/ui';

export type PropertyType = 'apartment' | 'house' | 'land' | 'commercial' | 'car' | 'other';

export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}

export const propertySchema: FormSchema<Property> = {
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
};
```

### Existing Loan Schema (for arrays)

```typescript title="src/schemas/existing-loan.ts"
import type { FormSchema } from '@reformer/core';
import { Input, Select } from '@/components/ui';

export interface ExistingLoan {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}

export const existingLoanSchema: FormSchema<ExistingLoan> = {
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
};
```

### Co-Borrower Schema (nested structure in array)

```typescript title="src/schemas/co-borrower.ts"
import type { FormSchema } from '@reformer/core';
import { Input, Select } from '@/components/ui';

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

export const coBorrowerSchema: FormSchema<CoBorrower> = {
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
};
```

## Composing the Main Schema

Now let's use these extracted schemas in the main form schema:

```typescript title="src/schemas/credit-application.ts"
import type { FormSchema } from '@reformer/core';
import { Input, Select, Checkbox, Textarea, RadioGroup } from '@/components/ui';
import type { CreditApplicationForm } from '../types';

// Import reusable schemas
import { addressSchema } from './address.schema';
import { personalDataSchema } from './personal-data.schema';
import { passportDataSchema } from './passport-data.schema';
import { propertySchema } from './property.schema';
import { existingLoanSchema } from './existing-loan.schema';
import { coBorrowerSchema } from './co-borrower.schema';

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
    componentProps: { label: 'Loan Amount', type: 'number', min: 50000, max: 10000000 },
  },

  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Loan Term (months)', type: 'number', min: 6, max: 240 },
  },

  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Loan Purpose', rows: 3 },
  },

  // Mortgage fields
  propertyValue: {
    value: null,
    component: Input,
    componentProps: { label: 'Property Value', type: 'number', min: 1000000 },
  },

  initialPayment: {
    value: null,
    component: Input,
    componentProps: { label: 'Initial Payment', type: 'number', min: 0 },
  },

  // Car loan fields
  carBrand: { value: '', component: Input, componentProps: { label: 'Car Brand' } },
  carModel: { value: '', component: Input, componentProps: { label: 'Car Model' } },
  carYear: { value: null, component: Input, componentProps: { label: 'Year', type: 'number' } },
  carPrice: {
    value: null,
    component: Input,
    componentProps: { label: 'Car Price', type: 'number' },
  },

  // ============================================================================
  // Step 2: Personal Information — USE REUSABLE SCHEMAS
  // ============================================================================

  personalData: personalDataSchema, // ← Reusable schema
  passportData: passportDataSchema, // ← Reusable schema

  inn: { value: '', component: Input, componentProps: { label: 'INN' } },
  snils: { value: '', component: Input, componentProps: { label: 'SNILS' } },

  // ============================================================================
  // Step 3: Contact Information
  // ============================================================================

  phoneMain: { value: '', component: Input, componentProps: { label: 'Main Phone' } },
  phoneAdditional: { value: '', component: Input, componentProps: { label: 'Additional Phone' } },
  email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
  emailAdditional: {
    value: '',
    component: Input,
    componentProps: { label: 'Additional Email', type: 'email' },
  },

  registrationAddress: addressSchema, // ← Reusable schema
  sameAsRegistration: {
    value: true,
    component: Checkbox,
    componentProps: { label: 'Residence address is the same as registration' },
  },
  residenceAddress: addressSchema, // ← Same schema reused!

  // ============================================================================
  // Step 4: Employment Information
  // ============================================================================

  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
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

  companyName: { value: '', component: Input, componentProps: { label: 'Company Name' } },
  companyInn: { value: '', component: Input, componentProps: { label: 'Company INN' } },
  companyPhone: { value: '', component: Input, componentProps: { label: 'Company Phone' } },
  companyAddress: { value: '', component: Input, componentProps: { label: 'Company Address' } },
  position: { value: '', component: Input, componentProps: { label: 'Position' } },
  workExperienceTotal: {
    value: null,
    component: Input,
    componentProps: { label: 'Total Experience (months)', type: 'number' },
  },
  workExperienceCurrent: {
    value: null,
    component: Input,
    componentProps: { label: 'Current Job (months)', type: 'number' },
  },
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Monthly Income', type: 'number' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Additional Income', type: 'number' },
  },
  additionalIncomeSource: {
    value: '',
    component: Input,
    componentProps: { label: 'Additional Income Source' },
  },
  businessType: { value: '', component: Input, componentProps: { label: 'Business Type' } },
  businessInn: { value: '', component: Input, componentProps: { label: 'Business INN' } },
  businessActivity: {
    value: '',
    component: Textarea,
    componentProps: { label: 'Business Activity', rows: 3 },
  },

  // ============================================================================
  // Step 5: Additional Information — ARRAYS USE REUSABLE SCHEMAS
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
    componentProps: { label: 'Dependents', type: 'number' },
  },
  education: {
    value: 'higher',
    component: Select,
    componentProps: {
      label: 'Education',
      options: [
        { value: 'secondary', label: 'Secondary' },
        { value: 'specialized', label: 'Specialized' },
        { value: 'higher', label: 'Higher' },
        { value: 'postgraduate', label: 'Postgraduate' },
      ],
    },
  },

  hasProperty: { value: false, component: Checkbox, componentProps: { label: 'I have property' } },
  properties: [propertySchema], // ← Array with reusable schema

  hasExistingLoans: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I have existing loans' },
  },
  existingLoans: [existingLoanSchema], // ← Array with reusable schema

  hasCoBorrower: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Add co-borrower' },
  },
  coBorrowers: [coBorrowerSchema], // ← Array with reusable schema

  // ============================================================================
  // Step 6: Confirmations
  // ============================================================================

  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to processing of personal data' },
  },
  agreeCreditHistory: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to credit history check' },
  },
  agreeMarketing: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to marketing materials' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to loan terms' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I confirm accuracy' },
  },
  electronicSignature: { value: '', component: Input, componentProps: { label: 'SMS Code' } },

  // ============================================================================
  // Computed Fields
  // ============================================================================

  interestRate: {
    value: 0,
    component: Input,
    componentProps: { label: 'Interest Rate (%)', disabled: true },
  },
  monthlyPayment: {
    value: 0,
    component: Input,
    componentProps: { label: 'Monthly Payment', disabled: true },
  },
  fullName: { value: '', component: Input, componentProps: { label: 'Full Name', disabled: true } },
  age: { value: null, component: Input, componentProps: { label: 'Age', disabled: true } },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Total Income', disabled: true },
  },
  paymentToIncomeRatio: {
    value: 0,
    component: Input,
    componentProps: { label: 'Payment/Income (%)', disabled: true },
  },
  coBorrowersIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Co-Borrowers Income', disabled: true },
  },
};
```

## File Structure

After decomposition, your project structure might look like:

```
src/
├── schemas/
│   ├── address.ts
│   ├── personal-data.ts
│   ├── passport-data.ts
│   ├── property.ts
│   ├── existing-loan.ts
│   ├── co-borrower.ts
│   └── credit-application.ts
└── types/
    └── credit-application.ts
```

## Benefits of Decomposition

### 1. Reusability

The same schema can be used in multiple places:

```typescript
// Credit application form
registrationAddress: addressSchema,
residenceAddress: addressSchema,

// Company form (different project)
companyAddress: addressSchema,
```

### 2. Easier Testing

You can test each schema in isolation:

```typescript
describe('addressSchema', () => {
  it('should have all required fields', () => {
    expect(addressSchema).toHaveProperty('city');
    expect(addressSchema).toHaveProperty('street');
    expect(addressSchema).toHaveProperty('house');
  });
});
```

### 3. Better Maintainability

Changing the address structure only requires editing one file:

```typescript
// address.ts - add a new field
export const addressSchema: FormSchema<Address> = {
  // ... existing fields
  country: {
    // ← New field
    value: '',
    component: Input,
    componentProps: { label: 'Country' },
  },
};
```

Both `registrationAddress` and `residenceAddress` automatically get the new field.

### 4. Type Safety

Each schema exports its interface, ensuring type safety:

```typescript
import type { Address } from './schemas/address.schema';
import type { PersonalData } from './schemas/personal-data.schema';

// Full type safety in the main interface
interface CreditApplicationForm {
  registrationAddress: Address;
  residenceAddress: Address;
  personalData: PersonalData;
  // ...
}
```

## When to Extract a Schema

Extract a schema when:

1. **Used multiple times** — addresses, contacts, any repeated structure
2. **Logically independent** — personal data, passport data, property
3. **Complex enough** — more than 3-4 fields
4. **Might be reused** — in other forms or projects

Keep inline when:

1. **Used once** — loan type selection, confirmations
2. **Tightly coupled** — fields that only make sense together in this context
3. **Simple** — single checkbox or input

## Next Steps

Now that we have a well-organized schema, let's move on to rendering the form UI and connecting it to our components.
