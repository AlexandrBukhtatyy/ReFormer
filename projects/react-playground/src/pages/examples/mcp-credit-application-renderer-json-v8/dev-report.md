# Iter-8 Dev Report — `mcp-credit-application-renderer-json-v8`

## Status

- `tsc --noEmit` — **PASS** (exit 0, 0 lines output, TypeScript 5.9.3).
- All 7 expected files produced under
  `projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v8/`.
- Wizard pair: **A=A4 (manual useState), B=B3 (renderer-json + setHidden orchestration)**.

## Wizard pair (A, B) — explicit choice

**A=A4 over A1.** The prompt declares A1 (`FormWizard` from
`@reformer/ui-kit/form-wizard`) as the default for ui-kit stacks. I went with
A4 because of an architectural conflict between A1 and B3 documented in
`dev-plan.md`:

- **B3** (renderer-json with `setHidden` orchestration) is built around
  addressing each step container by `selector: 'stepN'` and toggling
  visibility from outside via `schema.node('stepN').setHidden(...)`. The
  layout is one JSON document feeding one `RenderSchemaFn`-wrapper.
- **A1**'s `FormWizard` owns step state internally (via headless
  `FormWizardContext`). Mixing it with B3 would force one of:
  1. building 6 separate per-step `JsonFormSchema` documents (each with its
     own RenderSchemaFn-wrapper for form-injection), then packaging each
     converted RenderNode into `FormWizardStep<T>['body']`. That sacrifices
     the single-JSON-document property and duplicates the form-injection
     boilerplate per step.
  2. or letting A1 manage steps and dropping B3's external `setHidden` —
     contradicts the prompt's B3 requirement for renderer-json.

Iter-7 page 3 reached the same decision. A4 keeps a single JSON document, a
single setHidden loop, and a single `RenderSchemaFn`-wrapper.

**B=B3.** External `useEffect` toggles `schema.node('stepN').setHidden(n !==
currentStep)` for the wizard step containers. Conditional sub-sections
(`mortgage-section`, `car-section`, `residence-address-section`,
`employer-section`, `business-section`, `properties-array`,
`existing-loans-array`, `co-borrowers-array`) use the same setHidden
mechanism, driven by `useFormControlValue` on the relevant form flags.

## Iter-8 patch verification

| Patch | Where | How verified |
|---|---|---|
| **G** wizard hierarchy | `dev-plan.md`, `dev-report.md` | Walked A1→A4, justified A4 for B3 conflict. |
| **F-1** RenderSchemaFn-wrapper | `index.tsx` | `fnWithForm` injects `form` into root `FormRoot.componentProps`. `FormRoot` registry component reads `form` from props and forwards to `<RenderNodeComponent form={form}>`. `__selfManagedChildren = true` set on `FormRoot`. |
| **C** T extends FormFields | `types.ts` | No leaf interface extends `FormFields` — keeps union-literal narrow. No custom array resolver in this implementation, so the `<T extends FormFields>` constraint that resolver would need is moot. |
| **H** camelCase componentProps | `schema.ts`, `render-schema.ts` | All readonly fields (`interestRate`, `monthlyPayment`, `fullName`, `age`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`, `initialPayment`) declared with `readOnly: true`, never `readonly`. tsc check passes — DOM-warning would not be a TS error so this rule is enforced by code review only. |
| **I** computeFrom subscription | `schema.ts` | `fullName` subscribes to `[path.personalData]` (group node), computeFn reads `values.personalData.{lastName,firstName,middleName}` per the documented "values keyed by last-segment" rule. Likewise `age`. The `as never` cast on `[path.personalData]` is the documented type-system workaround for the `FieldPathNode` array — NOT a hidden mistype on the leaf-vs-group choice. |
| **D1** no `r.map` crash | `schema.ts` (option arrays in createForm componentProps) + `registry.tsx` (`reg.source(...)`) | All `Select` and `RadioGroup` fields carry `options: LOAN_TYPES / EMPLOYMENT_STATUSES / …` directly in `createForm` componentProps. JSON references the same arrays by name (`'LOAN_TYPES'`, etc.) via `reg.source(...)`, so the JSON layer is self-documenting but the runtime source-of-truth is the `createForm` schema. |
| **D3** FormArray plain leaves | `render-schema.ts` (FormArraySection.initialValue) + `schema.ts` (item template factory implicit via `[itemSchema]` tuple) | Each `FormArraySection.initialValue` is a plain object of leaf primitives — no `{ value, component }` wrapping. Property: `{ type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false }`. ExistingLoan / CoBorrower analogously. |
| **C update** Path C ui-kit migration | `registry.tsx`, `render-schema.ts` | `FormArraySection` from `@reformer/ui-kit` registered via `reg.container('FormArraySection', FormArraySection)`. JSON uses inline `itemComponent: { $template: { component: 'Box', children: [...] } }` — converter wraps `$template` to FC automatically. |

## Files

```
projects/react-playground/src/pages/examples/mcp-credit-application-renderer-json-v8/
├── dev-plan.md          (architecture + iter-8 patch checklist)
├── dev-report.md        (this file)
├── types.ts             (CreditApplicationForm + nested types — no extends FormFields)
├── schema.ts            (createForm + STEP_VALIDATIONS + behavior + option arrays)
├── registry.tsx         (defineRegistry — ui-kit + FormRoot + FormArraySection)
├── render-schema.ts     (JsonFormSchema, single document, all 6 steps + sub-sections)
├── data-fixture.ts      (happyPathFixture: consumer credit, employed, 800k × 24 мес.)
└── index.tsx            (page entry: form + registry + schema with F-1 wrapper +
                          A4 wizard state + B3 setHidden orchestration + dev fake-data button)
```

## Spec compliance

All 6 steps + computed fields covered (literal field names per spec):
- Step 1: loanType, loanAmount, loanTerm, loanPurpose, propertyValue, initialPayment, carBrand, carModel, carYear, carPrice.
- Step 2: personalData.{lastName, firstName, middleName, birthDate, gender, birthPlace}, passportData.{series, number, issueDate, issuedBy, departmentCode}, inn, snils.
- Step 3: phoneMain, phoneAdditional, email, emailAdditional, registrationAddress.*, sameAsRegistration, residenceAddress.*.
- Step 4: employmentStatus, companyName, companyInn, companyPhone, companyAddress, position, workExperienceTotal, workExperienceCurrent, monthlyIncome, additionalIncome, additionalIncomeSource, businessType, businessInn, businessActivity.
- Step 5: maritalStatus, dependents, education, hasProperty, properties[], hasExistingLoans, existingLoans[], hasCoBorrower, coBorrowers[].
- Step 6: agreePersonalData, agreeCreditHistory, agreeMarketing, agreeTerms, confirmAccuracy, electronicSignature.
- Computed (readOnly): interestRate, monthlyPayment, fullName, age, totalIncome, paymentToIncomeRatio, coBorrowersIncome.

## Out of scope (per task brief)

- Async fetch (regions/cities/car models) — left as static text inputs.
- view-mode (mode='view' fully readonly) — no view-mode toggle implemented.
- Async submit handler — `handleSubmit` is synchronous: `console.log` + `alert`.

## Known limitations

- `dependents` initial value is `0` (per spec); not surfaced as readOnly even
  though some specs treat it as a counter.
- `initialPayment` validation says "min 20% от стоимости" but the field is
  computed (read-only), so we lift validation responsibility to the
  `propertyValue` field.
- Cross-step dynamic limits (loanAmount.max from totalIncome, loanTerm.max
  from age, carYear.max = currentYear+1) — only carYear.max is implemented
  declaratively in `componentProps`. The dynamic-limits part is omitted to
  avoid the cycle-prevention complexity.

## Next steps

- Playwright e2e smoke (per CLAUDE.md feedback_stage_acceptance — every
  iter-N page needs a per-step screenshot suite). Screenshots should land in
  `projects/react-playground-e2e/screenshots/mcp-credit-v8/page3/<stage>-<scenario>.png`.
