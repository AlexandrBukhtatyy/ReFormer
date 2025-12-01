---
sidebar_position: 1
---

# Project Structure

Organize your forms for scalability and maintainability.

## Recommended Structure

```
src/
├── components/
│   └── ui/                           # Reusable UI components
│       ├── FormField.tsx             # Field wrapper component
│       ├── FormArrayManager.tsx      # Dynamic array manager
│       └── ...                       # Input, Select, Checkbox, etc.
│
├── forms/
│   └── [form-name]/                  # Form module
│       ├── [FormName]Form.tsx        # Main form component
│       ├── create[FormName]Form.ts   # Form factory function
│       │
│       ├── types/                    # TypeScript types
│       │   └── [form-name].types.ts
│       │
│       ├── schemas/                  # Form schemas
│       │   ├── [form-name].ts        # Main schema (composes others)
│       │   └── [reusable].ts         # Reusable sub-schemas
│       │
│       ├── validators/               # Validation rules
│       │   ├── [form-name].ts        # Full form validation
│       │   └── [step-name].ts        # Step-specific validation
│       │
│       ├── behaviors/                # Form behaviors
│       │   ├── [form-name].behaviors.ts  # Main behaviors
│       │   └── [step-name].ts        # Step-specific behaviors
│       │
│       ├── steps/                    # Step components (wizard)
│       │   ├── Step1Form.tsx
│       │   └── Step2Form.tsx
│       │
│       └── sub-forms/                # Reusable sub-form components
│           ├── AddressForm.tsx
│           └── PersonForm.tsx
│
└── lib/                              # Shared utilities
```

## Key Files

### Form Factory

Creates the form instance with schema, validation, and behaviors:

```typescript title="forms/credit-application/createCreditApplicationForm.ts"
import { GroupNode } from 'reformer';
import { creditApplicationSchema } from './schemas/credit-application';
import { creditApplicationValidation } from './validators/credit-application';
import { creditApplicationBehaviors } from './behaviors/credit-application.behaviors';
import type { CreditApplication } from './types/credit-application.types';

export function createCreditApplicationForm() {
  return new GroupNode<CreditApplication>({
    form: creditApplicationSchema,
    validation: creditApplicationValidation,
    behavior: creditApplicationBehaviors,
  });
}
```

### Main Schema

Composes reusable sub-schemas:

```typescript title="forms/credit-application/schemas/credit-application.ts"
import { addressSchema } from './address';
import { personalDataSchema } from './personal-data';

export const creditApplicationSchema = {
  loanAmount: { value: 0 },
  loanTerm: { value: 12 },

  // Reusable schemas
  personalData: personalDataSchema,
  registrationAddress: addressSchema,
  residenceAddress: addressSchema,

  // Arrays
  properties: [propertySchema],
};
```

### Step Validators

Organize validation by form steps:

```typescript title="forms/credit-application/validators/loan-info.ts"
import { FieldPath } from 'reformer';
import { required, min, max } from 'reformer/validators';
import type { CreditApplication } from '../types/credit-application.types';

export function loanInfoValidation(path: FieldPath<CreditApplication>) {
  required(path.loanAmount);
  min(path.loanAmount, 50000);
  max(path.loanAmount, 10000000);

  required(path.loanTerm);
  min(path.loanTerm, 6);
  max(path.loanTerm, 360);
}
```

### Step Behaviors

Organize behaviors by form steps:

```typescript title="forms/credit-application/behaviors/loan-info.ts"
import { FieldPath } from 'reformer';
import { computeFrom, enableWhen } from 'reformer/behaviors';
import type { CreditApplication } from '../types/credit-application.types';

export function loanInfoBehaviors(path: FieldPath<CreditApplication>) {
  // Compute monthly payment
  computeFrom(
    [path.loanAmount, path.loanTerm, path.interestRate],
    path.monthlyPayment,
    ({ loanAmount, loanTerm, interestRate }) => {
      const monthlyRate = interestRate / 100 / 12;
      return (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -loanTerm));
    }
  );

  // Show car fields only for auto loans
  enableWhen(path.carInfo, (form) => form.loanType === 'auto');
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

```typescript title="forms/contact/ContactForm.tsx"
import { GroupNode } from 'reformer';
import { required, email } from 'reformer/validators';

interface ContactForm {
  name: string;
  email: string;
  message: string;
}

const form = new GroupNode<ContactForm>({
  form: {
    name: { value: '' },
    email: { value: '' },
    message: { value: '' },
  },
  validation: (path) => {
    required(path.name);
    required(path.email);
    email(path.email);
    required(path.message);
  },
});

export function ContactForm() {
  // Component implementation
}
```

### Medium Form (Separated Files)

Split schema, validation, and behaviors:

```
forms/
└── registration/
    ├── RegistrationForm.tsx
    ├── schema.ts
    ├── validation.ts
    └── behaviors.ts
```

### Complex Multi-Step Form (Full Structure)

Use the complete recommended structure:

```
forms/
└── credit-application/
    ├── CreditApplicationForm.tsx
    ├── createCreditApplicationForm.ts
    ├── types/
    ├── schemas/
    ├── validators/
    ├── behaviors/
    ├── steps/
    └── sub-forms/
```

## Best Practices

| Practice | Why |
|----------|-----|
| Group by form, not by type | Easier to find related files |
| Use factory functions | Fresh form instance each time |
| Split validators by step | Validate only current step |
| Extract reusable schemas | DRY, consistent validation |
| Separate sub-form components | Reusable across steps |

## Next Steps

- [Schema Composition](/docs/core-concepts/schemas/composition) — Reusable schemas and validators
