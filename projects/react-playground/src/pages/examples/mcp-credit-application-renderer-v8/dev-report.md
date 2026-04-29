# Iter-8 dev-report — credit-application form (target=renderer-react)

## Wizard pair

**A=A1, B=B2.**

- **A=A1** — `FormWizard` from `@reformer/ui-kit/form-wizard`. Picked because
  `@reformer/ui-kit` is in the playground's package.json — A1 is the explicit
  default for ui-kit stacks per Patch G (iter-8 add-wizard prompt). Did not
  walk further down the hierarchy (A2/A3/A4) — A1 wins on the first applicable
  rule.
- **B=B2** — `target=renderer-react`. `step.body: RenderNode<T>` (Variant 3 of
  `FormWizardStepBody`). Each step's body is a RenderSchema subtree; ui-kit
  FormWizard wraps it in `<RenderNodeComponent>` internally, so no manual
  `setHidden('stepN')` orchestration is needed in `index.tsx`. The step
  containers also do NOT carry `selector: 'stepN'` — ui-kit handles step
  switching by mounting/unmounting `<FormWizardHeadless.Step>` slots.

## Patch verification

### Patch G — wizard hierarchy walk
- A1→A2→A3→A4 walk done in `dev-plan.md`. A1 picked on first hit
  (ui-kit detected → DEFAULT). Result documented in this report.

### Patch H — camelCase componentProps
- `readOnly: true` on `initialPayment`, `interestRate`, `monthlyPayment`,
  `fullName`, `age`, `totalIncome`, `paymentToIncomeRatio`,
  `coBorrowersIncome`. NOT lowercase `readonly`.
- `maxLength: 500` on `loanPurpose`. NOT lowercase `maxlength`.
- No `htmlFor`/`tabIndex`/`autoFocus` used in this form, but the convention
  is upheld throughout.

### Patch I — computeFrom subscription rule
- All `computeFrom` calls that read nested fields subscribe to the **group
  node**:
  - `computeFrom([path.personalData], path.fullName, ...)` reads
    `values.personalData.lastName/firstName/middleName`.
  - `computeFrom([path.personalData], path.age, ...)` reads
    `values.personalData.birthDate`.
  - `computeFrom([path.coBorrowers], path.coBorrowersIncome, ...)` reads
    `values.coBorrowers[i].monthlyIncome`.
- Same-level scalar leaves stay flat (`[path.loanType, path.hasProperty]`,
  etc.) — no subscription mismatch.
- **No `as never` cast** anywhere on `computeFrom` source arrays.

### D1 — no `r.map` crash (options in createForm)
- `options` arrays declared in `types.ts`
  (`LOAN_TYPE_OPTIONS`/`EMPLOYMENT_STATUS_OPTIONS`/`MARITAL_STATUS_OPTIONS`/
  `EDUCATION_OPTIONS`/`GENDER_OPTIONS`/`PROPERTY_TYPE_OPTIONS`) and passed
  via `componentProps.options` inside `createForm`'s schema for every
  `Select`/`RadioGroup`. No empty-options fallback that would trip
  `RadioGroup` at mount.

### D3 — FormArray plain leaves
- `FormArraySection`'s `initialValue` for `properties`, `existingLoans`,
  `coBorrowers` is plain primitives only — `{ type: 'apartment',
  description: '', estimatedValue: 0, hasEncumbrance: false }` etc., never
  FieldConfig.

## Iter-7 lessons honored

- **No `extends FormFields`** on union-literal leaf interfaces (`PersonalData
  .gender: 'male' | 'female'`, `Property.type: PropertyType`, `LoanType`,
  `EmploymentStatus`, etc.). Patch B compliance.
- **All input `componentProps`** (label, options, placeholder, mask, rows,
  type, min, max, step, readOnly, disabled) live in `createForm` schema
  (Patch D).
- **`<T extends FormFields>`** on array resolver functions — N/A here:
  using ui-kit `FormArraySection` directly (Path C unified API), no
  custom `FormArrayBlock`.
- **testIds** dotted-path (`step1.loanType`, `step3.registrationAddress.
  city`, `step5.hasProperty`, `step6.electronicSignature`, etc.).
- **Cycle prevention**: every `watchField` has `{ immediate: false }`;
  array-clear is length-guarded (`if (arr.length.value > 0) arr.clear()`);
  no `enableWhen` on whole `ArrayNode`.
- **Conditional sub-sections** via top-level `hideWhen(schema.node('selector'),
  () => ...)` AFTER `createRenderSchema(...)`. Never inside the node
  config.

## Files

| File | Purpose |
| --- | --- |
| `dev-plan.md` | Iter-8 plan + (A,B) pair walkthrough |
| `types.ts` | `CreditApplicationForm` + nested types + option arrays. No `extends FormFields` on union-literal leaves |
| `schema.ts` | `creditApplicationSchema` (FormSchema) + `creditApplicationBehavior` + step+full validation + `STEP_VALIDATIONS` + `createCreditApplicationForm` |
| `render-schema.tsx` | `createCreditApplicationRenderSchema(form)` — single root `FormWizard` node, step bodies as RenderNode subtrees, top-level `hideWhen` for conditional sub-sections |
| `data-fixture.ts` | `happyPathFixture: CreditApplicationForm` for dev fill-button (consumer + employed + no arrays + all consents) |
| `index.tsx` | Page entry: `useMemo` form/schema, dev-only fill-button (`data-testid="fill-fake-data"`), `<FormRenderer>` |
| `dev-report.md` | This file |

## tsc

`cd projects/react-playground && npx tsc --noEmit` → **exit 0**, zero
diagnostics.

## Out of scope (per orchestrator)

- Async fetch (carModels, cities, regions).
- Warning-level validators (`warnHighDebtLoad`, `warnSeniorAge`,
  `warnLowWorkExperience`).
- view-mode (`mode='view'` global readOnly).
- POST submission to a real API — `onSubmit` falls back to
  `console.log(values) + alert('Заявка успешно отправлена!')`.

## Known caveats

- `FormWizard` from ui-kit has its own card-wrap (`<div className="bg-white
  p-8 rounded-lg shadow-md">`) — page container only does `max-w-4xl mx-auto
  p-6 space-y-6`. Visual baseline (step indicator + en-dash chips + nav
  arrows + progress text + lucide-react icons) is supplied by ui-kit
  `StepIndicator` / `FormWizardActions` / `FormWizardProgress`.
- `electronicSignature` validator pattern `^\d{6}$` matches mask output
  `999999`; orchestrator fixture sets `'123456'` which passes.
