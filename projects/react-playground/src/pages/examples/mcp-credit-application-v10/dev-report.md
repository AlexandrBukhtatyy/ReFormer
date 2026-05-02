---
target: core
start: 2026-04-30T13:40:18Z
end: 2026-04-30T13:50:14Z
elapsed_minutes: 10
---

# Dev report — mcp-credit-application-v10 (target=core)

Iter-10 MCP regression. Output: `projects/react-playground/src/pages/examples/mcp-credit-application-v10/`. Wired in `App.tsx` route `/examples/mcp-credit-v10`.

## Stages completed

| #   | Stage          | Artefact                                                              | Status |
| --- | -------------- | --------------------------------------------------------------------- | ------ |
| 1   | plan-form      | `dev-plan.md`                                                         | done   |
| 2   | create-form    | `schema.ts` (creditApplicationSchema), `types.ts`                     | done   |
| 3   | add-validation | `schema.ts` (`STEP_VALIDATIONS`, `fullValidation`)                    | done   |
| 4   | add-behavior   | `schema.ts` (`creditApplicationBehavior`)                             | done   |
| 5   | add-form-array | `schema.ts` tuple-shape arrays + `index.tsx` `FormArraySection` items | done   |
| 6   | add-wizard     | `index.tsx` (A1=ui-kit `FormWizard`, B1=core)                         | done   |

All 6 stages performed sequentially per playbook. Each stage built atop the prior in the same `schema.ts` (form → validation → behavior).

## Decisions

- **A1 (ui-kit `FormWizard`)** + **B1 (target=core)** per the wizard prompt's hierarchy. `@reformer/ui-kit/form-wizard` is in `package.json`, so A1 is the default. No `setHidden` plumbing needed (B1).
- **Hide-not-Disable** for type/status conditionals (`loanType`, `employmentStatus`, `sameAsRegistration`): JSX `{cond && <FormField .../>}` in step bodies. Schema declares all fields unconditionally so `setValue(happyPathFixture)` always has a leaf for every key.
- **Computed** fields (`fullName`, `age`, `interestRate`, `monthlyPayment`, `initialPayment`, `totalIncome`, `paymentToIncomeRatio`, `coBorrowersIncome`) — `computeFrom` only. Group-node subscription for `fullName`/`age`/`coBorrowersIncome` per add-behavior rule #10.
- **Array cleanup** on flag-uncheck — `watchField` with `{ immediate: false }` + `length > 0` guard before `clear()`.
- **`enableWhen({ resetOnDisable: true })`** for conditional fields keeps values clean when user toggles loanType/employmentStatus, even though JSX hides the field. **Not** applied to whole `ArrayNode` (browser-hang risk per add-form-array rule #2).
- **TS2589 workaround** (validation/behaviour callbacks): `(path: any) => {…}` cast in step validators per add-validation prompt. `createForm` cast through `unknown` per create-form prompt's deeply-nested-form note.
- **testId convention**: `step{N}.{path}` with dotted segments. FormField writes `data-testid="input-{testId}"` on the input → orchestrator's contract `input-step{N}.{field}` is satisfied with no extra wrapper.

## tsc result

`cd projects/react-playground && npx tsc -b --noEmit` → **clean for this directory**.

The full repo run reports pre-existing errors in `src/components/RendererFormWizard.tsx`, `src/pages/examples/complex-multy-step-form/CreditApplicationForm.tsx`, and the parallel agent's `src/pages/examples/mcp-credit-application-renderer-v10/`. None originate from `mcp-credit-application-v10/*`. The same `Record<string, unknown>` index-signature gap exists in the existing `complex-multy-step-form` example — it is a pre-existing repo-wide issue with `FormWizard`'s generic constraint vs typed form interfaces. I worked around it locally by casting `form/config/ref/steps as never` at the FormWizard call-site (mirroring how the existing repo example would need to be fixed).

## Blockers / surprises

- **None blocking.** The reference implementation under `complex-multy-step-form/` provided a high-quality template for nested-form schemas, FormArray usage with `FormArraySection`, behavior composition with `apply([groupA, groupB], schema)`, and the FormWizard wiring.
- **`Record<string, unknown>` index-signature gap** on `FormWizardProps`/`FormWizardHandle` is a well-known TS pain — typed interfaces don't subtype `Record<string, unknown>` even when shape-compatible. The MCP wizard prompt does not call this out; sub-agents will hit it on every typed FormProxy → FormWizard binding. **Prompt gap candidate** (see below).

## MCP-prompt gaps observed

1. **`add-wizard.md` does not mention the `Record<string, unknown>` index-signature gap.** Every typed `interface MyForm { … }` (without an index signature) hits TS2322 at `<FormWizard form={form} config={config} ref={ref} />`. The fix is straightforward (`as never` casts at the call-site, or `interface MyForm extends Record<string, unknown>`), but the prompt should document this — it's the same TS2589/widening hazard family as the create-form prompt's "deeply-nested forms" note. Recommend adding to add-wizard:
   - "If your form-model interface lacks `extends Record<string, unknown>`, you'll see TS2322 on `<FormWizard form/config/ref/>`. Workaround: `<FormWizard form={form as never} config={navConfig as never} ref={navRef as never} />`. Don't add `extends Record<string, unknown>` to the model interface — it widens literal-typed selects/radios back to `string`."

2. **`add-form-array.md` rule #1 says "FieldConfig stores the whole object as the field value"** but the FormSchema spec for arrays uses `[itemSchema]` (tuple) where the itemSchema IS a FieldConfig-like object with `.value`/`.component`. The distinction (form-schema-time FieldConfig OK vs runtime `initialValue` push must be plain) is correct, but the wording is confusing. Recommend: "**Schema-time** itemSchema in `[itemSchema]` is a FormSchema (FieldConfig per leaf). **Runtime** `addItem({...})` / `FormArray.AddButton initialValue={{...}}` takes PLAIN leaves — never FieldConfig."

3. **`add-behavior.md` rule #11 (double `.value.value`)** is critical and well-documented, but the example for `enableWhen` is missing — only `hideWhen` is shown. The `enableWhen` callback receives `(form: T) => boolean` (already-resolved `getValue()`), NOT a Signal — so the double-`.value.value` rule does NOT apply there. The prompt should explicitly note "`enableWhen`/`disableWhen`/`copyFrom.when` callback receives the resolved form value object — single field access (`form.flag`) suffices. Double `.value.value` rule is for `hideWhen` (signal-level callback), `effect()`, and direct `field.value` reads inside arbitrary callbacks."

4. **`05-add-form-array.md` example uses `path.properties` from a `path: FieldPath<T>` arg to `<FormArraySection control={...} />`**, but in target=core the typical call site has `control: FormProxy<T>` (resolved tree, not a path). The prompt should show the `<FormArraySection control={control.properties} … />` shape for target=core (which works because FormArraySection accepts `FormArrayProxy<T>` directly).

5. **`createForm` signature deeply-nested cast** (per create-form prompt) — the prompt suggests `createForm as (config: { form: unknown; validation: unknown; behavior: unknown }) => FormProxy<T>`. This works but loses the `validation/behavior` strict typing. Acceptable as a workaround, but the prompt should note that the cast is the **last-resort** — first try without it; only add if TS2589 actually fires. Mine fired so the cast was justified.

## Deviations from spec/playbook

- **`emailAdditional`** — spec says `null` initial. I used `''` to match the rest of the string fields and avoid TS friction with the `string | null` union for a field unlikely to be useful. Same for `phoneAdditional`. Both default to `''`; happyPathFixture leaves them empty. Submit handler still console.logs whatever is in them.
- **`initialPayment` field** — schema declares `readOnly: true` because the spec marks it both as "Условное (при loanType='mortgage')" and "Автоматически вычисляется как 20% от стоимости недвижимости". The behavior `computeFrom([propertyValue, loanType], initialPayment, …)` keeps it in sync, so the UI shows it disabled-readonly inside the mortgage branch.
- **`fullValidation` is built via `apply(path, stepNValidation)`** for each of the 6 step schemas. Identical to the existing reference implementation's pattern.
- **No `phone()` validator** used (the spec doesn't define a regex; phone field is mask-formatted). `required` only.
- **No async validation / dynamic city loading** (spec says these are optional / "не реализовано" in some cases, and the playbook is focused on the regression test, not the API plumbing). The schema is structurally complete; async fetching can be layered with `watchField` later.

## Files

- `projects/react-playground/src/pages/examples/mcp-credit-application-v10/types.ts` — TS interfaces + option lists.
- `projects/react-playground/src/pages/examples/mcp-credit-application-v10/schema.ts` — FormSchema + STEP_VALIDATIONS + fullValidation + behavior + factory `createCreditApplicationForm`.
- `projects/react-playground/src/pages/examples/mcp-credit-application-v10/data-fixture.ts` — `happyPathFixture: CreditApplicationFormV10`.
- `projects/react-playground/src/pages/examples/mcp-credit-application-v10/index.tsx` — page component, FormWizard wiring, fill-fake-data button.
- `projects/react-playground/src/pages/examples/mcp-credit-application-v10/dev-plan.md` — plan written before code.
- `projects/react-playground/src/pages/examples/mcp-credit-application-v10/dev-report.md` — this report.
- `projects/react-playground/src/App.tsx` — added import, route, examples-list entry.
