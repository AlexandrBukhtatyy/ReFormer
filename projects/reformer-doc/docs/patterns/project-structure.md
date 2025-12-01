---
sidebar_position: 1
---

# Project Structure

Organize your forms for scalability and maintainability using **colocation** — keeping related files together.

## Recommended Structure (Colocation)

```
src/
├── components/
│   └── ui/                              # Reusable UI components
│       ├── FormField.tsx                # Field wrapper component
│       ├── FormArrayManager.tsx         # Dynamic array manager
│       └── ...                          # Input, Select, Checkbox, etc.
│
├── forms/
│   └── [form-name]/                     # Form module
│       ├── type.ts                      # Main form type (combines step types)
│       ├── schema.ts                    # Main schema (combines step schemas)
│       ├── validators.ts                # Validators (steps + cross-step)
│       ├── behaviors.ts                 # Behaviors (steps + cross-step)
│       ├── [FormName]Form.tsx           # Main form component
│       │
│       ├── steps/                       # Step modules (wizard)
│       │   ├── loan-info/
│       │   │   ├── type.ts              # Step-specific types
│       │   │   ├── schema.ts            # Step schema
│       │   │   ├── validators.ts        # Step validators
│       │   │   ├── behaviors.ts         # Step behaviors
│       │   │   └── BasicInfoForm.tsx    # Step component
│       │   │
│       │   ├── personal-info/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   ├── behaviors.ts
│       │   │   └── PersonalInfoForm.tsx
│       │   │
│       │   └── confirmation/
│       │       ├── type.ts
│       │       ├── schema.ts
│       │       ├── validators.ts
│       │       └── ConfirmationForm.tsx
│       │
│       ├── sub-forms/                   # Reusable sub-form modules
│       │   ├── address/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   └── AddressForm.tsx
│       │   │
│       │   └── personal-data/
│       │       ├── type.ts
│       │       ├── schema.ts
│       │       ├── validators.ts
│       │       └── PersonalDataForm.tsx
│       │
│       ├── services/                    # API services
│       │   └── api.ts
│       │
│       └── utils/                       # Form utilities
│           └── formTransformers.ts
│
└── lib/                                 # Shared utilities
```

## Key Principles

### 1. Colocation

Each form step and sub-form is self-contained with its own:
- `type.ts` — TypeScript interface
- `schema.ts` — Form schema with field configurations
- `validators.ts` — Validation rules
- `behaviors.ts` — Computed fields, conditional logic
- `*Form.tsx` — React component

### 2. Root Aggregators

Root-level files combine all step modules:

```typescript title="forms/credit-application/type.ts"
// Re-export types from steps and sub-forms
export type { LoanInfoStep } from './steps/loan-info/type';
export type { PersonalInfoStep } from './steps/personal-info/type';
export type { Address } from './sub-forms/address/type';

// Main form interface
export interface CreditApplicationForm {
  // Step 1: Loan Info
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  // ... more fields from all steps
}
```

```typescript title="forms/credit-application/schema.ts"
import { loanInfoSchema } from './steps/loan-info/schema';
import { personalInfoSchema } from './steps/personal-info/schema';

export const creditApplicationSchema = {
  ...loanInfoSchema,
  ...personalInfoSchema,
  // Computed fields at root level
  monthlyPayment: { value: 0, disabled: true },
};
```

## Key Files

### Step Type

```typescript title="forms/credit-application/steps/loan-info/type.ts"
export type LoanType = 'consumer' | 'mortgage' | 'car';

export interface LoanInfoStep {
  loanType: LoanType;
  loanAmount: number;
  loanTerm: number;
  loanPurpose: string;
  // Mortgage-specific
  propertyValue: number;
  initialPayment: number;
  // Car-specific
  carBrand: string;
  carModel: string;
}
```

### Step Schema

```typescript title="forms/credit-application/steps/loan-info/schema.ts"
import type { FormSchema } from 'reformer';
import { Input, Select, Textarea } from '@/components/ui';
import type { LoanInfoStep } from './type';

export const loanInfoSchema: FormSchema<LoanInfoStep> = {
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Loan Type',
      options: [
        { value: 'consumer', label: 'Consumer' },
        { value: 'mortgage', label: 'Mortgage' },
        { value: 'car', label: 'Car Loan' },
      ],
    },
  },
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Loan Amount', type: 'number' },
  },
  // ... more fields
};
```

### Step Validators

```typescript title="forms/credit-application/steps/loan-info/validators.ts"
import { required, min, max, applyWhen } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

export const loanValidation: ValidationSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  required(path.loanType, { message: 'Select loan type' });
  required(path.loanAmount, { message: 'Enter loan amount' });
  min(path.loanAmount, 50000, { message: 'Minimum 50,000' });
  max(path.loanAmount, 10000000, { message: 'Maximum 10,000,000' });

  // Conditional validation for mortgage
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      required(p.propertyValue, { message: 'Enter property value' });
      required(p.initialPayment, { message: 'Enter initial payment' });
    }
  );
};
```

### Step Behaviors

```typescript title="forms/credit-application/steps/loan-info/behaviors.ts"
import { computeFrom, enableWhen, disableWhen } from 'reformer/behaviors';
import type { BehaviorSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from '../../type';

export const loanBehaviorSchema: BehaviorSchemaFn<CreditApplicationForm> = (
  path: FieldPath<CreditApplicationForm>
) => {
  // Show mortgage fields only for mortgage type
  enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
  enableWhen(path.initialPayment, (form) => form.loanType === 'mortgage');

  // Compute interest rate based on loan type
  computeFrom([path.loanType], path.interestRate, (values) => {
    const rates = { consumer: 15, mortgage: 10, car: 12 };
    return rates[values.loanType] || 15;
  });
};
```

### Root Validators (Cross-Step)

```typescript title="forms/credit-application/validators.ts"
import { validate } from 'reformer/validators';
import type { ValidationSchemaFn, FieldPath } from 'reformer';
import type { CreditApplicationForm } from './type';

// Import step validators
import { loanValidation } from './steps/loan-info/validators';
import { personalValidation } from './steps/personal-info/validators';

// Cross-step validation
const crossStepValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  // Initial payment must be >= 20% of property value
  validate(path.initialPayment, (value, ctx) => {
    if (ctx.form.loanType.value.value !== 'mortgage') return null;
    const propertyValue = ctx.form.propertyValue.value.value;
    if (!propertyValue || !value) return null;
    const minPayment = propertyValue * 0.2;
    if (value < minPayment) {
      return { code: 'minInitialPayment', message: `Minimum: ${minPayment}` };
    }
    return null;
  });
};

// Combine all validators
export const creditApplicationValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  loanValidation(path);
  personalValidation(path);
  crossStepValidation(path);
};
```

### Main Form Component

```typescript title="forms/credit-application/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createForm } from 'reformer';
import { creditApplicationSchema } from './schema';
import { creditApplicationBehaviors } from './behaviors';
import { creditApplicationValidation } from './validators';
import type { CreditApplicationForm as CreditApplicationFormType } from './type';

function CreditApplicationForm() {
  // Create form instance with useMemo for stable reference
  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  return (
    // ... render form steps
  );
}
```

## Scaling: Simple vs Complex Forms

### Simple Form (Single File)

For small forms, keep everything in one file:

```
forms/
└── contact/
    └── ContactForm.tsx     # Schema, validation, behaviors, component
```

### Medium Form (Separated Files)

Split into dedicated files:

```
forms/
└── registration/
    ├── type.ts
    ├── schema.ts
    ├── validators.ts
    ├── behaviors.ts
    └── RegistrationForm.tsx
```

### Complex Multi-Step Form (Full Colocation)

Use the complete recommended structure:

```
forms/
└── credit-application/
    ├── type.ts
    ├── schema.ts
    ├── validators.ts
    ├── behaviors.ts
    ├── CreditApplicationForm.tsx
    ├── steps/
    │   ├── loan-info/
    │   ├── personal-info/
    │   ├── contact-info/
    │   ├── employment/
    │   ├── additional-info/
    │   └── confirmation/
    ├── sub-forms/
    │   ├── address/
    │   ├── personal-data/
    │   ├── passport-data/
    │   ├── property/
    │   ├── existing-loan/
    │   └── co-borrower/
    ├── services/
    │   └── api.ts
    └── utils/
        └── formTransformers.ts
```

## Best Practices

| Practice | Why |
|----------|-----|
| Colocation | Related files together, easy navigation |
| Group by feature, not type | Find all step files in one place |
| Use useMemo for form | Stable form instance per component |
| Split validators by step | Validate only current step |
| Root aggregators | Single entry point for schema/validators/behaviors |
| Extract sub-forms | Reuse address, personal data across forms |

## Benefits of Colocation

1. **Discoverability** — All related files in one folder
2. **Maintainability** — Change one step without affecting others
3. **Refactoring** — Move/rename entire step folders
4. **Code Splitting** — Import only needed step validators
5. **Team Collaboration** — Different team members work on different steps

## Next Steps

- [Schema Composition](/docs/core-concepts/schemas/composition) — Reusable schemas and validators
