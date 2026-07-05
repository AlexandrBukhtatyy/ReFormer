---
sidebar_position: 1
---

# Project Structure

Organize a form as a **flat module**: every concern in its own file at the module root, and a
single `index.tsx` that renders the whole form — **all steps inline**. Most files are named
flat, after the concern they own; a dot-prefix (`form.` / `renderer.`) is reserved for the
**schema** and **behavior** files, which come in a model-layer and a render-layer variant. This
is the default for every form. Reach for folders only when a form grows large enough to need
them.

:::info Default vs scale-up
The **flat minimalist** layout below is the default for _any_ form — the base is identical
across `@reformer/core`, `@reformer/renderer-react`, and `@reformer/renderer-json`; only the
schema-file format and a couple of add-ons differ. The **folder layout**
(`lib/` + `schema/` + `components/`) is a scale-up for large multi-step forms — see
[Scaling up](#scaling-up-folder-layout-for-large-forms) below. The full cross-target reference
for both is the **form-directory-layout** guide shipped with `@reformer/mcp`.
:::

## Recommended Structure (Flat)

Keep all of a form's files together in one folder, each named after the concern it owns. No
`lib/`, no `schema/`, no `components/steps/` — the fields, validation, behavior and data
sources of every step live in one file per concern, and one component file holds the whole
form.

```
forms/
└── [form-name]/                # Form module
    ├── index.tsx               # Entry + the whole form, all steps inline
    ├── types.ts                # Form interface + field enums + option types
    ├── model.ts                # createModel factory + initial values
    ├── form.schema.ts          # FormSchema tree — all fields, all steps
    ├── form.behavior.ts        # All model behavior: compute / copyFrom / enableWhen / onChange
    ├── validation.ts           # ALL validation
    ├── data-sources.ts         # Options + async loaders
    └── api.ts                  # submit + prefill
```

Rule of thumb: **one file per concern at the module root — flat-named, except the `schema` and
`behavior` files, which carry a dot-prefix (`form.` / `renderer.`); one component file
(`index.tsx`) with every step inline.**

:::note Why the dot-prefix
Only **schema** and **behavior** come in two layers — a model layer (`form.`) and a render
layer (`renderer.`) — so only they carry a dot-prefix to disambiguate the two:

- **schema** — `form.schema.ts` (core) / `renderer.schema.ts` (renderer-react) /
  `renderer.schema.json` (renderer-json).
- **behavior** — `form.behavior.ts` is the model behavior (compute / copyFrom / enableWhen /
  onChange) and ships on **every** target; `renderer.behavior.ts` is the render behavior
  (visibility / navigation / submit / data-loading) and exists on the renderer targets only.

Every other concern has a single form-wide file, so it stays flat: `types.ts`, `model.ts`,
`validation.ts`, `data-sources.ts`, `api.ts` (plus `registry.ts` on renderer-json).
:::

### Per-target differences

The base above is the same everywhere. Only the schema file's format changes, plus a small
number of add-ons:

| Target            | Schema file            | Extra files                           |
| ----------------- | ---------------------- | ------------------------------------- |
| `core` (+ ui-kit) | `form.schema.ts`       | —                                     |
| `renderer-react`  | `renderer.schema.ts`   | `renderer.behavior.ts`                |
| `renderer-json`   | `renderer.schema.json` | `renderer.behavior.ts`, `registry.ts` |

- **`form.schema.ts`** (core) — a `FormSchema` tree of `{ value, component, componentProps }`.
- **`renderer.schema.ts`** (renderer-react) — a `RenderNode` tree (data, not JSX);
  `renderer.behavior.ts` holds visibility / navigation / submit / data-loading.
- **`renderer.schema.json`** (renderer-json) — the form's JSON layout
  (`"$model(x)"` / `"$component(Name)"` / `"$dataSource(NAME)"`); `renderer.behavior.ts` is
  thin (wires form + validation into the wizard), and `registry.ts` maps the
  form-specific `$component(...)` / `$dataSource(...)` names used by the JSON.

`model.ts`, `form.behavior.ts`, `validation.ts`, `data-sources.ts` and `api.ts` are **reused
as-is** when the same form ships on another target — never duplicate model / behavior /
validation. The renderer targets add their own `renderer.behavior.ts` on top of the shared
`form.behavior.ts`.

## Key Principles

### 1. One file per concern

Each file owns exactly one concern for the **whole** form — not per step. All validators live
in `validation.ts`, all reactive rules in `form.behavior.ts`, all option dictionaries and
loaders in `data-sources.ts`. You always know which file to open.

### 2. One component, steps inline

`index.tsx` is both the entry point and the layout. It builds the form instance and renders
every step inline — there are no per-step component files to jump between in a flat module.

### 3. Data sources are their own file

Options and async loaders always live in `data-sources.ts`, in every target. Keeping them
out of the schema keeps the schema readable and lets renderer-json reference them by name.

## Key Files

### Form Types

```typescript title="forms/credit-application/types.ts"
export type LoanType = 'consumer' | 'mortgage' | 'car';

// One interface for the whole form — fields from every step
export interface CreditApplicationForm {
  // Step 1: Loan Info
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
  // Computed
  monthlyPayment: number;
  interestRate: number;
  // ... more fields from all steps
}
```

### Form Schema

```typescript title="forms/credit-application/form.schema.ts"
import type { FormModel } from '@reformer/core';
import { Input, Select, Textarea } from '@/components/ui';
import { LOAN_TYPES } from './data-sources';
import type { CreditApplicationForm } from './types';

// All fields for the whole form live here — one schema builder, all steps.
// It binds each field to a model signal; validators live in validation.ts.
export const creditApplicationSchema = (model: FormModel<CreditApplicationForm>) => ({
  loanType: {
    value: model.$.loanType,
    component: Select,
    componentProps: { label: 'Loan Type', options: LOAN_TYPES },
  },
  loanAmount: {
    value: model.$.loanAmount,
    component: Input,
    componentProps: { label: 'Loan Amount', type: 'number' },
  },
  // Computed field at form level, filled by behavior
  monthlyPayment: { value: model.$.monthlyPayment, disabled: true },
  // ... more fields
});
```

### Data Sources

```typescript title="forms/credit-application/data-sources.ts"
// Static option dictionaries and async loaders — one file, every target
export const LOAN_TYPES = [
  { value: 'consumer', label: 'Consumer' },
  { value: 'mortgage', label: 'Mortgage' },
  { value: 'car', label: 'Car Loan' },
];

export async function loadCarBrands(): Promise<{ value: string; label: string }[]> {
  const res = await fetch('/api/car-brands');
  return res.json();
}
```

### Validation

All validators for the form live in `validation.ts`. You can still keep them tidy by
grouping helpers per step **inside the one file**, then combining them:

```typescript title="forms/credit-application/validation.ts"
import { validateFormModel } from '@reformer/core';
import { required, min, max } from '@reformer/core/validators';
import type { FormModel, ModelValidator } from '@reformer/core';
import type { CreditApplicationForm } from './types';

// Grouped by step — but all in this one file. Each group returns schema nodes.
const loanValidationNodes = (model: FormModel<CreditApplicationForm>) => [
  { value: model.$.loanType, validators: [required({ message: 'Select loan type' })] },
  {
    value: model.$.loanAmount,
    validators: [
      required({ message: 'Enter loan amount' }),
      min(50000, { message: 'Minimum 50,000' }),
      max(10000000, { message: 'Maximum 10,000,000' }),
    ],
  },
  // Conditional validation for mortgage — native branch node { when, children }
  {
    when: (_scope: unknown, root: unknown) =>
      (root as CreditApplicationForm).loanType === 'mortgage',
    children: [
      { value: model.$.propertyValue, validators: [required({ message: 'Enter property value' })] },
      {
        value: model.$.initialPayment,
        validators: [required({ message: 'Enter initial payment' })],
      },
    ],
  },
];

// Cross-step rule: initial payment must be >= 20% of property value.
// A ModelValidator reads siblings through `root` (plain values, no `.value.value`).
const minInitialPayment: ModelValidator<number, unknown, CreditApplicationForm> = (
  value,
  _scope,
  root
) => {
  if (root.loanType !== 'mortgage') return null;
  if (!root.propertyValue || !value) return null;
  const minPayment = root.propertyValue * 0.2;
  return value < minPayment
    ? { code: 'minInitialPayment', message: `Minimum: ${minPayment}` }
    : null;
};

// One validation schema for the whole form — combine the per-step nodes
const creditApplicationValidationSchema = (model: FormModel<CreditApplicationForm>) => ({
  children: [
    ...loanValidationNodes(model),
    { value: model.$.initialPayment, validators: [minInitialPayment] },
  ],
});

// One exported entry point — headless validation of the whole form
export const validateCreditApplication = (model: FormModel<CreditApplicationForm>) =>
  validateFormModel(model, creditApplicationValidationSchema(model));
```

### Behavior

```typescript title="forms/credit-application/form.behavior.ts"
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
import type { CreditApplicationForm } from './types';

// All reactive rules for the whole form
export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(({ model }) => {
  // Enable mortgage fields only for mortgage type
  enableWhen([model.$.propertyValue, model.$.initialPayment], () => model.loanType === 'mortgage', {
    resetOnDisable: true,
  });

  // Compute interest rate based on loan type
  compute(model.$.interestRate, () => {
    const rates: Record<CreditApplicationForm['loanType'], number> = {
      consumer: 15,
      mortgage: 10,
      car: 12,
    };
    return rates[model.loanType] ?? 15;
  });
});
```

### Entry Component

`index.tsx` builds the form instance and renders every step inline:

```typescript title="forms/credit-application/index.tsx"
import { useMemo } from 'react';
import { createForm } from '@reformer/core';
import { creditApplicationSchema } from './form.schema';
import { creditApplicationBehavior } from './form.behavior';
import { createCreditApplicationModel } from './model';
import type { CreditApplicationForm as CreditApplicationFormType } from './types';

export function CreditApplicationForm() {
  // Create a stable model + form instance with useMemo
  const form = useMemo(() => {
    const model = createCreditApplicationModel();
    return createForm<CreditApplicationFormType>({
      model,
      schema: creditApplicationSchema(model),
      behavior: creditApplicationBehavior,
    });
  }, []);

  return (
    // ... render every step inline (loan info, personal info, confirmation, …).
    // Validation runs headlessly via validateCreditApplication(model) on step change / submit.
  );
}
```

## Scaling: Simple vs Complex Forms

### Simple Form (Single File)

For a tiny form, collapse the module to one file — schema, validation, behavior and component
together:

```
forms/
└── contact/
    └── index.tsx     # Schema, validation, behavior, component
```

### Standard Form (Flat Module)

The default. One file per concern plus `index.tsx` — the layout at the top of this
page. This is where almost every form should live.

```
forms/
└── credit-application/
    ├── index.tsx
    ├── types.ts
    ├── model.ts
    ├── form.schema.ts
    ├── form.behavior.ts
    ├── validation.ts
    ├── data-sources.ts
    └── api.ts
```

## Scaling up: folder layout for large forms

When a multi-step form gets large — many steps, several developers, reusable sub-forms — the
single-file-per-concern approach can grow unwieldy. At that point, graduate to the **folder
layout**: three folders per module and colocation by step.

:::note When to switch
Stay flat by default. Switch to folders only when the pain is real — `form.schema.ts` /
`validation.ts` have become hard to navigate, or steps have clear separate owners. The
full cross-target reference (centralized vs co-located variants, renderer-react /
renderer-json specifics) is the **form-directory-layout** guide shipped with `@reformer/mcp`.
:::

```
src/
├── components/
│   └── ui/                              # App-wide reusable UI components
│       ├── FormField.tsx                # Field wrapper component
│       ├── FormArrayManager.tsx         # Dynamic array manager
│       └── ...                          # Input, Select, Checkbox, etc.
│
├── forms/
│   └── [form-name]/                     # Form module
│       ├── [FormName]Form.tsx           # Entry component
│       ├── index.ts                     # Public re-exports of the module
│       │
│       ├── lib/                         # Domain helpers (target-agnostic)
│       │   ├── types.ts                 # Form interface + field enums + option types
│       │   ├── constants.ts             # Option dictionaries
│       │   ├── calc.ts                  # Pure fns for derived fields / transforms
│       │   └── api.ts                   # Data sources + submit
│       │
│       ├── schema/                      # Form-level definition (cross-step)
│       │   ├── model.ts                 # createModel factory + initial values
│       │   ├── behavior.ts              # Cross-step behaviors
│       │   ├── validation.ts            # Cross-step validation
│       │   └── create-form.ts           # Assembles the per-step partial schemas
│       │
│       ├── steps/                       # Step = component + its own schema/validation/behavior
│       │   ├── loan-info/
│       │   │   ├── schema.ts            # Step schema
│       │   │   ├── validation.ts        # Step validators
│       │   │   ├── behavior.ts          # Step behaviors
│       │   │   └── LoanInfoForm.tsx     # Step component
│       │   │
│       │   ├── personal-info/
│       │   │   ├── schema.ts
│       │   │   ├── validation.ts
│       │   │   ├── behavior.ts
│       │   │   └── PersonalInfoForm.tsx
│       │   │
│       │   └── confirmation/
│       │       ├── schema.ts
│       │       ├── validation.ts
│       │       └── ConfirmationForm.tsx
│       │
│       └── nested-forms/                # Reusable sub-form modules
│           ├── address/
│           │   ├── schema.ts
│           │   ├── validation.ts
│           │   └── AddressForm.tsx
│           │
│           └── personal-data/
│               ├── schema.ts
│               ├── validation.ts
│               └── PersonalDataForm.tsx
```

In the folder layout: **domain raw material → `lib/`; anything describing the form → `schema/`;
React layout → `components/`; each step and sub-form is self-contained (its own `schema` /
`validation` / `behavior` / component), while form-level rules and `create-form.ts` (which
assembles the per-step partial schemas) stay in `schema/`.**

## Best Practices

| Practice                                 | Why                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| Start flat                               | One file per concern; no premature folders                                 |
| Flat names; dot only for schema/behavior | Filenames name the concern; `form.` / `renderer.` mark the two-layer files |
| One component, steps inline              | No jumping between per-step files                                          |
| All validation in one file               | `validation.ts` is the single place to look                                |
| Data sources in their own file           | Readable schema; renderer-json can reference by name                       |
| Use `useMemo` for the form               | Stable form instance per component                                         |
| Reuse model/behavior/validation          | Same files ship across targets — never duplicate                           |
| Graduate to folders when large           | Colocation by step pays off only past a size threshold                     |

## Benefits of the Flat Module

1. **Predictability** — One file per concern; the filename tells you what's inside
2. **Fewer files** — No `lib/` / `schema/` / `steps/` ceremony for the common case
3. **Cross-target reuse** — The base is identical; only the schema file format changes
4. **Easy scale-up** — Split into folders only when a form actually needs it

## Next Steps

- [Schema Composition](/docs/core-concepts/schemas/composition) — Reusable schemas and validators
