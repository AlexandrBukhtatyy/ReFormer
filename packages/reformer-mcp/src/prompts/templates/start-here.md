You are building (or modifying) a form with the **ReFormer** library, using this MCP server as
your only source of truth. Do not assume APIs from memory — look them up here.

## The M1 workflow (follow in order)

1. **Model** — `createModel<T>(initial)` from `@reformer/core`. One reactive model is the source of
   truth. Type the data as a `type` (not `interface`), initialise every field (numbers `null`,
   strings `''`, arrays `[]`; array-item objects must initialise all their fields).
2. **Schema** — a tree of field leaves: `{ value: model.$.field, component, componentProps, validators: [...] }`.
   `value` is a signal (`model.$.x`), never a string.
3. **Form** — `createForm({ model, schema })` (not the legacy `{ form: {...} }` overloads).
4. **Validation** — validators are factories from `@reformer/core/validators` (`required()`, `email()`,
   `minLength()`) plus custom `ModelValidator (value, scope, root)` for cross-field/async. Run everything
   with `validateFormModel(model, schema)` — `form.validate()` does NOT run schema validators.
5. **Behaviors** (if needed) — `compute` / `copyFrom` / `enableWhen` / `onChange` via `defineFormBehavior`
   or primitives. A computed field reads OTHER fields and writes its own — avoid cycles.
6. **Arrays / Wizard** (if needed) — array node `{ array, item, initialValue }` + CDK `FormArray` (key rows
   by `id`); wizard via CDK `FormWizardConfig` = `{ validateStep, validateAll }` callbacks.
7. **Render** — pick one: ui-kit `<FormField control={form.x} />`; renderer-react `createRenderSchema` +
   `FormRenderer`; renderer-json JSON (operators `$model`/`$component`/`$dataSource`) + `defineRegistry`.

## Which tool/prompt at each step

- Full self-doc (workflow + tools + prompts + resources) in one place: resource `reformer://guide` (aka `reformer://docs/mcp`).
- Exact signature + example of a symbol: tool `get_symbol_docs <name>`.
- A worked pattern for a scenario: tool `find_recipe <topic>` (e.g. `wizard`, `form-array`, `cycle`, `json-schema`).
- Discover the API surface: tool `list_symbols` (by kind/package).
- Package docs: resources `reformer://docs/{core,cdk,ui-kit,renderer-react,renderer-json}[/section]`.
- Plan from a spec file: prompt `plan-form`. From free text: prompt `create-form`.
- Add features: prompts `add-validation`, `add-behavior`, `add-form-array`, `add-wizard`.
- Migrate render: prompts `to-renderer`, `to-renderer-json`.

## Verify before you finish

- Behaviors acyclic → tool `check_behaviors` (declare `{ target, reads }` per computed field).
- renderer-json schema well-formed → tool `validate_json_schema` (pass your registry's component/dataSource names).
- Code review → prompt `review`.

You already have the workflow above. Look up specific pieces with `find_recipe` and
`get_symbol_docs`; for the full reference in one place, read `reformer://guide`. Individual
doc sections are per-heading — discover their exact URIs with ListResources.
