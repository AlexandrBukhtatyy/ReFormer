# Iter-9 dev-report — credit-application form (renderer-react)

## Outcome

Form implemented end-to-end against `docs/specs/credit-application-form.md`,
target `renderer-react`, using the iter-9 MCP prompt patches.

`npx tsc --noEmit -p tsconfig.app.json` — **0 errors in
`src/pages/examples/mcp-credit-application-renderer-v9/**`** (verified by
filtering tsc output for the directory). Remaining repo-level errors come from
unrelated baseline files (`src/components/RendererFormWizard.tsx`,
`src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx`) and
from parallel sub-agent iterations (`mcp-credit-application-v9`,
`mcp-credit-application-renderer-json-v9`) that are outside this iteration's
scope.

## (A, B) wizard pair

- **A=A1** — `FormWizard` from `@reformer/ui-kit/form-wizard`. DEFAULT for
  ui-kit stacks (`@reformer/ui-kit` present in `package.json`). Provides the
  step indicator strip + nav buttons + progress bar without manual wiring
  (Patch G + ui-kit Path C).
- **B=B2** — renderer-react. `step.body` is a `RenderNode<CreditApplicationForm>`
  subtree built inside `createRenderSchema((path) => ...)`. ui-kit FormWizard
  detects RenderNode shape and wraps it in `<RenderNodeComponent>` with the
  live `form`. Step switching is owned by ui-kit FormWizard (no manual
  `setHidden('stepN')` loop required).

## Patch validation

| Patch | Status | Evidence |
|---|---|---|
| G + Path C | OK | `import { FormWizard } from '@reformer/ui-kit/form-wizard'` in `render-schema.tsx`; `step.body: RenderNode<...>` polymorphic shape. |
| H — camelCase componentProps | OK | `readOnly: true`, `maxLength: 500` (NOT `readonly`/`maxlength`) throughout `schema.ts`. |
| I — group-node subscription | OK | `computeFrom([path.personalData], path.fullName, ...)` and `[path.coBorrowers], path.coBorrowersIncome, ...` — no `as never` anywhere. |
| J — `path.X` only inside RenderSchema callback | OK | Step bodies (`step1Body(path)` … `step6Body(path)`) accept `path: FieldPath<CreditApplicationForm>`; never `form: FormProxy<...>`. The `form` instance is only injected at the FormWizard root via `componentProps.form`. `hideWhen` predicates outside `createRenderSchema` legitimately use `form.field.value` (those run AFTER schema creation, not inside the callback). |
| D1 — options in createForm | OK | All `Select`/`RadioGroup` `options` declared in `createForm` componentProps in `schema.ts`. |
| D3 — plain-leaf initialValue | OK | `RendererFormArraySection` `initialValue` in render-schema is plain primitives (`type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false` …). No `FieldConfig` wrappers. |

## Key design decisions

- **Numeric leaf types are non-nullable `number`** (matching the existing
  reference form `complex-multy-step-form`). Initial `value: null` is allowed
  by `FieldConfig<T> = { value: T | null; … }`. This dodges a TS2345 cascade
  on `min(...)` / `max(...)` which constrain `TField extends number | undefined`.
- **`createForm` is cast to `(config: { form, behavior, validation }) => FormProxy<T>`** in
  `schema.ts` per the create-form prompt's TS2589 guidance for 4+ level
  nested forms.
- **Conditional sub-section visibility** is wired top-level via `hideWhen(proxy.node('selector'), () => form.field.value …)` AFTER `createRenderSchema(...)` — never inline inside the node config. Selectors used: `mortgage-section`, `car-section`, `residence-address-section`, `employer-section`, `business-section`, `income-section`, `properties-array`, `existing-loans-array`, `co-borrowers-array`, `additional-income-source-section`.
- **Step containers** carry `selector: 'step1'..'step6'` for diagnostics / future per-step orchestration, even though A1 owns step switching internally.
- **`extends FormFields`** is NOT applied to leaf interfaces with union-literal fields (`PersonalData.gender: Gender`, `Property.type: PropertyType`, …) — the index signature would widen the literal back to `string`.
- **testId convention** is dotted-path (`step1.loanAmount`, `step2.passportData.series`, `coBorrower-firstName`) to avoid collisions across steps.

## Out of scope (per task brief)

- Async fetch (regions / cities / car-models dictionaries).
- View-mode (`mode='view'`).
- Warning-level validators (high-debt-load, senior-age, low-experience).
- POST / GET to mock-API.

## Files

1. `dev-plan.md`
2. `types.ts`
3. `schema.ts` (form schema + behavior + per-step + full validation)
4. `render-schema.tsx` (RenderSchema + ui-kit FormWizard + hideWhen wiring)
5. `data-fixture.ts` (`happyPathFixture`)
6. `index.tsx` (page entry + fill-fake-data button)
7. `dev-report.md`

## Fill-fake-data button

`<button data-testid="fill-fake-data">Заполнить тестовыми данными</button>`
calls `form.setValue(happyPathFixture)`. The fixture seeds a consumer-credit
happy path (no mortgage / car / properties / existing loans / co-borrowers),
which is the shortest valid trip through all six steps.
