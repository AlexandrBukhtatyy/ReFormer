## 14. PROJECT STRUCTURE (COLOCATION)

```
src/
├── components/ui/                    # Reusable UI components
│   ├── FormField.tsx
│   └── FormArrayManager.tsx
│
├── forms/
│   └── [form-name]/                  # Form module
│       ├── type.ts                   # Main form type
│       ├── schema.ts                 # Main schema
│       ├── validators.ts             # Validators
│       ├── behaviors.ts              # Behaviors
│       ├── [FormName]Form.tsx        # Main component
│       │
│       ├── steps/                    # Multi-step wizard
│       │   ├── loan-info/
│       │   │   ├── type.ts
│       │   │   ├── schema.ts
│       │   │   ├── validators.ts
│       │   │   ├── behaviors.ts
│       │   │   └── LoanInfoForm.tsx
│       │   └── ...
│       │
│       └── sub-forms/                # Reusable sub-forms
│           ├── address/
│           └── personal-data/
```

### Key Files

```typescript
// forms/credit-application/type.ts
export type { LoanInfoStep } from './steps/loan-info/type';
export interface CreditApplicationForm {
  loanType: LoanType;
  loanAmount: number;
  // ...
}

// forms/credit-application/schema.ts
import { loanInfoSchema } from './steps/loan-info/schema';
export const creditApplicationSchema = {
  ...loanInfoSchema,
  monthlyPayment: { value: 0, disabled: true },
};

// forms/credit-application/validators.ts
import { loanValidation } from './steps/loan-info/validators';
export const creditApplicationValidation: ValidationSchemaFn<Form> = (path) => {
  loanValidation(path);
  // Cross-step validation...
};
```

### Scaling

| Complexity | Structure                                                           |
| ---------- | ------------------------------------------------------------------- |
| Simple     | Single file: `ContactForm.tsx`                                      |
| Medium     | Separate files: `type.ts`, `schema.ts`, `validators.ts`, `Form.tsx` |
| Complex    | Full colocation with `steps/` and `sub-forms/`                      |
