You are building (or modifying) a form with the **ReFormer** library, using this MCP server as
your only source of truth. Do not assume APIs from memory — look them up here.

## The workflow (follow in order)

A form is described ONE way for every way of drawing it — markup by hand in JSX, `FormRenderer` over
a TS schema, `FormRenderer` over a JSON document: one schema tree, one binding handle, one behavior,
one assembly.

1. **Model** — `createModel<T>(initial)` from `@reformer/core`, exported as a factory. One reactive
   model is the source of truth. Type the data as a `type` (not `interface`), initialise every field
   (numbers `null`, strings `''`). An array of sub-forms is declared with its new-row template:
   `properties: arrayOf(blankProperty)`.
2. **Schema** — ONE tree of nodes, a builder `(model) => node`. The binding key is `model`, the
   binding handle is `model.$.…` — for a field, a group and an array alike:
   field `{ model: model.$.email, component, componentProps }`, array
   `{ model: model.$.items, component: FormArray, item: itemRow }`, sub-form
   `{ model: model.$.address, part: address }`, container `{ component, children }`. The keys
   `value:` / `array:` are the former contract. The schema carries **no** validation: a leaf
   `validators: [...]` array still type-checks (legacy field) but the engine that ran it was
   **removed**, so the rule is silently ignored — see step 4.
3. **Assembly** — ONE call for every target: `createForm({ model | initial, schema, registry?, behavior?, validation? })`
   from `@reformer/core` → a bundle `{ model, form, validation?, render }`. A JSON document goes in
   as `schema` together with `registry`. In React wrap the factory in `useFormBundle` — a lazy
   `useState` that runs it exactly once; `useMemo` may drop its cache and rebuild the form, losing
   typed input. `createCoreForm` / `createReactForm` / `createJsonForm` and the hooks
   `useReactForm` / `useJsonForm` are the former contract — do not use them in new code.
4. **Validation** — a **standalone schema, not node metadata**: rules live in
   `defineValidationSchema<T>(({ model }) => { … })` and are wired with ambient operators from
   `@reformer/core/validation`: `validate(model.$.field, [rules])` for a field,
   `apply(model.$.group, groupRules)` for a sub-form, `applyEach(model.$.items, itemRules)` for an
   array. A rule is a built-in factory from `@reformer/core/validators` (`required()`, `email()`,
   `minLength()`) or a `Rule<T>` — an inline `(value) => ValidationError | null`. Pass the rules to
   the assembly (`validation: schema` or `{ steps: { <step selector>: schema }, extras }`) and use
   `bundle.validation`; the external runner is `await validateModel(model, schema)`
   (`Promise<boolean>`, routes errors into the form nodes). The leaf `validators: [...]` array, the
   `ModelValidator (value, scope, root)` shape and the whole-model runner
   `validateFormModel(model, schema)` have all been **removed** — never emit them.
5. **Behavior** — the ONLY behavior of the form: `defineFormBehavior<T>(({ model, form, schema }) => { … })`
   from `@reformer/core/behaviors`. Links over the model (`compute` / `copyFrom` / `enableWhen` /
   `onChange`; `apply` for a sub-form, `applyEach` for array rows) and rules for schema nodes
   (`hideWhen(schema.node('selector'), …)`, `onComponentEvent`, `onMount`) stand side by side.
   A computed field reads OTHER fields and writes its own — avoid cycles.
6. **Wizard** (if needed) — the library `FormWizard` as a schema node, steps are its `children`
   (`{ selector, component: Step, componentProps: { title } , children }`); the step `selector` is
   the key of its rules in `validation.steps`. No app shim, no `componentProps.steps`.
7. **Draw** — the bundle goes to whoever draws: renderer —
   `<FormRenderer form={bundle} settings=\{{ fieldWrapper: FormField }} />`; JSON —
   `<FormRenderer form={bundle} />` (the field wrapper comes from the registry); by hand —
   `<FormField control={bundle.form.x} />`.

## Which tool/prompt at each step

- The contract in one place: tool `find_recipe unified-contract`.
- Full self-doc (workflow + tools + prompts + resources): resource `reformer://guide` (aka `reformer://docs/mcp`).
- Which of two similar operators: tool `choose_api <requirement>`.
- Exact signature + example of a symbol: tool `get_symbol_docs <name>`.
- A worked pattern for a scenario: tool `find_recipe <topic>` (e.g. `wizard`, `form-array`, `cycle`, `json-schema`).
- Discover the API surface: tool `list_symbols` (by kind/package).
- Package docs: resources `reformer://docs/{core,cdk,ui-kit,renderer-react,renderer-json}[/section]`.
- From a spec file: tools `plan_form` → `generate_form` (a cross-checked bundle), or prompt `plan-form`. From free text: prompt `create-form`.
- Add features: prompt `add-feature` with `feature`: `validation` | `behavior` | `array` | `wizard`.
- Change who draws: prompt `to-renderer` with `target`: `renderer-react` | `renderer-json`.

## Verify before you finish

One tool, `validate_form`, by `kind`:

- `kind="layout"` — file names of the form module against the canonical set (run it BEFORE writing files).
- `kind="code"` — the TS you wrote: unknown `@reformer` symbols, operators outside their schema, keys and factories of the former contract.
- `kind="behaviors"` — behaviors acyclic (declare `{ target, reads }` per computed field).
- `kind="json-schema"` — the JSON document well-formed (pass your registry's component/dataSource names).
- `kind="bundle"` — a whole FormIntent + schema, cross-checked against each other.

Code review → prompt `review`.

You already have the workflow above. Look up specific pieces with `find_recipe` and
`get_symbol_docs`; for the full reference in one place, read `reformer://guide`. Individual
doc sections are per-heading — discover their exact URIs with ListResources.
