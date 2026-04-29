# Iter-8 dev-plan — credit-application form (target=renderer-react)

## Source
- Spec: `docs/specs/credit-application-form.md` — read-only.

## Target
- `target=renderer-react`. `createRenderSchema` + `RenderSchemaFn`.
- ui-kit detected → wizard A1 (`FormWizard` from `@reformer/ui-kit/form-wizard`).

## Wizard pair: A=A1, B=B2

### Section A — Wizard implementation hierarchy walk

- **A1 (DEFAULT for ui-kit stacks) — `FormWizard` from `@reformer/ui-kit/form-wizard`**.
  - `@reformer/ui-kit` is in package.json (used everywhere across other examples in this playground).
  - A1 is the explicit default per Patch G (iter-8). Picked.
- A2 — project-custom wizard wrapper (`RendererFormWizard`) exists, but Patch G says A1 is DEFAULT after Path C migration. Skipped.
- A3 — CDK FormWizard compound. Skipped (A1 covers it).
- A4 — manual `useState` wizard. Skipped (last resort).

### Section B — Target integration

- **B2 — `target=renderer-react`** with **A1 ui-kit FormWizard**.
  - Per Patch G + add-wizard prompt: "ui-kit FormWizard's встроенную логику" — pass `step.body: RenderNode<T>` (RenderSchema subtree). FormWizard internally wraps in `<RenderNodeComponent>`.
  - **No manual `setHidden` for step switching** — ui-kit handles it.
  - Conditional sub-sections within steps (mortgage, car, employer-section, business-section, residence-address) keep `selector` IDs and use top-level `hideWhen(...)` after `createRenderSchema(...)`.

## Files

1. `dev-plan.md` (this file).
2. `types.ts` — `CreditApplicationForm`, `Address`, `PersonalData`, `PassportData`, `Property`, `ExistingLoan`, `CoBorrower`. Union literals stay as union literals; no `extends FormFields` on union-leaf interfaces (Patch B / iter-7).
3. `schema.ts` — `creditApplicationSchema` (FormSchema), `creditApplicationBehavior`, `creditApplicationValidation`, `STEP_VALIDATIONS`, `createCreditApplicationForm`. All `componentProps` (label, options, placeholder, mask, rows, type) live in createForm — Patch D + D1 (no `r.map` crash).
4. `render-schema.tsx` — `createCreditApplicationRenderSchema(form)` returns RenderSchemaProxy. Wraps everything in `FormWizard` (ui-kit) with `steps[].body` = RenderNode subtree. Conditional sub-sections via top-level `hideWhen` calls.
5. `data-fixture.ts` — `happyPathFixture: CreditApplicationForm` for dev fill-button.
6. `index.tsx` — page component. Calls `createCreditApplicationForm()` once via `useMemo`, builds schema once via `useMemo`. Renders dev-only fill button + `<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />`.
7. `dev-report.md` — final summary.

## Iter-8 Patch verification

- **Patch G (wizard hierarchy)**: A=A1 picked because ui-kit is in stack (DEFAULT). Stated in render-schema.tsx + dev-report.md.
- **Patch H (camelCase componentProps)**: `readOnly`, NOT `readonly`; `maxLength`, `minLength`. No `htmlFor`/`tabIndex`/`autoFocus` used in this form, but the convention is upheld.
- **Patch I (computeFrom subscription rule)**: `computeFrom([path.personalData], path.fullName, ...)` — group-level subscription. computeFn destructures `{ personalData }`. NO `as never` cast on sources.
- **D1 (no `r.map` crash)**: `options` arrays declared in createForm componentProps for Select/RadioGroup (loanType, gender, employmentStatus, maritalStatus, education, properties[].type).
- **D3 (FormArray plain leaves)**: `initialValue` for `properties`/`existingLoans`/`coBorrowers` AddButton are plain primitives.

## Critical rules from iter-7 honored

- No `extends FormFields` on union-literal leaf interfaces (`PersonalData.gender: 'male' | 'female'`, `Property.type: PropertyType`, etc.).
- All input componentProps in createForm.
- Hide vs Disable: type-conditional fields (mortgage / car / employer / business / residence) → `hideWhen` (not `enableWhen`). `enableWhen` only for sub-section reset semantics inherited from existing form.
- testIds: dotted-path on every leaf field via `componentProps: { testId: 'step1.loanType' }` etc.
- Cycle prevention: every `watchField` has `{ immediate: false }`; `setValue` guards via length comparison; no `enableWhen` on whole `ArrayNode`.
- Conditional sub-sections via `hideWhen(proxy.node('selector'), () => ...)` AFTER `createRenderSchema(...)`.

## Out of scope (per orchestrator)
- Async fetch (carModels / cities / regions).
- Warning-level validators (`warnHighDebtLoad`, `warnSeniorAge`, `warnLowWorkExperience`).
- view-mode.
