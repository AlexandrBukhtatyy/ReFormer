# Dev plan — mcp-credit-application-v10 (target=core)

Iter-10 MCP regression. Target = `core` (no RenderSchema). Spec: `docs/specs/credit-application-form.md`.

## Stage interpretation

1. **plan-form** (already supplied as 01-plan-form.md): 76 fields across 6 steps; conditional fields by `loanType`/`employmentStatus`/`sameAsRegistration`; computed fields (`fullName`, `age`, `totalIncome`, `paymentToIncomeRatio`, `monthlyPayment`, `interestRate`, `initialPayment`, `coBorrowersIncome`); 3 form arrays toggled by checkbox flags.
2. **create-form**: declarative `FormSchema` only — no validation/behavior. Use `@reformer/ui-kit` field components (Input, Select, RadioGroup, Checkbox, Textarea, InputMask). Conditional fields rendered via JSX-conditional in step bodies (Hide-not-Disable) — but defined in schema unconditionally so `setValue(happyPathFixture)` always has somewhere to go.
3. **add-validation**: `required/min/max/minLength/maxLength/email/pattern` from `@reformer/core/validators`, **every** with `{ message }`. Conditional via `applyWhen`. Cross-field via `validate(...)` (loanAmount<=propertyValue-initialPayment, age 18..70, paymentToIncomeRatio<=50%).
4. **add-behavior**: declarative-first. `enableWhen` + `resetOnDisable` for conditional fields; `copyFrom` for sameAsRegistration (registrationAddress→residenceAddress); `computeFrom` for fullName/age/totalIncome/paymentRatio/interestRate/monthlyPayment/initialPayment; `watchField` (`{ immediate: false }`) for array cleanup on flag-uncheck. Subscribe to **group** path for nested computeFn.
5. **add-form-array**: `properties: [propertySchema]`, `existingLoans: [existingLoanSchema]`, `coBorrowers: [coBorrowerSchema]` — tuple shape. UI via `FormArraySection` from `@reformer/ui-kit/form-array` with `hasItems={hasFlag}` JSX-conditional. PLAIN-leaf templates only.
6. **add-wizard**: A1 (FormWizard from `@reformer/ui-kit/form-wizard`) — ui-kit detected. B1 (target=core, no setHidden). Step bodies = FC `({ control: FormProxy<T> })`. `STEP_VALIDATIONS` per step + full `creditApplicationValidation` for submit.

## Files

- `types.ts` — `interface CreditApplicationFormV10` + nested `PersonalData`/`PassportData`/`Address`/`Property`/`ExistingLoan`/`CoBorrower` + literal unions for select/radio.
- `schema.ts` — `createCreditApplicationForm()` → `FormProxy<CreditApplicationFormV10>` with `form` + `validation` + `behavior`.
- `data-fixture.ts` — `happyPathFixture: CreditApplicationFormV10` covering consumer-loan happy path + at least one item in each array (because `hasProperty/hasExistingLoans/hasCoBorrower` flags toggled true; otherwise spec submit-validation acceptance is partial).
- `index.tsx` — page component. `useMemo(() => createCreditApplicationForm())`, `FormWizard` (A1), `data-testid="fill-fake-data"` button calling `form.setValue(happyPathFixture)`.
- `dev-plan.md`, `dev-report.md`.

## TestId convention

Per the orchestrator contract: `input-step{N}.{field}` with dotted paths. Radio options: `input-step5.maritalStatus-married`. Step indicators: `step-indicator-{N}`. Wizard nav: `btn-prev/btn-next/btn-submit`. Array: `array-add`, `array-item-{i}`, `array-item-{i}-remove`. Fill button: `fill-fake-data`. Note ui-kit `FormWizard` ships its own indicator/nav testIds; we layer the contract testIds via custom buttons / wrap.

Since ui-kit FormWizard does NOT expose `btn-prev`/`btn-next`/`btn-submit` data-testids by default, I check what it does emit; if the headless emits accessible testIds, I add a thin custom row of buttons OR I rely on ui-kit's own ids. **Plan**: build with FormWizard but add wrap-level testIds where missing.

## Risks

- TS2589 on deeply-nested `path.coBorrowers.at(...).personalData.lastName` inside validation — apply prompt's recommended `(path: any) => {}` cast.
- `extends FormFields` on leaf interfaces (Property/CoBorrower) widens literal types — avoid.
- `enableWhen({ resetOnDisable: true })` on whole ArrayNode → browser hang. Use `watchField` cleanup pattern instead.
- `computeFrom` group subscription rule: subscribe to `path.personalData` (group), not individual leaves, for `fullName`/`age` to receive `{ personalData: {...} }`.
- Every `watchField` MUST take `{ immediate: false }`.

## Test plan (orchestrator handles playwright)

1. Initial render: 6 step-indicator chips + step1 fields visible.
2. Empty submit on step 1: localized errors appear.
3. Conditional reveal: switch loanType to mortgage → propertyValue/initialPayment fields appear; switch to car → carBrand/Model/Year/Price.
4. fill-fake-data button: setValue happy path → all steps prefilled, can navigate to last step and submit successfully.
