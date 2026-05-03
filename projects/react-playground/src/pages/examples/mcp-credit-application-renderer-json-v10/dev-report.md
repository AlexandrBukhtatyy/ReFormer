---
target: renderer-json
start: 2026-04-30T20:02:40Z
end: 2026-04-30T20:08:06Z
elapsed_minutes: 6
---

# dev-report — target=renderer-json

## Stages completed

- 01 plan-form — read; produced dev-plan.md.
- 02 create-form — `schema.ts` (copied/adapted from sibling A=core; same `@reformer/core` form factory).
- 03 add-validation — embedded in schema.ts (same as sibling A).
- 04 add-behavior — embedded in schema.ts (same as sibling A).
- 05 add-form-array — `render-schema.ts` uses `FormArraySection` + inline `$template` for properties / existingLoans / coBorrowers.
- 06 add-wizard — A4×B3 pair: `useState(currentStep)` + per-condition `useEffect` `schema.node('stepN').setHidden(...)` in `index.tsx`.
- 07 to-renderer-json — `render-schema.ts` (JsonFormSchema), `registry.tsx` (defineRegistry with FormRoot self-managed root + ui-kit fields/containers + sources).

## Patches verified in output

- **Patch K** — every leaf in `render-schema.ts` uses `model: '<fieldPath>'`, never `selector` for fieldPath. Selectors only mark step containers / conditional sub-sections / array sections.
- **Patch L** — no raw `effect()` from `@preact/signals-core`. All signal→React bridges use `useFormControlValue(form.X as never)` + per-condition `useEffect` in `index.tsx`.
- **Patch M** — N/A in this file: callbacks reading `form.X.value.value` live in `schema.ts` (copied from sibling A) which already follows the rule (`computeFrom`/`copyFrom` use `form.X` indirectly via path subscriptions).
- **Patch G + B3** — RenderSchemaFn-wrapper (`fnWithForm`) injects `form` into root FormRoot componentProps; FormRoot has `__selfManagedChildren = true`.
- **$template** — three array sections use inline `{ $template: ... }` for `itemComponent`.

## Output files

- `types.ts`, `data-fixture.ts`, `schema.ts` — adapted from sibling A.
- `render-schema.ts` — JsonFormSchema with 6 step containers + conditional selectors (`mortgage-section`, `car-section`, `residence-section`, `employed-section`, `business-section`, `properties-section`, `existingLoans-section`, `coBorrowers-section`).
- `registry.tsx` — defineRegistry with FormRoot, ui-kit fields/containers, FormArraySection, FIELD_WRAPPER=FormField, source arrays.
- `index.tsx` — page with B3 wrapper, step orchestration, conditional sub-section setHidden, fill-fake-data button (writes happyPathFixture into form via setValue cascade).
- App.tsx registered.

## tsc result

`cd projects/react-playground && npx tsc --noEmit` → exit 0 (OK).

## MCP-prompt gaps observed

- Playbook 07-to-renderer-json uses `selector: 'fieldPath'` interchangeably with `model:` in some inline examples — Patch K (the reason for this regression iter) is documented in 02-create-form rule "Field references in JSON" but 07 should re-emphasize. Followed Patch K rule strictly.
- Playbook 06-add-wizard B3 example shows useEffect cascade with `for (let n = 1; n <= TOTAL_STEPS; n++)` — single useEffect for step toggling; per-condition splits used for sub-sections. Used both forms.
- `fill-fake-data` is not in playbook — implemented locally as a tree-walker that descends GroupNode/ArrayNode by key and calls `setValue` on leaves; relies on form-proxy ducktype (`.setValue`, `.add`, `.clear`, `.at`, `.length.value`).

## Blockers / not-blockers

- None blocking. tsc clean. Form-array fill-fake-data uses an `add()`-then-`at(i)`-then-recurse pattern; runtime correctness is best verified by playwright (orchestrator).

## Notes

- Did NOT browse package source. Used only 2 MCP tool calls (get_symbol_docs createRenderSchemaFromJson + useFormControlValue, find_recipe overview) — well under the 5-call budget.
- Did NOT touch `docs/specs/`.
