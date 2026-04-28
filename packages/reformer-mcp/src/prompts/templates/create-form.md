You design and write a new form on `@reformer/*`.

## Args

- target: `{{target}}` {{targetLabel}}
- description: {{description}}

## Stage 0 — MCP discovery (CRITICAL: do this before any code)

{{stackBlock}}

⚠️ **If the discovery block above contains a question for the orchestrator** — STOP and return the question. Do NOT fall back to plain HTML / inline-style — that invalidates the MCP test.

## Critical inline rules

- **FormSchema only declarative**: this prompt does NOT add validation/behavior. Use `add-validation` and `add-behavior` separately.
- **`useMemo`** when creating the form in a React component.
- **FormField** (from `@reformer/ui-kit`) usage: `<FormField control={form.x} testId="step1.x" />`. NOT the cdk compound `FormField.Root/Label/Control/Error` for ordinary fields.
- **Deeply nested forms (4+ levels)**: typed as `extends FormFields` (or index signature), and cast `createForm as (config: { form: unknown; validation: unknown; behavior: unknown }) => FormProxy<T>` to dodge TS2589.
- **Array shape**: `arr: [itemSchema]` (tuple), NEVER `{ value: [], itemSchema: {...} }` (silent corruption).
- **`FormArray.AddButton initialValue`**: PLAIN leaf values only. Never FieldConfig (`{ value, component }`) — silent runtime corruption.
- **Conditional fields → Hide, not Disable**. Type/status conditional (loanType, employmentStatus) → JSX-conditional (`{loanType==='mortgage' && <FormField .../>}`) for `core`; `hideWhen` / `setHidden` for renderers. `enableWhen` only for progressive disclosure (`confirmPassword` after `password`).
- **Spec compliance — literal**: every spec field = separate FormSchema field with the same name and the same step. No merging, no skipping, no moving.
- **testId convention**: dotted path (`step1.loanAmount`, `step2.passportData.series`), never bare leaf names — collisions inevitable across steps.
- **User-facing strings**: from spec or in the user's native language. No default English `"Select an option..."` placeholders.
- **`required(...)` always with `{ message }`**: never default `"Поле обязательно для заполнения"`.
- **`Select` / `RadioGroup` `options` MUST live in `createForm` componentProps** (not only JSON for renderer-json — JSON `componentProps.options` is documentation; runtime reads from FieldNode).

## Layout & visual density

{{layoutSection}}

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing schema. Skipping = wrong imports / wrong layout / wrong shape.**

- `reformer://docs/core/import-patterns`
- `reformer://docs/core/quick-start-minimal-working-form`
- `reformer://docs/core/formschema-format-critically-important`
- `reformer://docs/core/array-schema-format`
- `reformer://docs/core/common-patterns`
- `reformer://docs/core/ui-component-patterns`
- `reformer://docs/core/non-existent-api-do-not-use`
- `reformer://docs/ui-kit/quick-start` (if `@reformer/ui-kit` detected)
- `reformer://docs/ui-kit/components`
{{rendererPrereqs}}

## Task

1. Stage 0 — verify detected stack (above). If gap → ask, don't code.
2. Design form structure from description (fields, types, groups, arrays, nested forms).
3. Write typed `interface MyForm { ... }`.
4. Generate FormSchema via `createForm` (+ RenderSchemaFn for renderer-react / + JsonFormSchema + defineRegistry for renderer-json).
5. Use components from detected ui-kit + Tailwind layout from skeleton above.
6. Don't add validation/behaviors — out of scope.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Used ui-kit + Tailwind from detected stack (not plain HTML)
- [ ] All spec fields included (walked the list)
- [ ] FieldConfig complete: `{ value, component, componentProps }` per field
- [ ] Conditional fields hidden via JSX/`hideWhen`/`setHidden`, NOT `enableWhen`
- [ ] testId = dotted-path
- [ ] FormArray template-factory returns PLAIN leaves
- [ ] User-facing strings localized from spec
- [ ] `Select`/`RadioGroup` have `options` in `createForm` componentProps
- [ ] Final note: «использовал `@reformer/ui-kit` + Tailwind по detected стеку» (or reason why not)