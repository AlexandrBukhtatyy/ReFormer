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
- **Deeply nested forms (4+ levels)**: cast `createForm as (config: { form: unknown; validation: unknown; behavior: unknown }) => FormProxy<T>` to dodge TS2589. **Do NOT** add `extends FormFields` to leaf interfaces with union-literal field types (e.g. `loanType: 'consumer' | 'mortgage'`) — `FormFields = Record<string, FormValue>` index signature widens those literals back to `string` and breaks the typed `FormProxy`. The cast above is the workaround; `extends FormFields` is rarely needed and often harmful.
- **Array shape**: `arr: [itemSchema]` (tuple), NEVER `{ value: [], itemSchema: {...} }` (silent corruption).
- **`FormArray.AddButton initialValue`**: PLAIN leaf values only. Never FieldConfig (`{ value, component }`) — silent runtime corruption.
- **Conditional fields → Hide, not Disable**. Type/status conditional (loanType, employmentStatus) → JSX-conditional (`{loanType==='mortgage' && <FormField .../>}`) for `core`; `hideWhen` / `setHidden` for renderers. `enableWhen` only for progressive disclosure (`confirmPassword` after `password`).
- **Spec compliance — literal**: every spec field = separate FormSchema field with the same name and the same step. No merging, no skipping, no moving.
- **testId convention**: dotted path (`step1.loanAmount`, `step2.passportData.series`), never bare leaf names — collisions inevitable across steps.
- **User-facing strings**: from spec or in the user's native language. No default English `"Select an option..."` placeholders.
- **`required(...)` always with `{ message }`**: never default `"Поле обязательно для заполнения"`.
- **All input-rendering `componentProps` (`label`, `placeholder`, `options`, `mask`, `rows`, `type`, anything the leaf component reads) MUST live in `createForm` componentProps**, not only in JSON for `target=renderer-json`. The renderer reads `state.componentProps` from the FieldNode at render time; `JsonNode.componentProps` only carries `selector` / `wrapper` / `testId` / `className` to `RenderNodeComponent`, not the input itself. Symptoms when violated:
  - `label` only in JSON → field renders without a label (visual-only, but breaks UX);
  - `options` only in JSON → `RadioGroup` throws `TypeError: t.map is not a function` at mount; `Select` shows an empty dropdown;
  - `placeholder` only in JSON → input shows nothing.
  Practical recipe: declare all option arrays / templates in `registry.tsx`, import them into `schema.ts`, and use them BOTH in `createForm({...componentProps: { label, options }...})` AND as `reg.source(...)` so JSON can reference them by name (the JSON reference becomes documentation, not the runtime source-of-truth).

## If `target=renderer-json` — `RenderSchemaFn`-wrapper for form-injection

`createRenderSchemaFromJson(jsonSchema, registry)` returns a `RenderSchemaFn` that builds a tree from the JSON, but it has **no way to inject your live `FormProxy`** into the root `FormRoot` (the self-managed root component you register; it needs `form` via `componentProps` to forward it down to children via `<RenderNodeComponent form={form} ...>`). Solution — wrap the converter result yourself and pass the wrapped fn to `createRenderSchema(...)`. Boilerplate (copy verbatim into `index.tsx`):

{{{{raw}}}}
```tsx
import { useMemo } from 'react';
import {
  createRenderSchema,
  type RenderSchemaFn,
  type ContainerRenderNode,
} from '@reformer/renderer-react';
import { createRenderSchemaFromJson } from '@reformer/renderer-json';

// inside component:
const form = useMemo(() => createMyForm(), []);
const registry = useMemo(() => createMyRegistry(), []);

const schema = useMemo(() => {
  const baseFn = createRenderSchemaFromJson<MyForm>(jsonSchema, registry);
  const fnWithForm: RenderSchemaFn<MyForm> = (path) => {
    const root = baseFn(path) as ContainerRenderNode<MyForm>;
    return {
      ...root,
      componentProps: { ...(root.componentProps ?? {}), form },
    };
  };
  return createRenderSchema(fnWithForm);
}, [registry, form]);

// `schema` is now a `RenderSchemaProxy` — exposes `schema.node('selector').setHidden(...)`
// for wizard step toggling and conditional sub-section visibility.
return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
```

The corresponding `FormRoot` in `registry.tsx` looks like:

```tsx
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
  return <>{children.map((c, i) => <RenderNodeComponent key={i} node={c} form={form} />)}</>;
}
(FormRoot as any).__selfManagedChildren = true;  // ← required marker

// in defineRegistry:
reg.container('FormRoot', FormRoot);
```
{{{{/raw}}}}

Without `__selfManagedChildren = true`, `RenderNodeComponent` would NOT pass `form` into FormRoot, and child field nodes would silently render nothing. Without the wrapper, `form` would never reach `componentProps` on the root.

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
- [ ] `Select`/`RadioGroup` have `options` in `createForm` componentProps (not only JSON)
- [ ] All `label` / `placeholder` / mask / rows / type / etc. live on `createForm` componentProps too (not only JSON)
- [ ] Final note: «использовал `@reformer/ui-kit` + Tailwind по detected стеку» (or reason why not)