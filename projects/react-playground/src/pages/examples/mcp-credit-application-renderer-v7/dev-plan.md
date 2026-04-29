# Dev plan — credit-application form, target=renderer-react (iter-7 page 2)

## Inputs

- Spec: `docs/specs/credit-application-form.md` (read-only)
- Cached MCP prompts: `.tmp/iter7/{add-wizard,add-form-array,add-validation,add-behavior,create-form-renderer-react}.json`
- Detected stack: `@reformer/core`, `@reformer/cdk`, `@reformer/renderer-react`, `@reformer/ui-kit`, Tailwind v4, `lucide-react`.

## Wizard implementation choice (Section A)

**Pick: A=A3 (CDK FormWizard compound)**

Walked the hierarchy from `add-wizard.json`:

- A1 (`@reformer/ui-kit FormWizard`) — not exported by ui-kit, so skip.
- A2 (project-custom wrapper) — `FormWizard.tsx` lives in
  `complex-multy-step-form/components/ui/FormWizzard/`, but it's tied to the
  legacy wizard layout (renders all steps inside its own card). It does NOT
  drive `setHidden` on a RenderSchema. Reusing it would defeat the point of
  this iteration (regression-test renderer-react setHidden flow). Skip.
- A3 (CDK `FormWizard` compound) — perfect fit. Compound exposes
  `currentStep`/`goToNextStep`/`submit` via context + handle. We render the
  visible chrome (Indicator chips, Actions buttons, Progress) inside the
  compound and push the **step content rendering** into `FormRenderer` via
  a sibling — chosen.
- A4 (`useState` manual) — explicitly not chosen; rules forbid without
  justification, and A3 is sufficient.

**Indicator chips, Actions, Progress** are built inline using
`FormWizard.Indicator`, `FormWizard.Actions`, `FormWizard.Progress` headless
slots + lucide icons (`Coins, User, Phone, Briefcase, FileText, CheckSquare`).
Chips are `<button>` and call `goToStep(N)` from indicator render-props.

## Integration choice (Section B)

**Pick: B=B2 (renderer-react setHidden via `useEffect`)**

target = renderer-react. From `add-wizard.json` Section B2:

> A3/A4: useEffect toggling `schema.node('stepN').setHidden(currentStep !== n)`
> for each step.

Schema root is a self-managed `FormRoot` (`__selfManagedChildren = true`)
that takes `form` via `componentProps` and renders its children with
`RenderNodeComponent`. Children = 6 step containers, each with `selector:
'step1'..'step6'`. A nested `WizardSync` component reads
`useFormWizard().currentStep` and runs `useEffect` to call setHidden on the 6
step nodes.

Conditional sub-sections inside a step (mortgage, car, residence,
employer, business, income, properties/loans/coBorrowers arrays,
unemployed-warning) use **top-level `hideWhen(proxy.node('selector'),
...)`** in `render-schema.tsx` AFTER `createRenderSchema(...)` — never inside
the node config (`add-wizard.json` Section B2 explicit rule).

## FormArray choice (regression test for FieldPath→ArrayNode resolve)

`add-form-array.json` requires for renderer-react self-managed array blocks:

> Resolve `FieldPath → ArrayNode` via `FieldPathNavigator` + `extractPath`,
> AND mark `(Block as any).__selfManagedChildren = true`. Generic resolver
> needs `<T extends FormFields>` (Patch C constraint).

Custom **`FormArrayBlock`** lives in `render-schema.tsx`. It:

1. Accepts `control` as `FieldPath<T>` (the schema author writes
   `path.properties` — a `FieldPathNode`, NOT a resolved `ArrayNode`).
2. Inside, calls `extractPath(control)` to get a path string, then
   `new FieldPathNavigator().getNodeByPath(form, pathStr)` to obtain the
   real `ArrayNode<T>`.
3. Generic over `<T extends FormFields>` (Patch C).
4. Has `__selfManagedChildren = true` so `RenderNodeComponent` injects
   `form` and stops auto-rendering children.
5. Wraps `<FormArray.Root>`, `<FormArray.List>`, `<FormArray.AddButton>`
   from `@reformer/cdk/form-array`. AddButton `initialValue` factory
   returns PLAIN leaf values only (no FieldConfig — see Patch / risk #3).

Three arrays in step 5: `properties`, `existingLoans`, `coBorrowers`.

## File map

1. `dev-plan.md` (this file)
2. `types.ts` — interfaces. Union-literal leaves (LoanType etc.) are NOT
   marked `extends FormFields` (Patch B regression check). Sub-types
   `Property`, `ExistingLoan`, `CoBorrower`, `Address`, `PersonalData`,
   `PassportData` redeclared inline (self-contained page).
3. `schema.ts` — `createForm<CreditApplicationForm>({ form, validation })`
   plus `STEP_VALIDATIONS` map and `createCreditApplicationForm`. Every
   `Select`/`RadioGroup` has `options` + `label` + `placeholder`. Behavior
   schema kept minimal (computed totalIncome + sameAsRegistration copy)
   to avoid cycle hazards — full behavior deferred. Cast to `as never` /
   `as unknown as FormProxy<...>` only where TS2589 hits (deep tree).
4. `render-schema.tsx` — `createCreditApplicationRenderSchema(form)`.
   - Root: `FormRoot` (`__selfManagedChildren = true`) takes `form` via
     `componentProps`.
   - Children: 6 step containers, `selector: 'step1'..'step6'`.
   - Sub-section selectors: `mortgage-section`, `car-section`,
     `residence-address-section`, `employer-section`, `business-section`,
     `income-section`, `unemployed-warning`, `properties-array`,
     `existing-loans-array`, `co-borrowers-array`.
   - Custom `FormArrayBlock` for the 3 arrays.
   - After `createRenderSchema(...)`, call `hideWhen(...)` for each
     conditional sub-section.
5. `index.tsx` — Page component:
   - `createCreditApplicationForm()` once.
   - `createCreditApplicationRenderSchema(form)` once.
   - Renders `<FormWizard>` with 6 invisible `<FormWizard.Step />`
     children (purely to give the wizard a `totalSteps` count via
     `countSteps`), plus `Indicator`, `FormRenderer` (the step content),
     `Actions`, `Progress`, `WizardSync` (calls `setHidden`).
6. `dev-report.md` — outcome + which patches were verified.

## STEP_VALIDATIONS layout

Per spec Section "Поля формы". Each step has its own
`ValidationSchemaFn<CreditApplicationForm>`:

- step 1: `loanType`, `loanAmount` (required, min/max), `loanTerm`, `loanPurpose` (minLength 10).
  Conditional via `applyWhen` for mortgage / car branches.
- step 2: required on `personalData.*`, `passportData.*`, `inn`, `snils`.
- step 3: `phoneMain`, `email` format; address.* required; conditional residence.
- step 4: `employmentStatus` required + conditional employer / business / income.
- step 5: `maritalStatus`, `dependents`, `education` always; conditional arrays via flag.
- step 6: every `agree*` and `confirmAccuracy` must be `true`; `electronicSignature` 6 digits.

`fullValidation` composes the 6 step validators via `apply(path, fn)` and
adds cross-step rules (paymentToIncomeRatio ≤ 50 %, age 18–70).

## Risks / regression targets verified

- **Patch B** (no `extends FormFields` on union-literal leaves) — types.ts
  uses plain `type LoanType = 'consumer' | …`, never reused as a Group key.
- **Patch C** (`<T extends FormFields>` on resolver) — `FormArrayBlock` is
  generic with `<T extends FormFields>`.
- **Patch G** (wizard hierarchy) — choice walked top-down, A3 picked with
  written justification.
- **FieldPath→ArrayNode resolve** — `FieldPathNavigator + extractPath`
  inside `FormArrayBlock`.
- **`__selfManagedChildren = true`** — set on both `FormRoot` and
  `FormArrayBlock`.
- **AddButton initialValue = PLAIN leaves** — every template factory uses
  raw `{ type: 'apartment', description: '', estimatedValue: 0, … }`.

## Out of scope (gaps for next iteration)

- Real API loading (regions / cities / car-models async).
- Computed cascade for `interestRate`, `monthlyPayment`, `paymentToIncomeRatio`.
- Warning-level validators (`warnHighDebtLoad`, `warnSeniorAge`, `warnLowWorkExperience`).
- Mode = view (read-only).
- Submit handler (we render console.log + alert stub).
