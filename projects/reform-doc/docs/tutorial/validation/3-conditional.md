---
sidebar_position: 3
---

# Conditional Validation

Conditional validation with `apply` and `applyWhen`.

## Overview

Conditional validation allows you to:

- Apply validation rules only when certain conditions are met
- Use different validation rules for different scenarios
- Compose validation schemas for nested objects
- Create dynamic validation based on form state

ReFormer provides two key functions:

| Function | Purpose |
|----------|---------|
| `apply` | Compose validation schemas for nested objects |
| `applyWhen` | Apply validation only when a condition is true |

## apply

The `apply` function composes validation schemas, allowing you to break down complex forms into smaller, reusable validation functions.

```typescript
import { apply } from 'reformer/validators';

apply(
  path,           // Field path (usually root or nested object path)
  validationFn    // Validation schema function to apply
);
```

### Basic Example

```typescript title="src/validators/credit-validators.ts"
import { apply, required, email, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Address {
  street: string;
  city: string;
  postalCode: string;
}

interface CreditApplicationForm {
  firstName: string;
  lastName: string;
  email: string;
  registrationAddress: Address;
  residenceAddress: Address;
}

// Separate validation for address
const addressValidation: ValidationSchemaFn<Address> = (path: FieldPath<Address>) => {
  required(path.street, { message: 'Street is required' });
  required(path.city, { message: 'City is required' });
  required(path.postalCode, { message: 'Postal code is required' });
  pattern(path.postalCode, /^\d{6}$/, { message: 'Postal code must be 6 digits' });
};

// Main form validation
export const creditValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.firstName, { message: 'First name is required' });
  required(path.lastName, { message: 'Last name is required' });
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });

  // Apply address validation to nested objects
  apply(path.registrationAddress, addressValidation);
  apply(path.residenceAddress, addressValidation);
};
```

### Composing Multiple Schemas

```typescript title="src/validators/credit-validators.ts"
import { apply } from 'reformer/validators';
import type { ValidationSchemaFn } from 'reformer';

interface CreditApplicationForm {
  // Basic info
  lastName: string;
  firstName: string;
  middleName: string;
  // Personal data
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  // Employment
  employmentStatus: string;
  companyName: string;
  monthlyIncome: number;
  // Contact
  phone: string;
  email: string;
}

// Separate validation schemas
const basicInfoValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Last name is required' });
  required(path.firstName, { message: 'First name is required' });
};

const personalDataValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.birthDate, { message: 'Birth date is required' });
  required(path.passportSeries, { message: 'Passport series is required' });
  required(path.passportNumber, { message: 'Passport number is required' });
};

const contactValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phone, { message: 'Phone is required' });
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
};

// Compose all validations
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  apply(path, basicInfoValidation);
  apply(path, personalDataValidation);
  apply(path, contactValidation);
};
```

## applyWhen

The `applyWhen` function applies validation only when a condition is met.

```typescript
import { applyWhen } from 'reformer/validators';

applyWhen(
  conditionField,   // Field to check for condition
  condition,        // Function that returns true when validation should apply
  validationFn      // Validation to apply when condition is true
);
```

### Basic Example: Employment Status

```typescript title="src/validators/employment-validators.ts"
import { applyWhen, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  employmentStatus: 'employed' | 'selfEmployed' | 'unemployed' | 'retired';
  companyName: string;
  companyInn: string;
  position: string;
  monthlyIncome: number;
  businessType: string;
  businessInn: string;
  businessActivity: string;
}

export const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.employmentStatus, { message: 'Employment status is required' });

  // Validate employment fields only when employed
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.companyName, { message: 'Company name is required' });
      required(path.companyInn, { message: 'Company INN is required' });
      pattern(path.companyInn, /^\d{10}$/, { message: 'Company INN must be 10 digits' });
      required(path.position, { message: 'Position is required' });
      min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
    }
  );

  // Validate business fields only when self-employed
  applyWhen(
    path.employmentStatus,
    (status) => status === 'selfEmployed',
    (path) => {
      required(path.businessType, { message: 'Business type is required' });
      required(path.businessInn, { message: 'Business INN is required' });
      pattern(path.businessInn, /^\d{10,12}$/, { message: 'Business INN must be 10-12 digits' });
      required(path.businessActivity, { message: 'Business activity is required' });
      min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
    }
  );
};
```

### Loan Type Validation

```typescript title="src/validators/loan-type-validators.ts"
import { applyWhen, required, min, max } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CreditApplicationForm {
  loanType: 'consumer' | 'mortgage' | 'car';
  loanAmount: number;
  loanTerm: number;
  // Mortgage fields
  propertyValue: number;
  initialPayment: number;
  // Car fields
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;
}

export const loanTypeValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanType, { message: 'Select loan type' });

  // Mortgage-specific validation
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (path) => {
      required(path.propertyValue, { message: 'Property value is required' });
      min(path.propertyValue, 500000, { message: 'Minimum property value is 500,000' });
      required(path.initialPayment, { message: 'Initial payment is required' });
      min(path.initialPayment, 0, { message: 'Initial payment cannot be negative' });
      min(path.loanTerm, 12, { message: 'Minimum mortgage term is 12 months' });
      max(path.loanTerm, 360, { message: 'Maximum mortgage term is 360 months' });
    }
  );

  // Car loan validation
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    (path) => {
      required(path.carBrand, { message: 'Car brand is required' });
      required(path.carModel, { message: 'Car model is required' });
      required(path.carYear, { message: 'Car year is required' });
      min(path.carYear, 2000, { message: 'Car year must be 2000 or later' });
      required(path.carPrice, { message: 'Car price is required' });
      min(path.carPrice, 100000, { message: 'Minimum car price is 100,000' });
      min(path.loanTerm, 6, { message: 'Minimum car loan term is 6 months' });
      max(path.loanTerm, 84, { message: 'Maximum car loan term is 84 months' });
    }
  );

  // Consumer loan has default term limits (handled elsewhere)
};
```

### Boolean Condition

```typescript title="src/validators/property-validators.ts"
import { applyWhen, notEmpty, validateItems, required, min, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  cadastralNumber: string;
  value: number;
  type: 'apartment' | 'house' | 'land';
}

interface CreditApplicationForm {
  hasProperty: boolean;
  properties: Property[];
}

const propertyItemValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Property address is required' });
  required(path.cadastralNumber, { message: 'Cadastral number is required' });
  pattern(path.cadastralNumber, /^\d{2}:\d{2}:\d{6,7}:\d+$/, {
    message: 'Invalid cadastral number format',
  });
  required(path.type, { message: 'Property type is required' });
  min(path.value, 100000, { message: 'Minimum property value is 100,000' });
};

export const propertyFormValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Only validate properties when hasProperty is true
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      notEmpty(path.properties, { message: 'Add at least one property' });
      validateItems(path.properties, propertyItemValidation);
    }
  );
};
```

## Combining apply and applyWhen

Use both functions together for complex validation scenarios:

```typescript title="src/validators/loan-validators.ts"
import { apply, applyWhen, required, min, max, pattern } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface MortgageFields {
  propertyValue: number;
  propertyAddress: string;
  propertyType: 'apartment' | 'house' | 'land';
}

interface CarLoanFields {
  carBrand: string;
  carModel: string;
  carYear: number;
}

interface LoanForm {
  loanType: 'mortgage' | 'car' | 'consumer';
  amount: number;
  term: number;
  // Conditional fields
  propertyValue: number;
  propertyAddress: string;
  propertyType: 'apartment' | 'house' | 'land';
  carBrand: string;
  carModel: string;
  carYear: number;
}

// Common validation
const commonValidation: ValidationSchemaFn<LoanForm> = (path) => {
  required(path.loanType, { message: 'Select loan type' });
  required(path.amount, { message: 'Amount is required' });
  min(path.amount, 10000, { message: 'Minimum loan amount is 10,000' });
  max(path.amount, 10000000, { message: 'Maximum loan amount is 10,000,000' });
  required(path.term, { message: 'Term is required' });
  min(path.term, 6, { message: 'Minimum term is 6 months' });
  max(path.term, 360, { message: 'Maximum term is 360 months' });
};

// Mortgage-specific validation
const mortgageValidation: ValidationSchemaFn<LoanForm> = (path) => {
  required(path.propertyValue, { message: 'Property value is required' });
  min(path.propertyValue, 500000, { message: 'Minimum property value is 500,000' });
  required(path.propertyAddress, { message: 'Property address is required' });
  required(path.propertyType, { message: 'Property type is required' });
};

// Car loan-specific validation
const carLoanValidation: ValidationSchemaFn<LoanForm> = (path) => {
  required(path.carBrand, { message: 'Car brand is required' });
  required(path.carModel, { message: 'Car model is required' });
  required(path.carYear, { message: 'Car year is required' });
  min(path.carYear, 2000, { message: 'Car year must be 2000 or later' });
};

// Main validation
export const loanValidation: ValidationSchemaFn<LoanForm> = (path) => {
  // Apply common validation
  apply(path, commonValidation);

  // Apply mortgage validation when loan type is mortgage
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    mortgageValidation
  );

  // Apply car loan validation when loan type is car
  applyWhen(
    path.loanType,
    (type) => type === 'car',
    carLoanValidation
  );
};
```

## Nested Conditional Validation

Handle complex nested conditions:

```typescript title="src/validators/co-borrower-validators.ts"
import { applyWhen, required, min, email, pattern, notEmpty, validateItems } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface CoBorrower {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  monthlyIncome: number;
}

interface CreditApplicationForm {
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];
  // Married-specific
  spouseFirstName: string;
  spouseLastName: string;
  spouseIncome: number;
}

const coBorrowerValidation: ValidationSchemaFn<CoBorrower> = (path: FieldPath<CoBorrower>) => {
  required(path.firstName, { message: 'First name is required' });
  required(path.lastName, { message: 'Last name is required' });
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.phone, { message: 'Phone is required' });
  pattern(path.phone, /^\+7\d{10}$/, { message: 'Phone format: +7XXXXXXXXXX' });
  min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
};

export const familyValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.maritalStatus, { message: 'Select marital status' });

  // Validate spouse info for married applicants
  applyWhen(
    path.maritalStatus,
    (status) => status === 'married',
    (path) => {
      required(path.spouseFirstName, { message: 'Spouse first name is required' });
      required(path.spouseLastName, { message: 'Spouse last name is required' });
      min(path.spouseIncome, 0, { message: 'Spouse income cannot be negative' });
    }
  );

  // Validate co-borrower info if applicable
  applyWhen(
    path.hasCoBorrower,
    (value) => value === true,
    (path) => {
      notEmpty(path.coBorrowers, { message: 'Add at least one co-borrower' });
      validateItems(path.coBorrowers, coBorrowerValidation);
    }
  );
};
```

## Credit Application Example

Complete example from a credit application:

```typescript title="src/validators/credit-application-validators.ts"
import {
  apply,
  applyWhen,
  required,
  email,
  phone,
  min,
  pattern,
  notEmpty,
  validateItems
} from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';

interface Property {
  address: string;
  value: number;
  type: string;
}

interface CreditApplicationForm {
  // Personal
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  // Employment
  employmentStatus: 'employed' | 'self-employed' | 'unemployed' | 'retired';
  companyName: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  // Property
  hasProperty: boolean;
  properties: Property[];
}

// Property item validation
const propertyValidation: ValidationSchemaFn<Property> = (path: FieldPath<Property>) => {
  required(path.address, { message: 'Address is required' });
  required(path.type, { message: 'Property type is required' });
  min(path.value, 100000, { message: 'Minimum value is 100,000' });
};

// Personal info validation
const personalValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Last name is required' });
  required(path.firstName, { message: 'First name is required' });
  required(path.email, { message: 'Email is required' });
  email(path.email, { message: 'Invalid email format' });
  required(path.phone, { message: 'Phone is required' });
  phone(path.phone, { message: 'Invalid phone format' });
};

// Employment validation (conditional)
const employmentValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Employment status is required' });

  // Employed-specific validation
  applyWhen(
    path.employmentStatus,
    (status) => status === 'employed',
    (path) => {
      required(path.companyName, { message: 'Company name is required' });
      required(path.position, { message: 'Position is required' });
      min(path.workExperienceTotal, 0, { message: 'Total experience cannot be negative' });
      min(path.workExperienceCurrent, 0, { message: 'Current experience cannot be negative' });
      min(path.monthlyIncome, 10000, { message: 'Minimum income is 10,000' });
    }
  );
};

// Main validation
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Apply section validations
  apply(path, personalValidation);
  apply(path, employmentValidation);

  // Property validation (conditional)
  applyWhen(
    path.hasProperty,
    (value) => value === true,
    (path) => {
      notEmpty(path.properties, { message: 'Add at least one property' });
      validateItems(path.properties, propertyValidation);
    }
  );
};
```

## Best Practices

### 1. Keep Condition Functions Simple

```typescript
// ✅ Simple, clear condition
applyWhen(
  path.status,
  (status) => status === 'active',
  activeValidation
);

// ❌ Complex logic in condition
applyWhen(
  path.status,
  (status) => {
    const isActive = status === 'active';
    const isPending = status === 'pending';
    return isActive || (isPending && someOtherCondition);
  },
  validation
);
```

### 2. Use apply for Code Organization

```typescript
// ✅ Organized with apply
apply(path, personalInfoValidation);
apply(path, addressValidation);
apply(path, employmentValidation);

// ❌ All validation in one large function
export const formValidation = (path) => {
  // 100+ lines of validation...
};
```

### 3. Group Related Conditional Validations

```typescript
// ✅ Related conditions grouped together
applyWhen(path.paymentType, (t) => t === 'card', cardValidation);
applyWhen(path.paymentType, (t) => t === 'bank', bankValidation);
applyWhen(path.paymentType, (t) => t === 'crypto', cryptoValidation);

// ❌ Scattered throughout the code
```

### 4. Document Complex Conditions

```typescript
// ✅ Clear intent with comments
// Validate spouse info only for married applicants
applyWhen(
  path.maritalStatus,
  (status) => status === 'married',
  spouseValidation
);

// Validate business details for self-employed with income > 100k
applyWhen(
  path.employmentStatus,
  (status) => status === 'self-employed',
  (path) => {
    // Additional validation for high-income self-employed
    applyWhen(
      path.monthlyIncome,
      (income) => income > 100000,
      detailedBusinessValidation
    );
  }
);
```

### 5. Avoid Deeply Nested Conditions

```typescript
// ✅ Flatten when possible
applyWhen(path.type, (t) => t === 'business' && form.size === 'large', largeBusinessValidation);

// ❌ Deeply nested - hard to follow
applyWhen(path.type, (t) => t === 'business', (path) => {
  applyWhen(path.size, (s) => s === 'large', (path) => {
    applyWhen(path.industry, (i) => i === 'tech', techValidation);
  });
});
```

## Next Step

Now that you understand conditional validation, let's learn about cross-field validation with `validateTree`.
