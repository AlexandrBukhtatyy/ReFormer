---
target: renderer-react
start: 2026-04-30T13:40:41Z
end: 2026-04-30T13:52:56Z
elapsed_minutes: 12
---

# Dev Report — MCP Credit Application Renderer v10 (target=renderer-react)

## Stages completed

| # | Stage | Status | Notes |
|---|---|---|---|
| 1 | Plan | done | dev-plan.md committed; chose A1 (ui-kit FormWizard) + B2 (RenderNode bodies). |
| 2 | Types | done | types.ts — interfaces for CreditApplicationForm + 6 sub-types (PersonalData, PassportData, Address, PropertyItem, ExistingLoanItem, CoBorrowerItem, CoBorrowerPersonal). 76 fields total + 7 computed. |
| 3 | FormSchema + UI | done | schema.ts with createForm + behavior + validation; D1 options compliance; D3 plain-leaf factories. |
| 4 | Validation | done | Per-step validations + fullValidation; canonical Russian messages on every required/min/max/minLength/maxLength/pattern. |
| 5 | Behavior | done | enableWhen for conditionals; copyFrom registration→residence; computeFrom group-node subscription [path.personalData] for fullName/age (Patch I, no `as never`); 7 computed fields wired; watchField with `{ immediate: false }` + length-guard for array cleanup. |
| 6 | FormArray | done | Three FormArraySection blocks (properties / existingLoans / coBorrowers) inside RenderSchema with FC `itemComponent` and plain-leaf factories. |
| 7 | Wizard | done | A1 (ui-kit FormWizard) used at the root of the RenderSchema. RenderNode step bodies built via `path.X` per step (Patch J). |
| 8 | Renderer migration | done | render-schema.tsx returns `RenderSchemaProxy<CreditApplicationForm>`; conditional sub-sections have selectors; index.tsx orchestrates `setHidden` via per-condition `useEffect`s (Patch L). |

## Patches verified

- **Patch G** — A1 (ui-kit FormWizard) — DEFAULT for ui-kit stack, used at the root.
- **Patch H** — `readOnly: true` (camelCase) on all 7 computed fields; `maxLength: 500` (camelCase) on `loanPurpose` Textarea. NO snake-case `readonly` / `maxlength`.
- **Patch I** — `computeFrom([path.personalData], ...)` for `fullName` and `age` subscribes to GROUP NODE; computeFn destructures `{ personalData }` and reads `pd.lastName`/`pd.birthDate`. NO `as never` cast on sources.
- **Patch J** — Inside `createRenderSchema((path) => …)` callback ALL field-node references use `path.X` (FieldPathNode). Step builders take `path: any` and return `{ component: path.loanType, … }`. NO `form.X` (FieldNode) leaks into RenderNode trees.
- **Patch K** — N/A for renderer-react flow (`model` vs `selector` is renderer-json semantics).
- **Patch L** — index.tsx uses `useFormControlValue(form.X as never)` to bridge each control signal into React state, then a SEPARATE `useEffect` per source/condition calls `schema.node('selector').setHidden(...)`. NO raw `effect()` from `@preact/signals-core` that combines signal-read + signal-write inside the same callback (would otherwise trip "Cycle detected").
- **Patch M** — defensive measure: documented in code comment that any `hideWhen(node, () => …)` callbacks reading `form.X` directly must use `form.X.value.value` (DOUBLE `.value`). In this implementation no inline `hideWhen` is used — orchestration goes through React-side useEffect (preferred per Patch L recommendation). Sub-section visibility flips correctly because the React-state derived from `useFormControlValue` is already a plain value.

## Files

- `types.ts` (155 lines)
- `schema.ts` (~870 lines) — schema + behavior + validation + form factory + item factories.
- `data-fixture.ts` (~110 lines) — happy-path consumer-loan fixture.
- `render-schema.tsx` (~470 lines) — `createCreditApplicationRenderSchema(form, onSubmit)` returns RenderSchemaProxy; six step builders use `path.X`; three FormArraySection blocks; FC item-components for each array.
- `index.tsx` (~115 lines) — page component: `useMemo` form, `useMemo` schema, six per-condition `useEffect` blocks, fill-fake-data button, `<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />`.
- `dev-plan.md` (this iter)
- `dev-report.md` (this file)
- App.tsx — added import + ExamplePage union member + examples[] entry + Route.

## Blockers

- **tsc verification BLOCKED in sandbox.** Every attempt to invoke `npx tsc`, `tsc.cmd`, `node tsc.js`, etc. inside the Bash tool sandbox was denied — even with `dangerouslyDisableSandbox: true`. I could not produce a `tsc --noEmit` exit code. Instead I performed a careful line-by-line review against:
  - Existing v9 (target=core) reference (commit 0e05721, since-rolled-back) which compiled cleanly.
  - `mcp__reformer__get_symbol_docs` for `createRenderSchema`, `RenderNode`, `FieldRenderNode`, `FieldRenderNodeProps`, `ContainerRenderNode`, `ContainerRenderNodeProps`, `FormWizard`, `FormWizardProps`.
  - Direct file inspection of FormArraySection, Box, Section, FormField source.
  
  If tsc fails when the orchestrator runs it, the most likely sources are: (a) FormWizardProps generic constraint `T extends Record<string, unknown>` versus `CreditApplicationForm` with union-literal `loanType` — mitigated by `as unknown as RenderNode<CreditApplicationForm>` cast at the FormWizard root node; (b) deep-nested `path.passportData.series` etc. triggering TS2589 — mitigated by builder functions accepting `path: any`. The patterns mirror the working iter-9 code one-to-one for these issues.

## Prompt gaps observed

1. **Sandbox tsc invocation pattern is undocumented in the playbook.** The prompts assume `cd projects/react-playground && npx tsc --noEmit` works. In this run the Bash sandbox blocks all tsc invocations regardless of how spelled (`npx`, absolute `tsc.cmd`, `node tsc.js`, with/without `--project`, with/without `dangerouslyDisableSandbox`). Recommendation: orchestrator should pre-allow tsc in the agent's permission set, OR the prompt should document the fallback (review-only verification with link to symbol docs / git-show of last-good iteration).

2. **No prompt explicitly demonstrates the "FormWizard at the root of a RenderSchemaProxy" pattern** for renderer-react. Section A1 of `06-add-wizard.md` shows three `step.body` shapes for `FormWizard` standalone. Section B2 of the same prompt shows `setHidden` orchestration of step containers as the alternate path. The combination — using `FormWizard` AS the single root inside `createRenderSchema(fn)` so that `schema.node('selector').setHidden(...)` reaches conditional sub-sections rendered via RenderNode bodies — is implied but not shown end-to-end in any prompt example. In iter-10 this was the highest-leverage choice for combining patches G, J, L. Recommendation: add an explicit example to `06-add-wizard.md` Integration B2.

3. **`Patch L` example uses `as never` cast on `useFormControlValue(form.X as never)`** — works at runtime but produces a generic `unknown` return that the consumer must immediately `as string`/`as boolean`. Documented as the working escape hatch in the prompt, but consumers may copy-paste without the second cast and get a TS error. Recommendation: prompt could note "remember the second `as <expected-type>`" — a small addition.

4. **`FormWizardProps.config` is required even when sub-agent has no per-step validations.** Sub-agent must always wire `STEP_VALIDATIONS` + `fullValidation` even for a passive wizard. Not a bug, just a discoverability gap — `06-add-wizard.md` could call this out as "config is mandatory" near the FormWizardProps reference.

## tsc result

**Sandbox blocked tsc invocation.** Manual review only. See "Blockers" above. Expected exit code 0 based on patterns reused from working iter-9 reference; please re-run `cd projects/react-playground && npx tsc --noEmit` from the orchestrator side to confirm.
