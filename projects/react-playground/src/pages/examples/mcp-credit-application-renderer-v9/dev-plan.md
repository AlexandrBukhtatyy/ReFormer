# Iter-9 dev-plan — credit-application form (renderer-react)

Spec: `docs/specs/credit-application-form.md` (read-only).

## Stack detection

Stack: `@reformer/core` + `@reformer/cdk` + `@reformer/ui-kit` + `@reformer/renderer-react`.
Target: `renderer-react`.

## (A, B) wizard pair

- **A=A1 (FormWizard from `@reformer/ui-kit/form-wizard`)** — DEFAULT for ui-kit stacks (Patch G + ui-kit Path C). Polymorphic `step.body`. Visual baseline (indicator strip, action bar, progress) is provided by ui-kit.
- **B=B2 (renderer-react)** — `step.body` is a `RenderNode<T>` subtree built inside `createRenderSchema((path) => ...)` — uses `path.X` (FieldPathNode), NEVER `form.X` (Patch J). ui-kit FormWizard handles step switching internally so no `setHidden('stepN')` is needed for the steps themselves; per-step containers carry `selector: 'stepN'` for diagnostics / future toggling.

## Conditional sub-section selectors (within steps)

- `mortgage-section` — visible when `loanType === 'mortgage'`.
- `car-section` — visible when `loanType === 'car'`.
- `residence-address-section` — visible when `sameAsRegistration === false`.
- `employer-section` — visible when `employmentStatus === 'employed'`.
- `business-section` — visible when `employmentStatus === 'selfEmployed'`.
- `income-section` — visible unless `employmentStatus === 'unemployed'`.
- `unemployed-warning` — visible when `employmentStatus === 'unemployed'`.
- `properties-array` — visible when `hasProperty === true`.
- `existing-loans-array` — visible when `hasExistingLoans === true`.
- `co-borrowers-array` — visible when `hasCoBorrower === true`.
- `additional-income-source-section` — visible when `additionalIncome > 0`.

All wired via top-level `hideWhen(proxy.node('selector'), () => ...)` AFTER `createRenderSchema(...)`.

## Behavior — copy / compute (Patch I — group-node subscription, no `as never`)

- `copyFrom(path.registrationAddress, path.residenceAddress)` triggered on `sameAsRegistration === true`.
- `computeFrom([path.personalData.lastName, ...firstName, ...middleName], path.fullName)` — string concat.
- `computeFrom(path.personalData.birthDate, path.age)` — years.
- `computeFrom([path.monthlyIncome, path.additionalIncome], path.totalIncome)` — sum.
- `computeFrom([path.loanAmount, path.loanTerm, path.interestRate], path.monthlyPayment)` — annuity formula.
- `computeFrom([path.monthlyPayment, path.totalIncome], path.paymentToIncomeRatio)`.
- `computeFrom(path.propertyValue, path.initialPayment)` — 20%.
- `computeFrom(path.coBorrowers, path.coBorrowersIncome)` — sum across array (group-node subscription, no `as never`).

(Out of scope by task brief: full async fetch, view-mode, warning-level validators, dynamic dictionaries.)

## Validation per step (STEP_VALIDATIONS) + fullValidation

Each step has its own ValidationSchemaFn covering `required` + format on its fields. `fullValidation` is `apply([...])` of all six. Cross-step rules (paymentToIncomeRatio ≤ 50%, age ∈ [18, 70]) live in `fullValidation` only.

## Files

1. `dev-plan.md` (this file).
2. `types.ts` — `interface CreditApplicationForm` + nested types (no `extends FormFields` on union-literal leaves).
3. `schema.ts` — `createCreditApplicationForm()` returning `FormProxy<CreditApplicationForm>` via `createForm({ form, behavior, validation })` with all `componentProps` (label, options, mask, type, rows, placeholder).
4. `render-schema.tsx` — `createCreditApplicationRenderSchema(form)` using `createRenderSchema((path) => ...)` with `FormWizard` root and step bodies built from `path.X`. After creation, `hideWhen(proxy.node(...), ...)` wires conditional sub-sections.
5. `data-fixture.ts` — `happyPathFixture: CreditApplicationForm` (consumer credit, no mortgage/car/properties/loans/coBorrowers — straight-through path).
6. `index.tsx` — `useMemo` form + schema + `FormRenderer` + `Fill fake data` button (testId `fill-fake-data`).
7. `dev-report.md`.

## Critical invariants

- All wizard step containers have `selector: 'stepN'`.
- FormArray `initialValue` is plain leaves only (no FieldConfig).
- `componentProps` use camelCase (Patch H): `readOnly`, `maxLength`, `minLength` (not `readonly`/`maxlength`).
- testId convention: dotted path (`step1.loanAmount`, `step2.passportData.series`).
- Inside `createRenderSchema((path) => ...)` use `path.X` only (Patch J).
- All `label` / `placeholder` / `options` / `mask` / `type` / `rows` declared in `createForm` componentProps (Patch G).
- `extends FormFields` NOT used on `PersonalData` (union-literal `gender`).
