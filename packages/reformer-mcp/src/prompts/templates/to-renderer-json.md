You migrate a form from `@reformer/renderer-react` (TS RenderSchema) to `@reformer/renderer-json` (JSON schema + Registry).

## Current TS code

```typescript
{
  {
    code;
  }
}
```

## Critical inline rules (M1 — string-operator DSL)

Bindings are encoded as **string operators**: `'$model(path)'` (field/array path), `'$component(Name)'` (registry component), `'$dataSource(NAME)'` (registry source). Bare strings (`label`, `placeholder`) resolve as-is.

- **Field node (leaf)**: `{ value: model.$.email, component: Input }` → `{ "value": "$model(email)", "component": "$component(Input)" }`. `value` carries the model path via `$model(...)`; there is **no** `model:` key.
- **Box container**: `{ component: Box, componentProps: { children: [...] } }` → `{ "component": "$component(Box)", "children": [...] }` (children OUTSIDE componentProps).
- **Section container**: `{ component: Section, componentProps: { title, children: [...] } }` → `{ "component": "$component(Section)", "componentProps": { "title": "…" }, "children": [...] }`.
- **Registry** via `defineRegistry`: every `$component(Name)` in JSON MUST be registered as `reg.field`/`reg.container`. `FIELD_WRAPPER` MUST be set (`reg.container(FIELD_WRAPPER, FormField)`).
- **Constants** (LOAN_TYPES, GENDERS) via `reg.dataSource('LOAN_TYPES', LOAN_TYPES)`; in JSON reference by operator `{ "options": "$dataSource(LOAN_TYPES)" }`. Never inline arrays in JSON.
- **Item-label functions** via `reg.dataSource('LABEL_FN', fn)`; reference as `"itemLabel": "$dataSource(LABEL_FN)"`.
- **Arrays via native `{ array, item.$template }`**: `{ "array": "$model(properties)", "initialValue": { … }, "componentProps": { "title": "…", "itemLabel": "$dataSource(…)" }, "item": { "$template": { …JsonNode… } } }`. Both `array` **and** `item.$template` are required. Inside `$template`, `$model(...)` paths resolve **relative to the array element** (`"$model(type)"`, not `"$model(properties[0].type)"`). No separate array-container component is needed — the converter renders arrays via its native branch.
- **Node discrimination is by key**: `value` → leaf field, `array` + `item.$template` → array, `component` + `children` → container. These are mutually exclusive; never mix `value`/`array` with `children`.
- **Behavior does NOT migrate to JSON** — stays a TS function `RenderBehaviorFn<T>` passed via the `renderBehavior` prop of `JsonFormRenderer`. Runtime entities (form, validation config) are injected into nodes by `selector` through `onInit`/`patchProps`.
- **`testId` is bare** (e.g. `'step1.loanAmount'`), never pre-prefixed with `input-`. Renderer auto-prefixes when emitting `data-testid="input-${testId}"`. If your JSON-builder helper does `testId: \`input-${id}\``you get double-prefixed`input-input-step1.X` and all playwright selectors silently miss.
- **`version: '1.0'`** is required at the schema root.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing JSON. Skipping = unregistered components / wrong shape.**

- `reformer://docs/renderer-json/quick-start`
- `reformer://docs/renderer-json/key-concepts`
- `reformer://docs/renderer-json/components-and-exports`
- `reformer://docs/renderer-json/key-concepts-2`
- `reformer://docs/renderer-json/key-concepts-3`
- `reformer://docs/renderer-json/builder-api`
- `reformer://docs/renderer-json/template-template-arrays`
- `reformer://docs/renderer-json/source`
- `reformer://docs/renderer-json/control`
- `reformer://docs/renderer-json/migration-from-ts-renderschema`
- `reformer://docs/renderer-json/anti-patterns`

## Task

1. Convert TS RenderSchema into `JsonFormSchema` (leaves → `$model`/`$component`, containers → `$component` + top-level `children`).
2. Fill the registry (`reg.field`/`reg.container` for components, `reg.dataSource` for options/labels/loading, `FIELD_WRAPPER`).
3. Migrate arrays via native `{ array, item: { $template } }` + `initialValue` (no separate array-container component).
4. Keep behavior as TS — pass it via `JsonFormRenderer`'s `renderBehavior` prop; mount the form with `convertJsonToM1Tree` + `JsonRendererProvider`.
5. Add `version: '1.0'`.
6. Final list: which components must be registered.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] All `$component(Name)` in JSON registered in `defineRegistry`
- [ ] `FIELD_WRAPPER` set
- [ ] Constants moved to `reg.dataSource` + referenced via `$dataSource(...)` (no inline arrays in JSON)
- [ ] Leaves use `value: '$model(path)'` + `component: '$component(Name)'` (no `model:` key)
- [ ] Box children OUTSIDE componentProps (top-level `children`)
- [ ] Section children OUTSIDE componentProps (top-level `children`)
- [ ] Arrays use native `{ array, item: { $template } }` + `initialValue`
- [ ] Behavior stays TS, passed via `renderBehavior` prop
- [ ] `version: '1.0'` present
- [ ] Components-to-register list at end
