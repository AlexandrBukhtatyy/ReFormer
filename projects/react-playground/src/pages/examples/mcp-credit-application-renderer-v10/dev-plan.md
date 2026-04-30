# Dev Plan — MCP Credit Application Renderer v10 (target=renderer-react)

Iter-10 regression test of patches G–M for renderer-react target.

## Decisions

- **Wizard impl (Section A): A1** — `FormWizard` from `@reformer/ui-kit/form-wizard` (default for ui-kit stacks).
- **Integration (Section B): B2** — `target=renderer-react`. `step.body` is a `RenderNode<T>` subtree built via `path.X` (FieldPathNode), passed into ui-kit `FormWizard` which wraps it in `<RenderNodeComponent>` internally. No `setHidden` step-switching needed (ui-kit handles it).
- **Conditional sub-sections (mortgage / car / employed / selfEmployed / sameAsRegistration / hasProperty / hasExistingLoans / hasCoBorrower):** orchestrated via `useFormControlValue(form.X)` + per-condition `useEffect` calling `schema.node('selector').setHidden(...)` — Patch L compliance (no raw `effect()` + signal-write).

## Patches verified

- **Patch G** — Wizard hierarchy A1: ui-kit FormWizard auto-detected. Yes.
- **Patch H** — `readOnly: true` (camelCase) on computed fields; `maxLength` (camelCase) on Textarea. Reused from v9 schema.
- **Patch I** — `computeFrom([path.personalData], ...)` subscribes to **group node** for `fullName` / `age`. No `as never` cast.
- **Patch J** — RenderSchema callbacks return nodes with `component: path.X` (FieldPathNode), NEVER `form.X`. Critical for renderer-react flow.
- **Patch K** — N/A (renderer-json `model`/`selector` semantics). Verified by absence of regressions.
- **Patch L** — JSX/`useEffect` orchestration: each conditional section gets its own `useEffect` reacting to `useFormControlValue(form.flag)` and calling `schema.node('selector').setHidden(...)` separately. No combined raw `effect()` block.
- **Patch M** — `hideWhen(node, () => form.X.value.value !== 'foo')` uses **double** `.value`. (Used inline as a defense-in-depth on a few internal `hideWhen` calls; main orchestration is React-side per Patch L recommendation.)

## Files

1. `types.ts` — interface `CreditApplicationForm`, sub-types (PersonalData, PassportData, Address, PropertyItem, ExistingLoanItem, CoBorrowerItem) — copied from iter-9.
2. `schema.ts` — `createCreditApplicationForm()`: `formSchema` + `behaviorSchema` (enableWhen + copyFrom + computeFrom group-node + watchField with `immediate: false` + length-guard) + `STEP_VALIDATIONS` + `fullValidation`. Exported item factories (plain leaves).
3. `render-schema.tsx` — `createCreditApplicationRenderSchema(form, onSubmit)` returns a `RenderSchemaProxy<CreditApplicationForm>`. Wraps the `FormWizard` step bodies as `RenderNode` subtrees with `path.X` references (Patch J). Each conditional sub-section has a `selector`. Internal item components for FormArraySection are FC (`ComponentType<{ control: FormProxy<T> }>`) using `path.<arr>` as control.
4. `data-fixture.ts` — `happyPathFixture` (consumer loan, no arrays).
5. `index.tsx` — page component: `useMemo` form, `useMemo` schema, conditional `useEffect` blocks for each form-flag → `setHidden` orchestration, "fill-fake-data" button, render via `<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />`.

## Step → fields map

| Step | Title | Fields (all from spec) |
|---|---|---|
| 1 | Кредит | loanType, loanAmount, loanTerm, loanPurpose, [propertyValue, initialPayment if mortgage], [carBrand, carModel, carYear, carPrice if car], interestRate, monthlyPayment |
| 2 | Данные | personalData.{lastName, firstName, middleName, birthDate, gender, birthPlace}, passportData.{series, number, issueDate, issuedBy, departmentCode}, inn, snils, fullName, age |
| 3 | Контакты | phoneMain, phoneAdditional, email, emailAdditional, registrationAddress.{region, city, street, house, apartment, postalCode}, sameAsRegistration, [residenceAddress.* if !sameAsRegistration] |
| 4 | Работа | employmentStatus, [company* if employed], [business* if selfEmployed], workExperience{Total,Current}, monthly/additionalIncome, additionalIncomeSource, totalIncome, paymentToIncomeRatio |
| 5 | Доп. инфо | maritalStatus, dependents, education, hasProperty + properties[], hasExistingLoans + existingLoans[], hasCoBorrower + coBorrowers[], coBorrowersIncome |
| 6 | Подтверждение | agreePersonalData, agreeCreditHistory, agreeMarketing, agreeTerms, confirmAccuracy, electronicSignature |

## Risks

- TS2589 deep-nesting risk on `coBorrowers[].personalData.*` — FC item-component pattern extracts the `control` proxy and avoids deep cast.
- `useEffect setHidden` ordering — depends on schema being created before first useEffect runs. `useMemo` for schema runs synchronously during render, useEffect runs after commit; `setHidden` after first paint is fine — initial section state is "visible by default", flips after mount.

## testIds

- All inputs: `data-testid="step{N}.<dotted.path>"` via `componentProps.testId`
- FormArray items inherit testIds from the FC item-component
- Wizard chips/nav from ui-kit FormWizard (auto)
- Fill button: `data-testid="fill-fake-data"`
