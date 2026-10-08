## 14. PROJECT STRUCTURE (COLOCATION)

One form is one module folder. **Default layout — flat minimalist:** every concern is a single
file at the module root, and the whole form (entry + all wizard steps inline) lives in one
`index.tsx`. Naming rule: **`form.<role>` is a form artefact, the suffix names its role** —
`form.schema.*` (layout), `form.behavior.ts` (model behavior), `form.render.ts` (render-layer
behavior, renderer targets only), `form.validation.ts` (validation rules); every other file has
no prefix. The old `renderer.schema.*` / `renderer.behavior.ts` / `renderer.wizard.tsx` /
`validation.ts` names still work with a warning. No folders until the form grows (see "Scaling
up" below). Arrays are declared in `form.schema.ts` and rendered with `FormArraySection` — no
per-step component files.

```
src/
├── components/ui/                # App-wide reusable UI (FormField, FormArraySection, ...)
│
├── forms/
│   └── [form-name]/              # Form module — flat, one file per concern
│       ├── index.tsx             # entry + whole form: ONE createForm call → <FormWizard> with all steps inline; arrays via FormArraySection
│       ├── types.ts              # form type + enums + { value, label } option type + constant dictionaries
│       ├── model.ts              # createModel + initial values + empty-array-element factories
│       ├── form.schema.ts        # schema builder (model) => node tree: { model: model.$.x, component, componentProps }
│       ├── form.behavior.ts      # defineFormBehavior: compute / enableWhen / hideWhen / copyFrom / onChange
│       ├── form.validation.ts    # ALL validation → { steps, extras }
│       ├── data-sources.ts       # options + async loaders (dataSources)
│       └── api.ts                # submit + prefill/load
```

Rule of thumb: **one concern → one file at the module root; the whole component tree (all steps) →
`index.tsx`; validation is a single `form.validation.ts`.** This is the working default for
almost every form — reach for folders only when a file stops fitting on a screen.

### Key Files

```typescript
// forms/credit-application/types.ts
export type CreditApplicationForm = {
  loanType: LoanType;
  loanAmount: number | null; // an empty number input is `null`
  // ...
};

// forms/credit-application/model.ts
import { createModel, type FormModel } from '@reformer/core';
export const createCreditApplicationModel = (): FormModel<CreditApplicationForm> =>
  createModel<CreditApplicationForm>(createInitialCreditApplication());

// forms/credit-application/form.schema.ts
import type { FormModel, FormSchemaNode } from '@reformer/core';
export const creditApplicationSchema = (
  model: FormModel<CreditApplicationForm>
): FormSchemaNode => ({
  // Nested nodes live in `children` only — not in componentProps, not under arbitrary keys.
  children: [
    { model: model.$.loanType, component: SelectAsync, componentProps: { /* ... */ } }, // field
    { model: model.$.registrationAddress, part: address }, // sub-form: group + part
    { model: model.$.properties, component: FormArray, item: propertyRow }, // array of sub-forms
  ],
});

// forms/credit-application/form.behavior.ts
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(({ model }) => {
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
  enableWhen([model.$.propertyValue], () => model.loanType === 'mortgage', { resetOnDisable: true });
});

// forms/credit-application/index.tsx — entry: assembles the form, renders <FormWizard> with all steps inline
import { createForm } from '@reformer/core';
// ONE call: model + form + behavior + validation. In the page: useFormBundle(createCreditApplicationForm).
export const createCreditApplicationForm = () =>
  createForm({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,          // builder (model) => tree
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,  // { steps, extras } → bundle.validation
  });
```

### Scaling up: folders (large forms)

When the flat module gets unwieldy — a multi-step wizard, sub-forms reused across steps, rules
that outgrow one file — split it by **concern**, one folder per layer. Each layer answers one
question about the form:

| Folder         | Question it answers                                     |
| -------------- | ------------------------------------------------------- |
| `model/`       | What data does the form hold, and what does it start as |
| `schema/`      | How is the form laid out                                |
| `validation/`  | What is a valid value                                   |
| `behavior/`    | How do values and field state react to each other       |
| `flow/`        | Which steps does the user walk through, in what order   |
| `application/` | How is the form assembled, loaded and submitted         |

```
forms/
└── [form-name]/
    ├── [FormName]Form.tsx           # Entry: builds the form, renders FormWizard + step components
    │
    ├── model/
    │   ├── model.ts                 # create[FormName]Model — the reactive model
    │   ├── initial-value.ts         # initial values; arrays via arrayOf(blank)
    │   ├── predicates.ts            # conditions shared by behavior, validation and JSX
    │   └── factories/               # blank values of sub-forms and array rows
    │       ├── address.ts
    │       └── property.ts
    │
    ├── schema/
    │   ├── form.ts                  # the tree: loading → wizard → steps taken from the flow
    │   ├── steps/                   # content of each step (an array of nodes)
    │   │   ├── loan.ts
    │   │   └── contacts.ts
    │   └── sections/                # sections, sub-forms (part) and array rows (item)
    │       ├── address.ts
    │       └── property.ts
    │
    ├── validation/
    │   ├── form.ts                  # FormValidation: { steps, extras } built from the flow
    │   ├── common/                  # shared rule sets, rules of sub-forms and array rows
    │   │   ├── rules.ts
    │   │   └── address.ts
    │   ├── loan.ts                  # rules of one step — one file per step
    │   ├── contacts.ts
    │   └── cross-step.ts            # rules of the whole form (checked on submit)
    │
    ├── behavior/
    │   ├── index.ts                 # the form behavior, composed of the parts below
    │   ├── derived.ts               # computed fields
    │   ├── conditions.ts            # enabling fields and hiding sections
    │   ├── synchronization.ts       # copies, clearing lists
    │   ├── dynamic-options.ts       # options and limits that depend on values
    │   └── operators.ts             # custom operators built on the built-in ones
    │
    ├── flow/
    │   └── [form-name]-flow.ts      # the list of steps: selector, title, icon, content, rules
    │
    ├── application/
    │   ├── create.ts                # ONE createForm call shared by every way of rendering
    │   ├── load.ts                  # network: fetch the entity and dictionaries
    │   ├── mapping.ts               # server response → model (model.patch + captureInitial)
    │   ├── submit.ts                # sending and reporting the outcome
    │   └── renderer.ts              # node rules for the renderer: loading, submit, navigation
    │
    ├── components/                  # React layout: steps/, nested-forms/, ui/
    ├── api/                         # HTTP calls
    └── types/  constants/  utils/   # form type, option dictionaries, pure calculations
```

Dependencies point one way: `application → flow → schema/steps, validation/<step>`;
`application → behavior → model`. Nothing below `application/` knows the entity id, the network or
the wizard — the behavior is static and reusable.

**The flow is the single place a step is declared.** One entry carries the step's `selector`,
title, icon, content and rules, so the step nodes of the schema, `validation.steps` and the wizard
steps of a hand-written React page are all derived from the same list — there is nowhere to pair
the layout of one step with the rules of another:

```typescript
// flow/credit-application-flow.ts
export const creditApplicationFlow = [
  { selector: 'loan', title: 'Loan', icon: '💰', content: loanStep, rules: loanRules },
  { selector: 'contacts', title: 'Contacts', icon: '📞', content: contactsStep, rules: contactsRules },
] as const satisfies readonly FlowStep[];

// schema/form.ts — step nodes come from the flow
children: creditApplicationFlow.map((step) => ({
  selector: step.selector,
  component: Step,
  componentProps: { title: step.title, icon: step.icon },
  children: step.content(model),
})),

// validation/form.ts — so do the rules; the key is the step selector
export const creditApplicationValidation: FormValidation<CreditApplicationForm> = {
  steps: Object.fromEntries(creditApplicationFlow.map((step) => [step.selector, step.rules])),
  extras: crossStepRules,
};
```

**Conditions live in `model/predicates.ts`** as pure functions over values
(`isMortgage(loanType)`). Behavior (`enableWhen`, `hideWhen`), validation (`validateWhen`) and the
JSX of a step call the same function — a condition is written once.

**Loading and submitting are not behavior.** They belong to `application/`: the page (or, for the
renderer, `application/renderer.ts` passed as `setup`) calls `load`, hands the response to
`mapping`, and calls `submit`. Written into the model with `model.patch` followed by
`model.captureInitial()`, the loaded values become the form's starting point: the form is not
dirty, and `model.reset()` returns to them.

Rule of thumb for this layout: **one folder per question; a step is declared once, in the flow;
the root holds only the entry component.**

### Scaling

| Complexity | Structure |
| ---------- | --------------------------------------------------------------------------------------- |
| Simple | Single file: `index.tsx` (model + schema + behavior + component) |
| **Minimalist (flat)** | **Default.** One file per concern at the module root (`types` / `model` / `form.schema` / `form.behavior` / `form.validation` / `data-sources` / `api`) + `index.tsx` with all steps inline |
| Folders (`model/` + `schema/` + `validation/` + `behavior/` + `flow/` + `application/`) | Large forms: one folder per layer, a step declared once in the flow, reusable sections and rules |

> The leading layout of the MCP generators is configurable: set `REFORMER_FORM_LAYOUT`
> (`minimalist` | `folders`) when registering the MCP server. Default is `minimalist`.

> The MCP layout check (`validate_form` with `kind: "layout"`), the generators and the
> **form-directory-layout** guide (`find_recipe directory-layout`) still describe the previous
> folder layout (`lib/` + `schema/` + `components/`) and report the layout above as drift until
> they are updated. Cross-target variants (renderer-react `form.schema.ts` + `form.render.ts` /
> renderer-json `form.schema.ts` + `form.render.ts` + `registry.ts`) are described in that guide.
