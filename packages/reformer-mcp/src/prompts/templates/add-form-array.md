You add a dynamic field array to a `@reformer/*` form.

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{{code}}
```

## ⚠️ Critical inline rules (silent corruption hazards)

1. **`initialValue` for AddButton/push is ALWAYS plain leaf values** (`string | number | boolean | Date`), NEVER FieldConfig (`{ value, component, componentProps }`). FieldConfig stores the whole object as the field value: Textarea renders `[object Object]`, Checkbox flips `true`. Compiler/tests don't catch it.

   ```typescript
   // ❌ silent corruption
   () => ({ type: { value: 'x', component: Select } })
   // ✅
   () => ({ type: 'x', description: '', estimatedValue: 0 })
   ```

2. **Never `enableWhen({ resetOnDisable: true })` on a whole ArrayNode** — browser hang. Conditional array visibility = JSX conditional or `setHidden`.

3. **renderer-react Checkbox in array item**: don't wrap in `CdkFormField.Label` — Checkbox draws its own label, double-rendered otherwise. Pass label via `componentProps.label`.

4. **FormSchema array shape = tuple**: `arrField: [itemSchema]`, NEVER `{ value: [], itemSchema: {...} }` (silent corruption).

5. **Element access**: `form.<arr>.at(i)` (NOT brackets), `.length.value`, `.items.value`. Mutations: `add`, `removeAt`, `insert`, `move`, `clear` — never mutate `.items` directly.

6. **renderer-react self-managed FormArray block**: must resolve `FieldPath → ArrayNode` via `FieldPathNavigator` + `extractPath`, AND mark `(Block as any).__selfManagedChildren = true` (otherwise `form` prop not injected). Generic resolver utilities will need `<T extends FormFields>` because `ArrayNode<T>` carries that constraint — add it to your resolver function signature, not a workaround.

7. **renderer-json**: USE app-level `RendererFormArraySection` component (≈150-line template lives in renderer-json cookbook). DO NOT write per-page `array-blocks.tsx` with `CreditFormProvider`. Schema describes the array fully via `$template` + `control` (string FieldPath) + `initialValue` (source ID).

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing array code. Skipping = silent runtime corruption.**

- `reformer://docs/core/array-schema-format`
- `reformer://docs/core/array-operations`
- `reformer://docs/core/array-cleanup-pattern`
- `reformer://docs/cdk/formarrayhandle-api`
- `reformer://docs/cdk/useformarray-hook`
- `reformer://docs/cdk/list-render-props`
- `reformer://docs/cdk/external-control-via-ref`
- `reformer://docs/cdk/nested-formarray`
- `reformer://docs/cdk/custom-addbutton`
- `reformer://docs/renderer-json` (aggregator — for `RendererFormArraySection` cookbook + `$template` semantics)

## Task

1. Extend FormSchema — field becomes `array(itemSchema, { initialItems?, ... })`.
2. UI via `<FormArray.Root control={form.<arr>}>` + `<FormArray.List>` + `<FormArray.AddButton>`.
3. Validation via `validateItems` (item-level) or `validate(path.<arr>, ...)` (cross-item).
4. Cleanup on external trigger via `watchField` with length-guard.
5. Nested arrays: separate `array(...)` inside item schema; UI nests `FormArray.Root`.
6. Template-factory returns PLAIN leaf values (never FieldConfig).
7. (renderer-react) self-managed array block — resolve FieldPath→ArrayNode + `__selfManagedChildren = true`.
8. (renderer-json) app-level `RendererFormArraySection` from cookbook + `$template` JSON.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Tuple-literal `[itemSchema]` in FormSchema
- [ ] Template-factory returns PLAIN leaf values (no `component`/`componentProps`)
- [ ] Conditional visibility via JSX/`hideWhen`/`setHidden`, NOT `enableWhen + resetOnDisable`
- [ ] Validation: `validateItems` / `applyWhen` covered
- [ ] Cleanup wired (if applicable)
- [ ] (renderer-react) Checkbox without `CdkFormField.Label` wrapper
- [ ] (renderer-react self-managed) `__selfManagedChildren = true` set
- [ ] (renderer-json) `RendererFormArraySection` registered, `$template` schema written