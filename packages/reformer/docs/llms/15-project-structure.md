## 14. PROJECT STRUCTURE (COLOCATION)

One form is one module folder. **Default layout — flat minimalist:** every concern is a single
file at the module root, and the whole form (entry + all wizard steps inline) lives in one
`index.tsx`. Filenames are flat with no prefix — **the dot-prefix (`form.` / `renderer.`) is
carried only by `schema` and `behavior`**, the two concerns that have both a model-layer and a
render-layer version (`form.schema.ts` / `form.behavior.ts` here; renderer slices add
`renderer.schema.*` / `renderer.behavior.ts`). No `lib/` / `schema/` / `components/steps/`
nesting until the form grows (see "Scaling up" below). Arrays are declared in `form.schema.ts`
and rendered with `FormArraySection` — no per-step component files.

```
src/
├── components/ui/                # App-wide reusable UI (FormField, FormArraySection, ...)
│
├── forms/
│   └── [form-name]/              # Form module — flat, one file per concern
│       ├── index.tsx             # entry + whole form: createModel→createForm→<FormWizard> with all steps inline; arrays via FormArraySection
│       ├── types.ts              # form type + enums + { value, label } option type + constant dictionaries
│       ├── model.ts              # createModel + initial values + empty-array-element factories
│       ├── form.schema.ts        # FormSchema: { value: model.$.x, component, componentProps }
│       ├── form.behavior.ts      # defineFormBehavior: compute / enableWhen / hideWhen / copyFrom / onChange
│       ├── validation.ts         # ALL validation → { validateStep, validateAll }
│       ├── data-sources.ts       # options + async loaders (dataSources)
│       └── api.ts                # submit + prefill/load
```

Rule of thumb: **one concern → one file at the module root; the whole component tree (all steps) →
`index.tsx`; validation is a single `validation.ts`.** This is the working default for
almost every form — reach for folders only when a file stops fitting on a screen.

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

// forms/credit-application/form.schema.ts
import type { FormModel } from '@reformer/core';
export const creditApplicationSchema = (model: FormModel<CreditApplicationForm>) => ({
  loanType: { value: model.$.loanType, component: Select, componentProps: { /* ... */ } },
  personalData: personalDataNodes(model.$.personalData),
  properties: { array: model.properties, item: propertyItem },
});

// forms/credit-application/form.behavior.ts
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(({ model }) => {
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
  enableWhen([model.$.propertyValue], () => model.loanType === 'mortgage', { resetOnDisable: true });
});

// forms/credit-application/index.tsx — entry: assembles the form, renders <FormWizard> with all steps inline
import { createForm } from '@reformer/core';
export const createCreditApplicationForm = () => {
  const model = createCreditApplicationModel();
  return createForm({ model, schema: creditApplicationSchema(model), behavior: creditApplicationBehavior });
};
```

### Scaling up: folders (large forms)

When the flat module gets unwieldy — steps you want in their own files, sub-forms reused across
steps, calc/validators that outgrow one file — promote it to a three-folder module: `lib/`
(domain raw material), `schema/` (the form definition), `components/` (React layout), plus the
entry component and `index.ts`. Keep the module root to just the entry + `index.ts`; everything
else lives in a folder.

```
forms/
└── [form-name]/                  # Form module — folders (scale-up)
    ├── [FormName]Form.tsx        # Entry: builds model+form, renders FormWizard + step components
    ├── index.ts                  # Public re-exports of the module
    │
    ├── lib/                      # Domain helpers (target-agnostic)
    │   ├── types.ts             # Form interface + field enums + { value, label } option type
    │   ├── constants.ts         # Option dictionaries (LOAN_TYPES, GENDERS, ...)
    │   ├── calc.ts              # Pure fns for derived fields (age, monthlyPayment, ...)
    │   ├── custom-validators.ts # Reusable validator factories
    │   └── api.ts               # Data sources + submit
    │
    ├── schema/                   # The form definition
    │   ├── model.ts             # createModel factory + initial values + array-element factories
    │   ├── schema.ts            # createForm schema tree ({ value: model.$.x, component })
    │   ├── validation.ts        # defineValidationSchema + validateModel config ({ validateStep, validateAll })
    │   ├── behavior.ts          # defineFormBehavior(...)
    │   └── create-form.ts       # Assembly: createForm({ model, schema, behavior })
    │
    └── components/
        ├── steps/               # One component per wizard step
        ├── nested-forms/        # Reusable sub-forms (Address, PersonalData, ...)
        └── ui/                  # Form-specific helper blocks (summary, warnings, sections)
```

Rule of thumb for this layout: **domain raw material → `lib/`; anything describing the form →
`schema/`; React layout → `components/`; root = entry + `index.ts`.** In very large forms you
may co-locate each step's `schema.ts` / `validation.ts` / `behavior.ts` inside its
`steps/[Step]/` folder, keeping only the shared `model` and cross-step rules in `schema/` — see
the guide below.

### Scaling

| Complexity | Structure |
| ---------- | --------------------------------------------------------------------------------------- |
| Simple | Single file: `index.tsx` (model + schema + behavior + component) |
| **Minimalist (flat)** | **Default.** One file per concern at the module root (`types` / `model` / `form.schema` / `form.behavior` / `validation` / `data-sources` / `api`) + `index.tsx` with all steps inline |
| Folders (`lib/` + `schema/` + `components/`) | Large forms: split concerns into folders, one component per step, reusable `nested-forms/` |

> The leading layout is configurable: set `REFORMER_FORM_LAYOUT` (`minimalist` | `folders`)
> when registering the MCP server to choose which structure the generators lead with. Default
> is `minimalist`.

> Cross-target variants (renderer-react `renderer.schema.ts` + `renderer.behavior.ts` /
> renderer-json `renderer.schema.json` + `renderer.behavior.ts` + `registry.ts`), the
> centralized-vs-co-located choice, and the full reuse map live in the
> **form-directory-layout** guide (`@reformer/mcp`).
