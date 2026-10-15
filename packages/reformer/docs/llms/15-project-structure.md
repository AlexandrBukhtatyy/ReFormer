## 14. PROJECT STRUCTURE (COLOCATION)

One form is one module folder. **Default layout — flat minimalist:** every concern is a single
file at the module root, and the whole form (entry + all wizard steps inline) lives in one
`index.tsx`. Naming rule: **`form.<role>` is a form artefact, the suffix names its role** —
`form.schema.*` (layout), `form.behavior.ts` (form behavior: model operators AND schema-node rules
such as `hideWhen` / `onComponentEvent`), `form.validation.ts` (validation rules), and the optional
`form.flow.ts` (the steps of a wizard) and `form.messages.ts` (the issue-message dictionary); every
other file has no prefix. There is one behavior per form:
the former render-layer file `form.render.ts` (and `renderer.behavior.ts`) is retired — its node
rules move into `form.behavior.ts`. The old `renderer.schema.*` / `validation.ts` names, and the
retired `form.render.ts` / `wizard.tsx` / `renderer.wizard.tsx`, are accepted with a warning. No
folders until the form grows (see "Scaling up" below). Arrays are declared in `form.schema.ts` and
rendered with `FieldArray` / `FieldArraySection` — no per-step component files.

```
src/
├── components/ui/                # App-wide reusable UI (FormField, FieldArraySection, ...)
│
├── forms/
│   └── [form-name]/              # Form module — flat, one file per concern
│       ├── index.tsx             # entry + whole form: ONE createForm call → <FormWizard flow={bundle.flow}> with all steps inline
│       ├── types.ts              # form type (interface or type) + enums + { value, label } option type + constant dictionaries
│       ├── model.ts              # createModel + initial values + arrayOf(blank) templates of array rows
│       ├── form.schema.ts        # schema builder (model) => node tree: { model: model.$.x, component, componentProps }
│       ├── form.behavior.ts      # defineFormBehavior: compute / enableWhen / copyFrom / onChange + hideWhen / onComponentEvent
│       ├── form.validation.ts    # rules of each step (exported) + extras
│       ├── form.flow.ts          # optional, wizard: flow { steps: [{ id, rules }] }
│       ├── form.messages.ts      # optional: defineIssueMessages dictionary (issue texts by code)
│       ├── data-sources.ts       # options + async loaders (dataSources)
│       └── api.ts                # submit + prefill/load
```

Optionally a wizard may keep its steps in folders: `steps/index.ts` (step order) and one
`steps/<slug>/` folder per step (`<slug>` — kebab-case of the step title, no number) with the same
file names — `form.schema.ts`, `form.validation.ts`, `form.behavior.ts` — for the step only;
everything that crosses steps stays in the root files.

Rule of thumb: **one concern → one file at the module root; the whole component tree (all steps) →
`index.tsx`; validation rules are a single `form.validation.ts`, the steps — `form.flow.ts`.** This is the working default for
almost every form — reach for folders only when a file stops fitting on a screen.

### Key Files

```typescript
// forms/credit-application/types.ts — `interface` and `type` both work
export interface CreditApplication {
  loanType: LoanType;
  loanAmount: number | null; // an empty number input is `null`
  // ...
}
// computed fields (targets of `compute`) — a separate type; the form is the intersection
export interface CreditApplicationDerived {
  monthlyPayment: number;
  // ...
}
export type CreditApplicationForm = CreditApplication & CreditApplicationDerived;

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
    { model: model.$.properties, component: FieldArray, item: propertyRow }, // array of sub-forms
  ],
});

// forms/credit-application/form.behavior.ts — ONE behavior: model operators and node rules
import { defineFormBehavior, compute, enableWhen, hideWhen } from '@reformer/core/behaviors';
export const creditApplicationBehavior = defineFormBehavior<CreditApplicationForm>(
  ({ model, schema }) => {
    compute(model.$.monthlyPayment, () => computeMonthlyPayment(model));
    enableWhen([model.$.propertyValue], () => model.loanType === 'mortgage', { resetOnDisable: true });
    hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage'); // executed by the renderer
  }
);

// forms/credit-application/form.validation.ts — step rules (exported) and the extras
import type { FormValidation } from '@reformer/core';
import { defineValidation } from '@reformer/core/validation';
export const loanRules = defineValidation<CreditApplicationForm>(({ model }) => { /* ... */ });
export const contactsRules = defineValidation<CreditApplicationForm>(({ model }) => { /* ... */ });
export const creditApplicationValidation: FormValidation<CreditApplicationForm> = {
  extras: crossStepRules, // checked only as a whole (submit)
};

// forms/credit-application/form.flow.ts — the steps of the wizard
import type { FormFlowConfig } from '@reformer/core';
import { loanRules, contactsRules } from './form.validation';
export const creditApplicationFlow: FormFlowConfig<CreditApplicationForm> = {
  steps: [
    { id: 'loan', rules: loanRules }, // id = selector of the step node in form.schema.ts
    { id: 'contacts', rules: contactsRules },
  ],
};

// forms/credit-application/form.messages.ts — the issue texts by code
import { defineIssueMessages } from '@reformer/core/i18n';
export const creditApplicationMessages = defineIssueMessages({
  'loanAmount.required': 'Укажите сумму кредита',
});

// forms/credit-application/index.tsx — entry: assembles the form, renders <FormWizard> with all steps inline
import { createForm } from '@reformer/core';
// ONE call: model + form + behavior + validation + flow. In the page: useFormBundle(createCreditApplicationForm).
export const createCreditApplicationForm = () =>
  createForm<CreditApplicationForm>({
    model: createCreditApplicationModel(),
    schema: creditApplicationSchema,          // builder (model) => tree
    behavior: creditApplicationBehavior,
    validation: creditApplicationValidation,  // { extras } — rules outside the steps
    flow: creditApplicationFlow,              // steps → bundle.flow, bundle.validateStep(id)
  });
// The page: <ValidationMessagesProvider messages={creditApplicationMessages}> around the form,
// <FormWizard form={bundle.form} flow={bundle.flow} … onSubmit={() => bundle.submission.submit(api.send)} />.
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
    │   ├── form.ts                  # FormValidation: { extras } — rules outside the steps
    │   ├── messages.ts              # defineIssueMessages: issue code → text
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
    │                                #   + FormFlowConfig { steps: [{ id, rules }] } for createForm
    │
    ├── application/
    │   ├── create.ts                # ONE createForm call shared by every way of rendering
    │   ├── load.ts                  # network: fetch the entity and dictionaries
    │   ├── mapping.ts               # server response → model (model.patch + captureInitial)
    │   ├── payload.ts               # form values → request body: drops the computed fields
    │   ├── submit.ts                # sending and reporting the outcome (handler of bundle.submission.submit)
    │   └── renderer.ts              # node rules for the renderer: loading, submit, navigation (setup)
    │
    ├── components/                  # React layout: steps/, nested-forms/, ui/
    ├── api/                         # HTTP calls
    └── types/  constants/  utils/   # form type, option dictionaries, pure calculations
```

Dependencies point one way: `application → flow → schema/steps, validation/<step>`;
`application → behavior → model`. Nothing below `application/` knows the entity id, the network or
the wizard — the behavior is static and reusable.

**The flow is the single place a step is declared.** One entry carries the step's `selector`,
title, icon, content and rules, so the step nodes of the schema, the `flow` of the assembly and
the wizard steps of a hand-written React page are all derived from the same list — there is
nowhere to pair the layout of one step with the rules of another:

```typescript
// flow/credit-application-flow.ts
export const creditApplicationFlow = [
  { selector: 'loan', title: 'Loan', icon: '💰', content: loanStep, rules: loanRules },
  { selector: 'contacts', title: 'Contacts', icon: '📞', content: contactsStep, rules: contactsRules },
] as const satisfies readonly FlowStep[];

// the same list → the flow of createForm; the step id is the step selector
export const creditApplicationFlowSteps: FormFlowConfig<CreditApplicationForm> = {
  steps: creditApplicationFlow.map((step) => ({ id: step.selector, rules: step.rules })),
};

// schema/form.ts — step nodes come from the flow
children: creditApplicationFlow.map((step) => ({
  selector: step.selector,
  component: Step,
  componentProps: { title: step.title, icon: step.icon },
  children: step.content(model),
})),

// validation/form.ts — only the rules outside the steps
export const creditApplicationValidation: FormValidation<CreditApplicationForm> = {
  extras: crossStepRules,
};

// application/create.ts
createForm<CreditApplicationForm>({
  model: createCreditApplicationModel(),
  schema: creditApplicationSchema,
  behavior: creditApplicationBehavior,
  validation: creditApplicationValidation,
  flow: creditApplicationFlowSteps,
});
```

**Texts of the issues live in `validation/messages.ts`.** Rules carry codes
(`required({ code: 'loanAmount.required' })`), the dictionary maps a code to its text, and every
way of rendering wraps the form in `<ValidationMessagesProvider messages={…}>` from
`@reformer/cdk` — the texts are the same in hand-written React, renderer-react and renderer-json.

**Conditions live in `model/predicates.ts`** as pure functions over values
(`isMortgage(loanType)`). Behavior (`enableWhen`, `hideWhen`), validation (`validateWhen`) and the
JSX of a step call the same function — a condition is written once.

**Loading and submitting are not behavior.** They belong to `application/`: the page (or, for the
renderer, `application/renderer.ts` passed as `setup`) calls `load`, hands the response to
`mapping`, and sends through `bundle.submission.submit(handler)` — one run of all the rules, the
handler is called only when the form is valid. Written into the model with `model.patch` followed
by `model.captureInitial()`, the loaded values become the form's starting point: the form is not
dirty, and `model.reset()` returns to them. The handler receives `model.get()` — the whole model,
disabled fields included; `application/payload.ts` drops the fields the server does not expect
(computed ones) before the request.

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

> The MCP layout check (`validate_form` with `kind: "layout"`) verifies the flat layout file names
> (and the optional `steps/<slug>/` folders); the folders layout is recognized by its top-level
> folders only. Cross-target variants (renderer-react: the same files; renderer-json: plus
> `registry.ts`, and `form.schema.ts` holds the JSON-DSL document) are described in the
> **form-directory-layout** guide (`find_recipe directory-layout`).
