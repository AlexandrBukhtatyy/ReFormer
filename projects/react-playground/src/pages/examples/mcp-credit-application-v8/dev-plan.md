# Dev Plan — MCP Credit Application v8 (target=core)

## Goal

Implement spec `docs/specs/credit-application-form.md` (6-step credit application form, ~50 fields, 3 FormArrays, 8 computed fields) using **plain React + @reformer/core + @reformer/ui-kit + @reformer/cdk** — no RenderSchema. Iter-8 regression validates patches **G** (FormWizard hierarchy), **H** (camelCase componentProps), **I** (computeFrom group subscription), **D1**, **D3**.

## Wizard Implementation Pair (Patch G hierarchy walk)

### Pair A — Wizard root component

Walking `add-wizard.md` hierarchy A1 → A2 → A3 → A4:

- **A1 — `FormWizard` from `@reformer/ui-kit/form-wizard`.** Available since ui-kit Path C migration. `@reformer/ui-kit` is in `react-playground/package.json` (workspace dependency). Recipe `ui-kit/form-wizard` shows `FormWizard` exports `FormWizardStep<T>`, `FormWizardHandle<T>`, accepts `form`, `config={ stepValidations, fullValidation }`, `steps[]`, `onSubmit`. Existing reference example `complex-multy-step-form/CreditApplicationForm.tsx` uses A1.
- A2 — CDK `FormNavigation` headless: not needed when A1 works.
- A3 — `useStepForm` hook + manual nav: not needed when A1 works.
- A4 — manual `useState` step counter: regression-bait.

**Choice: A1.** Default for any project that has `@reformer/ui-kit` in deps. Clean, declarative, gives us free Indicator + Actions + Progress out of the box.

### Pair B — Conditional sub-section rendering inside step bodies

Target=core means we don't have RenderSchema gates (`enableWhen`-driven hiding). For sub-sections that depend on flag fields (`hasProperty`, `hasExistingLoans`, `hasCoBorrower`, `sameAsRegistration`, `loanType==='mortgage'`, `employmentStatus==='employed'`, etc.) we have:

- **B1 — JSX-conditional sub-sections inside step bodies.** Each `Step*Body` FC reads the flag via `useFormControlValue(form.<flag>)` and conditionally renders sub-blocks. The `enableWhen` behavior on individual leaf fields handles disable/reset; visibility is controlled by JSX. **No `enableWhen` on ArrayNode** (D3 rule, would crash on mount). Recipe `core/arrays` confirms: "show array conditionally — gate the rendering in JSX".

**Choice: B1.** Mandatory for target=core.

## Risk Matrix

| Risk | Severity | Mitigation |
|---|---|---|
| `extends FormFields` on union-literal leaf interface (gender/loanType/employmentStatus) breaks TS | High | Don't extend FormFields on union-typed interfaces; let FormFields constraint flow through structural typing. Add `[key: string]: FormValue` index only when TS complains. |
| Patch H — `readonly` (lowercase) hits HTML attribute path, not React | Medium | Use `readOnly: true` (camelCase) in all computed-field componentProps. |
| Patch I — `computeFrom` reading `form.<group>.<field>` requires subscription to group node | High | When computing from `personalData.lastName/firstName/middleName` in `fullName`, subscribe to `[path.personalData]` (group), not `[path.personalData.lastName, ...]`. computeFn reads `form.personalData.lastName`. |
| D1 — `Select`/`RadioGroup` without `options` causes `r.map` runtime crash | Medium | Always include `options` in `componentProps` for `Select`/`RadioGroup` in `createForm` schema. |
| D3 — `FormArray.AddButton initialValue` with FieldConfig objects breaks rendering | High | Item factories return plain typed primitives (`PropertyItem`, `ExistingLoanItem`, `CoBorrowerItem`), never FieldConfig. |
| Cycle detection in watchField cascades (computed chain) | High | `{ immediate: false }` on every watchField + value-equality guards. Use `enableWhen({ resetOnDisable: true })` for conditional fields, not manual watchField. |
| `enableWhen` on ArrayNode triggers reactive cycle on mount | Critical | Use Checkbox flags (`hasProperty`, `hasExistingLoans`, `hasCoBorrower`) + JSX-conditional rendering of `<FormArray.Root>`. Behavior schema clears the array via `watchField(flag) → array.clear()` when flag flips false. |
| `personalData.gender` is union `'male' \| 'female'` — extending FormFields can fail | Medium | Keep PersonalData as plain interface; no `extends FormFields`. |
| Cross-array computeFrom (`coBorrowersIncome` from `coBorrowers[].monthlyIncome`) | Medium | computeFrom subscribes to `[path.coBorrowers]` ArrayNode, computeFn iterates `form.coBorrowers` plain array of items. |
| TS2589 on deeply nested validators | Low | Only if hit: cast workarounds from add-behavior.md; defer until tsc reports it. |
| Submit handler — alert+console.log mock only | Low | Per spec — mock submission, no real API. |

## File Plan

1. `types.ts` — `LoanType`, `EmploymentStatus`, `MaritalStatus`, `EducationLevel`, `Gender`, `PropertyType`, sub-form types (`PersonalData`, `PassportData`, `Address`, `Property`, `ExistingLoan`, `CoBorrower`), root `CreditApplicationForm`. No `extends FormFields` on union-leaf interfaces.
2. `schema.ts` — `createForm` schema (all 50+ fields with components/componentProps), behavior (computed + copyFrom + enableWhen + watchField for array clear), `STEP_VALIDATIONS` map, `fullValidation`, factory helpers (`createPropertyItem`, `createExistingLoanItem`, `createCoBorrowerItem`).
3. `data-fixture.ts` — typed `happyPathFixture: CreditApplicationForm` for consumer-loan happy path.
4. `index.tsx` — page component with `FormWizard`, dev-only fill button, mock submit handler.
5. `dev-report.md` — final report after tsc passes.

## Field strategy

- All ui components from `@reformer/ui-kit`: `Input`, `InputMask`, `Textarea`, `Select`, `RadioGroup`, `Checkbox`, `FormField`.
- `testId` on each `FormField` follows dotted-path convention (`step1.loanAmount`, `step2.passportData.series`, `step5.properties.0.type`).
- All Russian user-facing strings from spec.
- Computed fields readonly via `readOnly: true` (Patch H).

## Behaviors plan

- `enableWhen` (resetOnDisable):
  - propertyValue, initialPayment ← loanType==='mortgage'
  - carBrand, carModel, carYear, carPrice ← loanType==='car'
  - companyName, companyInn, companyPhone, companyAddress, position ← employmentStatus==='employed'
  - businessType, businessInn, businessActivity ← employmentStatus==='selfEmployed'
- `copyFrom`:
  - `registrationAddress` → `residenceAddress` when `sameAsRegistration === true`
- `computeFrom` (Patch I — group subscription):
  - `fullName` from `[path.personalData]`
  - `age` from `[path.personalData]`
  - `interestRate` from `[path.loanType]` (simplified — no region/property dep to avoid cycles in Iter-8)
  - `monthlyPayment` from `[path.loanAmount, path.loanTerm, path.interestRate]` (siblings)
  - `initialPayment` from `[path.propertyValue]` (computed override of editable)
  - `totalIncome` from `[path.monthlyIncome, path.additionalIncome]`
  - `paymentToIncomeRatio` from `[path.monthlyPayment, path.totalIncome]`
  - `coBorrowersIncome` from `[path.coBorrowers]` (ArrayNode)
- `watchField` (array clear on flag flip — `{ immediate: false }`):
  - `hasProperty` → `properties.clear()` when false
  - `hasExistingLoans` → `existingLoans.clear()` when false
  - `hasCoBorrower` → `coBorrowers.clear()` when false

## Out of scope

- Async carModels / cities loading — dropped (spec marks as "Динамическая загрузка"; plain Input fallback used).
- Warning-level validators — dropped.
- mode='view' — dropped.
- async electronicSignature validation — dropped (sync minLength/maxLength only).
