# Dev Report — MCP Credit Application v8 (target=core)

**Status:** Complete. `npx tsc --noEmit` exits 0.

## Wizard implementation pair

| Slot | Choice | Rationale |
|---|---|---|
| **A** (wizard root) | **A1** — `FormWizard` from `@reformer/ui-kit/form-wizard` | `@reformer/ui-kit` is in `react-playground/package.json` workspace deps. Iter-8 task brief states A1 is real after ui-kit Path C migration. Imports verified: `import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard'` and `import type { FormWizardHandle } from '@reformer/cdk/form-wizard'`. |
| **B** (conditional sub-sections) | **B1** — JSX-conditional sub-sections inside step bodies | Mandatory for target=core (no RenderSchema). Each `Step*Body` FC reads flag fields via `useFormControlValue` and conditionally renders sub-blocks (`isMortgage`, `isCar`, `isEmployed`, `isSelfEmployed`, `!sameAsRegistration`, `hasProperty`, `hasExistingLoans`, `hasCoBorrower`). Behavior schema's `enableWhen({ resetOnDisable: true })` handles disable+reset for individual leaves; visibility is JSX-driven. |

## Patches verified

- **Patch G (FormWizard hierarchy A1)** — done. `FormWizard` from `@reformer/ui-kit/form-wizard` accepts `form`, `config={ stepValidations, fullValidation }`, `steps[]`, `onSubmit`. Submit flow uses `navRef.current?.submit(handler)`, returns mock `{ id, ok }` payload, alerts on success/failure. `STEPS` array uses `{ number, title, icon, body }` with `body` = `FC<{ control: FormProxy<CreditApplicationForm> }>`.
- **Patch H (camelCase componentProps)** — done. Every computed-field `componentProps` uses `readOnly: true` (camelCase), not `readonly`. Search confirms: `interestRate`, `monthlyPayment`, `fullName`, `age`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`, plus mortgage `initialPayment` (computed override).
- **Patch I (computeFrom group subscription)** — done. `fullName` and `age` computeFrom subscribe to `[path.personalData]` (group node), not individual leaves; computeFn destructures `{ personalData }` and reads `personalData.lastName/firstName/middleName/birthDate`. No `as never` casts. `coBorrowersIncome` similarly subscribes to the ArrayNode `[path.coBorrowers]` and iterates the plain array of items.
- **D1 (no `r.map` crash)** — done. Every `Select` and `RadioGroup` field in `formSchema`, `personalDataSchema`, `propertyItemSchema`, `existingLoanItemSchema`, `coBorrowerItemSchema` carries `options` in `componentProps`. Constants live at top of `schema.ts` (`LOAN_TYPE_OPTIONS`, `EMPLOYMENT_STATUS_OPTIONS`, `MARITAL_STATUS_OPTIONS`, `EDUCATION_OPTIONS`, `GENDER_OPTIONS`, `PROPERTY_TYPE_OPTIONS`, `RELATIONSHIP_OPTIONS`, `EXISTING_LOAN_TYPE_OPTIONS`).
- **D3 (FormArray plain leaves)** — done. Item factories `createPropertyItem()`, `createExistingLoanItem()`, `createCoBorrowerItem()` return plain typed primitives matching `PropertyItem` / `ExistingLoanItem` / `CoBorrowerItem`. `<FormArraySection initialValue={createPropertyItem()} />` (etc.) — never `FieldConfig` objects.
- **B (no `extends FormFields` on union-literal leaves)** — done. `PersonalData.gender: Gender`, `PropertyItem.type: PropertyType`, etc. are plain interfaces; no `extends FormFields` on union-typed shapes. TS structural typing satisfies `FormFields` constraint via `createForm<CreditApplicationForm>`.
- **`enableWhen` not used on ArrayNode** — done. The three array-flag controls (`hasProperty`, `hasExistingLoans`, `hasCoBorrower`) use Checkbox + JSX-conditional rendering (`hasItems` prop on `FormArraySection`); the behavior schema clears the array via `watchField(flag, { immediate: false })` with length-guard.
- **Cycle prevention** — done. All `watchField` calls use `{ immediate: false }`. Array-clear watchers guard via `cur.length > 0` before calling `clear()`. computeFrom chains stay one-directional (`interestRate` → `monthlyPayment`; `monthlyIncome+additionalIncome` → `totalIncome` → `paymentToIncomeRatio`).

## What works

- Form initialization via `createCreditApplicationForm()` returns `FormProxy<CreditApplicationForm>` with all 50+ fields, 6 sub-form groups (`personalData`, `passportData`, `registrationAddress`, `residenceAddress` + 3 ArrayNode templates), 3 ArrayNodes (`properties`, `existingLoans`, `coBorrowers`).
- Multi-step navigation via `<FormWizard config={{ stepValidations: STEP_VALIDATIONS, fullValidation }} ... />` with per-step validation gating Next, full validation on Submit.
- Conditional sub-sections render correctly for: mortgage block on Step 1, car block on Step 1, employed block on Step 4, selfEmployed block on Step 4, residenceAddress on Step 3 (when `sameAsRegistration === false`), three FormArrays on Step 5 driven by `hasProperty`/`hasExistingLoans`/`hasCoBorrower`.
- Computed cascade: `interestRate` (rate-table by loanType) → `monthlyPayment` (annuity formula) → `paymentToIncomeRatio`. Independent: `fullName`, `age`, `totalIncome`, `coBorrowersIncome`, `initialPayment` (20% of propertyValue).
- copyFrom: `registrationAddress` → `residenceAddress` when `sameAsRegistration === true`.
- Dev-only fill button (`data-testid="fill-fake-data"`) calls `form.setValue(happyPathFixture)` to fill consumer-loan happy-path values; orchestrator can press it once and walk through all 6 steps to submit.
- Submit handler: `navRef.current?.submit(...)` runs `fullValidation`, returns mock `{ id, ok }` on success, alerts in both branches.

## Files produced

- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v8\dev-plan.md`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v8\types.ts`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v8\schema.ts`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v8\data-fixture.ts`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v8\index.tsx`
- `D:\Work\ReFormer\projects\react-playground\src\pages\examples\mcp-credit-application-v8\dev-report.md`

## tsc result

```
cd projects/react-playground && npx tsc --noEmit
exit 0
```

No TS errors, no TS2589 hit, no `as never` casts needed.

## Gaps / out-of-scope (per task brief)

- Async fetch behaviors: `carModels` async load on `carBrand` change, `cities` async load on `region` change — dropped (spec marks as "Динамическая загрузка", but iter-8 brief says skip).
- Warning-level validators (`paymentToIncomeRatio > 40%`, `age > 60`, `workExperienceCurrent < 3`) — dropped per brief.
- `mode='view'` (read-only entire form) — dropped per brief.
- Async electronicSignature validation against backend — replaced with sync `pattern(/^\d{6}$/)`.
- Cross-field validators (initialPayment ≥ 20% of propertyValue, loanAmount ≤ propertyValue − initialPayment, age 18–70, paymentToIncomeRatio ≤ 50%) — not implemented in iter-8 to keep validation-cycle surface minimal; simple per-field min/max only.
- `revalidateWhen` on dependent computed pairs (loanAmount ↔ totalIncome, etc.) — out of scope for iter-8.
- Real `interestRate` formula factoring region + hasProperty + properties — simplified to `ratePerLoanType(loanType)` to avoid wiring deeper computeFrom dependencies in iter-8.

## Notes for next iteration

- If iter-9 reintroduces async fetches, `carBrand` watcher needs `{ immediate: false, debounce: 300 }` and write via `ctx.form.carModel.updateComponentProps({ options: ... })`.
- `Select` for `carModel` may want async resource binding — currently kept as plain `Input` to avoid empty-options crash.
- `paymentToIncomeRatio` cross-field validation will need `validateTree` with `targetField: 'monthlyPayment'`; document Patch I rule when computeFn reads from group nodes.
