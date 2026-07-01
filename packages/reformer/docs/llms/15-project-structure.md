## 14. PROJECT STRUCTURE (COLOCATION)

```
src/
├── components/ui/                    # Reusable UI components
│   ├── FormField.tsx
│   └── FormArraySection.tsx
│
├── forms/
│   └── [form-name]/                  # Form module
│       ├── types.ts                  # Form data type (type-alias)
│       ├── model.ts                  # createModel factory + initial values
│       ├── schema.ts                 # createForm schema (value: model.$.x)
│       ├── validation.ts             # validation schema + validateFormModel config
│       ├── behavior.ts               # defineFormBehavior(...)
│       ├── [FormName]Form.tsx        # Main component
│       │
│       ├── steps/                    # Multi-step wizard
│       │   └── loan-info/
│       │       └── LoanInfoForm.tsx
│       │
│       └── nested-forms/             # Reusable sub-forms (Address, PersonalData, ...)
```

### Key Files

```typescript
// forms/credit-application/types.ts
export type CreditApplicationForm = {
  loanType: LoanType;
  loanAmount: number | null;
  // ...
};

// forms/credit-application/model.ts
import { createModel, type FormModel } from '@reformer/core';
export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>(createInitialCreditApplication());

// forms/credit-application/schema.ts
import type { FormModel } from '@reformer/core';
export const creditApplicationSchema = (model: FormModel<CreditApplicationForm>) => ({
  loanType: { value: model.$.loanType, component: Select, componentProps: { /* ... */ } },
  personalData: personalDataNodes(model.$.personalData),
  properties: { array: model.properties, item: propertyItem },
});

// forms/credit-application/behavior.ts
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(({ model }) => {
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
  enableWhen([model.$.propertyValue], () => model.loanType === 'mortgage', { resetOnDisable: true });
});

// forms/credit-application/create-form.ts — сборка
import { createForm } from '@reformer/core';
export const createCreditApplicationForm = () => {
  const model = createCreditApplicationModel();
  return createForm({ model, schema: creditApplicationSchema(model), behavior: creditApplicationBehavior });
};
```

### Scaling

| Complexity | Structure                                                                    |
| ---------- | ---------------------------------------------------------------------------- |
| Simple     | Single file: `ContactForm.tsx` (model + schema + component)                  |
| Medium     | Separate files: `types.ts`, `model.ts`, `schema.ts`, `validation.ts`, `Form.tsx` |
| Complex    | Full colocation with `steps/`, `nested-forms/`, `behavior.ts`               |
