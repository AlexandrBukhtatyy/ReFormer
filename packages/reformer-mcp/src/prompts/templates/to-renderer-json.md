You move a form's schema from a TS builder (`form.schema.ts`, `(model) => node`) to a JSON document of format 2 plus a registry (`@reformer/renderer-json`).

## Current TS code

```typescript
{{code}}
```

## What changes and what does not

The tree is the same — it is written as data instead of code. `model.ts`, `form.validation.ts`, `form.behavior.ts` and the `createForm` call stay; the call gains `registry`, and the schema becomes the document:

```typescript
createForm<MyForm>({ model: createMyModel(), schema: formSchema, registry, behavior, validation });
```

`<FormRenderer form={bundle} />` draws it — the same renderer as for a TS schema; the field wrapper now comes from the registry. `createJsonForm`, `useJsonForm`, `JsonFormRenderer` and `JsonRendererProvider` are the former contract — ❌ do not emit them.

## Critical inline rules (format 2 — string-operator DSL)

Bindings are encoded as **string operators**: `'$model(path)'` (field/group/array path), `'$component(Name)'` (registry component), `'$dataSource(NAME)'` (registry source), `'$fn(name)'` (registry function), `'$locale(key)'` (localization key → string), `'$part(name)'` (a named part of the document), `'$html(tag)'` (an HTML tag as the component). Bare strings (`label`, `placeholder`) resolve as-is.

- **Document root**: `{ "format": 2, "parts": { … }, "root": { … } }`. `"format": 2` is required: a document without it is the former format (keys `value` / `array`, steps in `componentProps.steps`) and the assembly does not read it — `migrateJsonSchema(v1)` converts one. `version` is optional and means the version of the form's CONTENT (the form registry compares it), not the format.
- **Field node**: `{ model: model.$.email, component: Input }` → `{ "model": "$model(email)", "component": "$component(Input)" }`. The binding key is `model` in both notations; ❌ `"value": "$model(email)"` is the former key.
- **Container**: `{ component: Section, componentProps: { title }, children: [...] }` → `{ "component": "$component(Section)", "componentProps": { "title": "…" }, "children": [...] }` (children OUTSIDE `componentProps`).
- **Sub-form**: a TS part `const address = (model) => node` becomes an entry of `parts`, and the mount `{ model: model.$.registrationAddress, part: address }` → `{ "model": "$model(registrationAddress)", "part": "$part(address)" }`. Paths inside a part are relative to the sub-model of the place it is mounted at (`"$model(city)"`), so one part serves several places.
- **Array**: `{ model: model.$.properties, component: FormArray, item: propertyRow }` → `{ "model": "$model(properties)", "component": "$component(FormArray)", "item": "$part(propertyRow)" }` with the row declared in `parts` (or inline as `"item": { "$template": { …node… } }`). Paths inside the row are relative to the element (`"$model(type)"`, not `"$model(properties[0].type)"`). The template of a new row lives in the model (`arrayOf(blank)`), so the node carries no `initialValue`; it stays only as a fallback for forms whose model is created from data without code. Pick the component by intent: `$component(FormArray)` for an editable section, `$component(List)` for a read-only list — both from `@reformer/ui-kit`.
- **Wizard**: the library component with steps in `children` — `{ "selector": "wizard", "component": "$component(FormWizard)", "children": [{ "selector": "loan", "component": "$component(Step)", "componentProps": { "title": "…" }, "children": [...] }] }`. ❌ No app shim (`$component(Wizard)`, `wizard.tsx`), no `componentProps.steps`.
- **Node discrimination is by key**: `model` alone → field, `model` + `item` → array, `model` + `part` → sub-form, `children` without `model` → container. Never mix `model` with `children`.
- **Registry** via `defineRegistry`: every `$component(Name)` in the document MUST be registered as `reg.component(Name, Component)` (one method for both leaf and container components — the role is decided by node structure), including the library `FormWizard` and `Step`. `FIELD_WRAPPER` MUST be set (`reg.component(FIELD_WRAPPER, FormField)`) — the assembly puts it into the bundle and the renderer takes it from there.
- **Constants** (LOAN_TYPES, GENDERS) via `reg.dataSource('LOAN_TYPES', LOAN_TYPES)`; in JSON reference by operator `{ "options": "$dataSource(LOAN_TYPES)" }`. Never inline arrays in JSON.
- **Functions** (item-label, formatters, comparators, handlers) via `reg.fn('LABEL_FN', fn)`; reference as `"itemLabel": "$fn(LABEL_FN)"`. Separate from `reg.dataSource` — `reg.fn` throws on a non-function and validation rejects mixed `$fn`/`$dataSource`.
- **Localized text** via `reg.locale(createLocaleResolver(catalog))`; reference labels/placeholders as `"label": "$locale(fields.email.label)"`. Strings are resolved once, when the form is assembled; for a live language switch or reactive `$model` params use the `$component(I18n)` component (register `reg.component('I18n', I18n)`, wrap in `LocaleProvider`).
- **Behavior does NOT migrate to JSON** — it stays the same `form.behavior.ts`: `defineFormBehavior<T>(({ model, form, schema }) => …)` passed as the `behavior` field of `createForm`. Rules address nodes by `selector` (`hideWhen(schema.node('mortgage'), …)`, `onComponentEvent(schema.node('wizard'), 'onSubmit', …)`). There is no `renderBehavior` field and no `(form, model, validation) => (schema) => …` factory — the former contract.
- **Validation does NOT migrate to JSON either** — the DSL has **no** `$validator(...)` operator. Rules stay in `form.validation.ts` (`defineValidationSchema<T>` with `validate` / `validateAsync` / `validateWhen` / `cross` / `apply` / `applyEach`) and go to the assembly as `validation`. The old path-based engine — `validateFormModel`, leaf `validators: [...]`, `ModelValidator (value, scope, root)` — has been **removed**; never emit it into JSON or TS.
- **Check the document in dev explicitly**: `validateFormSchema(document, { registry })` from `@reformer/renderer-json/validate`, loaded by a dynamic `import()` so that ajv stays out of the production bundle; show `SchemaErrorPanel` when it reports errors and assemble the form only after the check passes. Nothing checks the document implicitly.
- **`testId` is bare** (e.g. `'step1.loanAmount'`), never pre-prefixed with `input-`. The renderer auto-prefixes when emitting `data-testid="input-${testId}"`.
- **File**: `form.schema.ts` with `defineJsonSchema<MyForm>({ format: 2, … })` — `$model(...)` paths are checked at compile time. A plain `form.schema.json` is an accepted variant that gives that up.

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing JSON. Skipping = unregistered components / wrong shape.**

- `find_recipe unified-contract`
- `reformer://docs/renderer-json/quick-start`
- `reformer://docs/renderer-json/key-concepts`
- `reformer://docs/renderer-json/components-and-exports`
- `reformer://docs/renderer-json/builder-api`
- `reformer://docs/renderer-json/source`
- `reformer://docs/renderer-json/anti-patterns`

## Task

1. Convert the TS tree into a `JsonFormSchema` document with `"format": 2` (field nodes → `model` + `$model`/`$component`, containers → `$component` + top-level `children`).
2. Move TS parts and array rows into `parts`; reference them with `$part(name)`.
3. Fill the registry (`reg.component` for components incl. `FormWizard` / `Step`, `reg.dataSource` for options, `reg.fn` for functions, `FIELD_WRAPPER`).
4. Keep `form.behavior.ts` and `form.validation.ts` as they are — they address the same selectors and the same model.
5. Add `registry` to the `createForm` call, replace the renderer settings with `<FormRenderer form={bundle} />`, add the explicit dev check of the document.
6. Final list: which components must be registered.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] The document has `"format": 2`; binding key is `model` everywhere (no `value` / `array`)
- [ ] All `$component(Name)` in the document registered in `defineRegistry`; `FIELD_WRAPPER` set
- [ ] Constants moved to `reg.dataSource` + referenced via `$dataSource(...)` (no inline arrays in JSON)
- [ ] Functions moved to `reg.fn` + referenced via `$fn(...)` (not `$dataSource`)
- [ ] Localized labels/placeholders via `reg.locale` + `$locale(key)` (if the form is localized)
- [ ] Containers keep `children` OUTSIDE `componentProps`
- [ ] Sub-forms and array rows are `parts`, referenced with `$part(name)`; paths inside are relative
- [ ] Wizard (if any): `$component(FormWizard)` with steps in `children`, no shim
- [ ] Behavior stays TS in `form.behavior.ts`, passed as `behavior` — no `renderBehavior`
- [ ] Validation stays a standalone `ValidationSchema<T>` — no `$validator(...)` in JSON, no leaf `validators: [...]`, no `validateFormModel`
- [ ] Assembly is `createForm({ …, schema: document, registry })` in `useFormBundle`; drawn by `<FormRenderer form={bundle} />`
- [ ] Components-to-register list at end
