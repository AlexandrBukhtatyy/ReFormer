You add a dynamic field array to a `@reformer/*` form.

## Args

- requirements: {{requirements}}

## Current form code

```typescript
{
  {
    code;
  }
}
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

7. **JSON `selector` vs `model` — different semantics, do NOT mix.** Two distinct concepts that look superficially similar:
   - **`model: 'fieldName'`** — explicit fieldPath. Drives renderer's `getFieldByPath(form, fieldName)` for FieldRenderNode resolution. Use this for ANY field reference in JSON (`Input` / `Select` / `Checkbox` / `RadioGroup` / `Textarea` / etc.).
   - **`selector: 'unique-id'`** — node identifier. Drives `setHidden` / `hideWhen` / `patchProps` / `getRef` orchestration via `schema.node(selector)`. Use this for nodes you want to control programmatically (step containers, conditional sub-sections, array sections).

   **Don't put dotted-path `stepN.fieldName` into `selector` of a field-typed node** (`{ component: 'Input', selector: 'step1.loanAmount' }`). The converter's `resolveFieldPath` falls back to `selector` as fieldPath when component is field-type — but `step1.loanAmount` is NOT in your form schema (your form has `loanAmount` directly), so `getFieldByPath` returns null and you get **silent `[RenderSchema] Field not found: step1.loanAmount` warnings** with the field rendered as nothing. testIds and field paths are different conventions:
   - `testId: 'step1.loanAmount'` — DOM test convention (dotted path with stepN. prefix). Stays in `componentProps`.
   - `model: 'loanAmount'` — actual field path in the form (no stepN. prefix).

   ```jsonc
   // ❌ silent fail — selector treated as fieldPath, form has 'loanAmount' not 'step1.loanAmount'
   { "selector": "step1.loanAmount", "component": "Input", "componentProps": { "testId": "step1.loanAmount" } }

   // ✅ correct — model is the real fieldPath, testId is just for DOM
   { "model": "loanAmount", "component": "Input", "componentProps": { "testId": "step1.loanAmount" } }

   // ✅ also valid — selector for orchestration, model for field
   { "selector": "loan-amount-field", "model": "loanAmount", "component": "Input" }
   ```

8. **All targets — `FormArraySection` from `@reformer/ui-kit/form-array` is the single component for both TS-flow and renderer-flow.** Polymorphic `control` (accepts `FormArrayProxy<T>` / `ArrayNode<T>` / `FieldPathNode`). **Single `itemComponent: ComponentType<{ control: FormProxy<T> }>` shape.** Do NOT use a node-factory `(itemPath) => RenderNode<T>` — that's the legacy `RendererFormArraySection` shape; use FC instead.

   ```tsx
   import { FormArraySection } from '@reformer/ui-kit/form-array';

   const PropertyForm: FC<{ control: FormProxy<Property> }> = ({ control }) => (
     <Section>
       <FormField control={control.type} />
       <FormField control={control.estimatedValue} />
     </Section>
   );

   <FormArraySection
     control={path.properties} // или resolved ArrayNode напрямую
     itemComponent={PropertyForm}
     title="Имущество"
     addButtonLabel="+ Добавить имущество"
   />;
   ```

   **renderer-json:** consumer registers `PropertyForm` via `reg.container('PropertyForm', PropertyForm)` and references by string in JSON — `"itemComponent": "PropertyForm"`. Or uses inline `$template`:

   ```jsonc
   { "itemComponent": { "$template": { "component": "Section", "children": [...] } } }
   ```

   Converter wraps `$template` into an FC automatically — ui-kit sees a unified FC-shape.

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
8. **All targets**: use `FormArraySection` from `@reformer/ui-kit/form-array` (single FC `itemComponent`). For renderer-json: registry-name string OR inline `$template` — both produce FC.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Tuple-literal `[itemSchema]` in FormSchema
- [ ] Template-factory returns PLAIN leaf values (no `component`/`componentProps`)
- [ ] Conditional visibility via JSX/`hideWhen`/`setHidden`, NOT `enableWhen + resetOnDisable`
- [ ] Validation: `validateItems` / `applyWhen` covered
- [ ] Cleanup wired (if applicable)
- [ ] (renderer-react) Checkbox without `CdkFormField.Label` wrapper
- [ ] (renderer-react self-managed) `__selfManagedChildren = true` set
- [ ] All targets: `FormArraySection` from `@reformer/ui-kit/form-array` used; `itemComponent` is FC (`ComponentType<{ control }>`)
- [ ] (renderer-json) item FC registered via `reg.container('Name', FC)` OR inline `$template` used (converter wraps to FC)
