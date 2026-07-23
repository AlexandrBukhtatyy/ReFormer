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

Bindings are encoded as **string operators**: `'$model(path)'` (field/array path), `'$component(Name)'` (registry component), `'$dataSource(NAME)'` (registry source), `'$fn(name)'` (registry function), `'$locale(key)'` (localization key → string). Bare strings (`label`, `placeholder`) resolve as-is.

- **Field node (leaf)**: `{ value: model.$.email, component: Input }` → `{ "value": "$model(email)", "component": "$component(Input)" }`. `value` carries the model path via `$model(...)`; there is **no** `model:` key.
- **Box container**: `{ component: Box, componentProps: { children: [...] } }` → `{ "component": "$component(Box)", "children": [...] }` (children OUTSIDE componentProps).
- **Section container**: `{ component: Section, componentProps: { title, children: [...] } }` → `{ "component": "$component(Section)", "componentProps": { "title": "…" }, "children": [...] }`.
- **Registry** via `defineRegistry`: every `$component(Name)` in JSON MUST be registered as `reg.component(Name, Component)` (one method for both leaf and container components — role is decided by node structure). `FIELD_WRAPPER` MUST be set (`reg.component(FIELD_WRAPPER, FormField)`).
- **Constants** (LOAN_TYPES, GENDERS) via `reg.dataSource('LOAN_TYPES', LOAN_TYPES)`; in JSON reference by operator `{ "options": "$dataSource(LOAN_TYPES)" }`. Never inline arrays in JSON.
- **Functions** (item-label, formatters, comparators, handlers) via `reg.fn('LABEL_FN', fn)`; reference as `"itemLabel": "$fn(LABEL_FN)"`. Separate from `reg.dataSource` — `reg.fn` throws on a non-function and `validate` rejects mixed `$fn`/`$dataSource`. Passed to the prop by reference (no argument binding).
- **Localized text** via `reg.locale(createLocaleResolver(catalog))`; reference labels/placeholders as `"label": "$locale(fields.email.label)"`. Resolves to a string at convert-time (miss → the key); a catalog enables key-typo detection at `validate`. With params use the structured form `"label": { "$locale": "fields.min", "params": { "count": 8 } }`. For markdown/rich or live language switch / reactive `$model` params use the `$component(I18n)` component (register `reg.component('I18n', I18n)`, wrap in `LocaleProvider`): `{ "component": "$component(I18n)", "componentProps": { "id": "users.count", "values": { "count": "$model(userCount)" } } }`.
- **Arrays via native `{ array, item.$template }`**: `{ "array": "$model(properties)", "initialValue": { … }, "componentProps": { "title": "…", "itemLabel": "$fn(…)" }, "item": { "$template": { …JsonNode… } } }`. Both `array` **and** `item.$template` are required. Inside `$template`, `$model(...)` paths resolve **relative to the array element** (`"$model(type)"`, not `"$model(properties[0].type)"`). No separate array-container component is needed — the converter renders arrays via its native branch.
- **Node discrimination is by key**: `value` → leaf field, `array` + `item.$template` → array, `component` + `children` → container. These are mutually exclusive; never mix `value`/`array` with `children`.
- **Behavior does NOT migrate to JSON** — stays a TS function `RenderBehaviorFn<T>` passed via the `renderBehavior` prop of `JsonFormRenderer`. Runtime entities (form, validation runner, event handlers) are injected into nodes by `selector` through `onInit`/`patchProps` and `onComponentEvent`.
- **Validation does NOT migrate to JSON either** — the JSON DSL has **no** `$validator(...)` operator; a `JsonFieldNode` carries only layout. Rules live in a standalone `defineValidationSchema<T>(({ model }) => { … })` (own `validation.ts`), wired to fields with ambient operators — `validate(model.$.field, [rules])`, `validateAsync(sig, [asyncRules])`, `validateWhen(() => cond, () => …)`, `cross(sig, (f) => …)` (reads the snapshot `model.get()`), `each(model.arr, (im) => …)`, `apply(...schemas)` — and run by the external runner `validateModel(model, schema): Promise<boolean>` (it routes errors into the form nodes via `getNodeForSignal(sig).setErrors(...)`, clears fields that became valid, and `severity:'warning'` never blocks). Wire it from TS: `await validateModel(model, schema)` inside the submit/step handler you attach to a JSON node via `onComponentEvent` (wizard: expose `makeValidationConfig(model) → { validateStep, validateAll }`). To re-run a `cross` reactively on a dependency change before submit, bridge from behavior — `revalidateWhen([model.$.dep], () => void validateModel(model, schema))` (a `@reformer/core/behaviors` operator). The old path-based engine — `validateFormModel`, leaf `validators: [...]`, `ModelValidator (value, scope, root)`, `{ when, children }`, `validate(path.x)` — has been **removed**; never emit it into JSON or TS.
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
2. Fill the registry (`reg.component` for components, `reg.dataSource` for options/labels/loading, `FIELD_WRAPPER`).
3. Migrate arrays via native `{ array, item: { $template } }` + `initialValue` (no separate array-container component).
4. Keep behavior as TS — pass it via `JsonFormRenderer`'s `renderBehavior` prop; mount the form with `convertJsonToM1Tree` + `JsonRendererProvider`.
5. Keep validation as a standalone TS `ValidationSchema<T>` (`defineValidationSchema<T>(({ model }) => { … })`) — do NOT put validators in JSON. Run it with `validateModel(model, schema)` from the submit/step handler wired via `onComponentEvent` (wizard: `makeValidationConfig(model)`).
6. Add `version: '1.0'`.
7. Final list: which components must be registered.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] All `$component(Name)` in JSON registered in `defineRegistry`
- [ ] `FIELD_WRAPPER` set
- [ ] Constants moved to `reg.dataSource` + referenced via `$dataSource(...)` (no inline arrays in JSON)
- [ ] Functions moved to `reg.fn` + referenced via `$fn(...)` (not `$dataSource`)
- [ ] Localized labels/placeholders via `reg.locale` + `$locale(key)` (if the form is localized)
- [ ] Leaves use `value: '$model(path)'` + `component: '$component(Name)'` (no `model:` key)
- [ ] Box children OUTSIDE componentProps (top-level `children`)
- [ ] Section children OUTSIDE componentProps (top-level `children`)
- [ ] Arrays use native `{ array, item: { $template } }` + `initialValue`
- [ ] Behavior stays TS, passed via `renderBehavior` prop
- [ ] Validation stays a standalone `ValidationSchema<T>` run via `validateModel(model, schema)` — no `$validator(...)` in JSON, no leaf `validators: [...]`, no `validateFormModel`
- [ ] `version: '1.0'` present
- [ ] Components-to-register list at end
