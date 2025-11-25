---
sidebar_position: 1
---

# Form Interface

Defining TypeScript interface for the Credit Application form.

## Overview

Before creating a form schema, we need to define its TypeScript interface. This ensures type safety throughout the application and helps catch errors at compile time.

## Basic Types

First, define the enumeration types used in the form:

```typescript title="src/types/credit-application.types.ts"
// Loan types
export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinancing';

// Employment status
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';

// Marital status
export type MaritalStatus = 'single' | 'married' | 'divorced' | 'widowed';

// Education level
export type EducationLevel = 'secondary' | 'specialized' | 'higher' | 'postgraduate';

// Property types
export type PropertyType = 'apartment' | 'house' | 'car' | 'land' | 'commercial' | 'other';
```

## Nested Interfaces

Complex forms often have nested structures. Define separate interfaces for reusable sections:

### Address

```typescript
export interface Address {
  region: string;
  city: string;
  street: string;
  house: string;
  apartment?: string;  // Optional field
  postalCode: string;
}
```

### Personal Data

```typescript
export interface PersonalData {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  birthPlace: string;
  gender: 'male' | 'female';
}
```

### Passport Data

```typescript
export interface PassportData {
  series: string;
  number: string;
  issueDate: string;
  issuedBy: string;
  departmentCode: string;
}
```

### Property (for arrays)

```typescript
export interface Property {
  type: PropertyType;
  description: string;
  estimatedValue: number;
  hasEncumbrance: boolean;
}
```

### Existing Loan (for arrays)

```typescript
export interface ExistingLoan {
  bank: string;
  type: string;
  amount: number;
  remainingAmount: number;
  monthlyPayment: number;
  maturityDate: string;
}
```

### Co-Borrower (for arrays)

```typescript
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
```

## Main Form Interface

Now combine everything into the main form interface:

```typescript title="src/types/credit-application.types.ts"
export interface CreditApplicationForm {
  // ============================================
  // Step 1: Basic Loan Information
  // ============================================
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;

  // Mortgage-specific fields
  propertyValue: number;
  initialPayment: number;

  // Car loan-specific fields
  carBrand: string;
  carModel: string;
  carYear: number;
  carPrice: number;

  // ============================================
  // Step 2: Personal Information
  // ============================================
  personalData: PersonalData;
  passportData: PassportData;
  inn: string;
  snils: string;

  // ============================================
  // Step 3: Contact Information
  // ============================================
  phoneMain: string;
  phoneAdditional: string;
  email: string;
  emailAdditional: string;
  registrationAddress: Address;
  sameAsRegistration: boolean;
  residenceAddress: Address;

  // ============================================
  // Step 4: Employment Information
  // ============================================
  employmentStatus: EmploymentStatus;
  companyName: string;
  companyInn: string;
  companyPhone: string;
  companyAddress: string;
  position: string;
  workExperienceTotal: number;
  workExperienceCurrent: number;
  monthlyIncome: number;
  additionalIncome: number;
  additionalIncomeSource: string;

  // Self-employed specific fields
  businessType: string;
  businessInn: string;
  businessActivity: string;

  // ============================================
  // Step 5: Additional Information
  // ============================================
  maritalStatus: MaritalStatus;
  dependents: number;
  education: EducationLevel;

  // Dynamic arrays
  hasProperty: boolean;
  properties: Property[];
  hasExistingLoans: boolean;
  existingLoans: ExistingLoan[];
  hasCoBorrower: boolean;
  coBorrowers: CoBorrower[];

  // ============================================
  // Step 6: Confirmations
  // ============================================
  agreePersonalData: boolean;
  agreeCreditHistory: boolean;
  agreeMarketing: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
  electronicSignature: string;

  // ============================================
  // Computed Fields
  // ============================================
  interestRate: number;
  monthlyPayment: number;
  fullName: string;
  age: number | null;
  totalIncome: number;
  paymentToIncomeRatio: number;
  coBorrowersIncome: number;
}
```

## Interface Organization Tips

### 1. Group Related Fields

Organize fields by form sections or logical groups. Use comments to mark sections:

```typescript
interface MyForm {
  // Personal Information
  firstName: string;
  lastName: string;

  // Contact Information
  email: string;
  phone: string;
}
```

### 2. Use Nested Objects for Complex Sections

Instead of flat structure with prefixes:

```typescript
// Avoid
interface Form {
  addressCity: string;
  addressStreet: string;
  addressHouse: string;
}
```

Use nested objects:

```typescript
// Prefer
interface Form {
  address: {
    city: string;
    street: string;
    house: string;
  };
}
```

### 3. Use Arrays for Repeating Sections

When users can add multiple items:

```typescript
interface Form {
  // Single item - object
  personalData: PersonalData;

  // Multiple items - array
  properties: Property[];
  existingLoans: ExistingLoan[];
}
```

### 4. Mark Optional Fields

Use `?` for truly optional fields:

```typescript
interface Address {
  city: string;           // Required
  apartment?: string;     // Optional
}
```

### 5. Include Computed Fields

Include computed fields in the interface even though they'll be calculated:

```typescript
interface Form {
  firstName: string;
  lastName: string;
  fullName: string;  // Computed from firstName + lastName
}
```

## Type Safety Benefits

With a properly defined interface, TypeScript will:

1. **Autocomplete field names** in your IDE
2. **Catch typos** in field names at compile time
3. **Validate field types** when setting values
4. **Provide type hints** for form values

```typescript
// TypeScript will catch this error
form.controls.emial  // Error: Property 'emial' does not exist

// Type hints when accessing values
const amount = form.value.loanAmount;  // TypeScript knows this is a number
```

## Next Steps

Now that we have the interface defined, we can create the form schema that implements this interface.
