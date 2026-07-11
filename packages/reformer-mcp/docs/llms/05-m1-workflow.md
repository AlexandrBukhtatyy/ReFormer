# M1 form-building workflow

The canonical order for building a ReFormer form (M1 = single reactive model is the
source of truth). Follow it top to bottom. Each step lists the decision, the key API,
and the traps the runtime would otherwise punish. Look up exact signatures with
`get_symbol_docs`, worked examples with `find_recipe`.

## 0. Choose the render target

- **core + ui-kit** — plain React: one `<FormField control={form.x} />` per field. Simplest.
- **renderer-react** — declarative `RenderSchema` tree (layout + conditional display as data).
- **renderer-json** — machine-readable JSON schema + a component `registry` (string operators).

All three share steps 1–6; they differ only at step 7.

## 1. Model — `createModel<T>(initial)`

The model owns all values. Decisions: the data shape as a `type` (NOT `interface` — see
`find_recipe type-safety-recipes`), and full initial values.

- Numbers optional → `null`; strings → `''`; arrays → `[]`.
- Array items must initialise **every** field, or the item's sub-model has no signals for the missing ones.
- Stabilise the instance in `useMemo` so it isn't rebuilt each render.

```ts
import { createModel } from '@reformer/core';
type RegForm = { email: string; password: string; age: number | null };
const model = createModel<RegForm>({ email: '', password: '', age: null });
// model.email (value) · model.$.email (signal) · model.get() · model.set(full)
```

## 2. Schema — field leaves

The schema is a tree; each **field leaf** carries value-signal + component + props + validators.
Layout (Step/Section/Grid) stays in React, not in the schema.

```ts
import { Input } from '@reformer/ui-kit';
import { required, email, minLength } from '@reformer/core/validators';
const schema = {
  children: [
    { value: model.$.email, component: Input, componentProps: { label: 'Email' }, validators: [required(), email()] },
    { value: model.$.password, component: Input, componentProps: { label: 'Password' }, validators: [required(), minLength(8)] },
  ],
};
```

Traps: `value: model.$.field` (a signal) — never `value: 'field'`. Don't forget `componentProps.label`.

## 3. Create the form — `createForm({ model, schema })`

```ts
import { createForm } from '@reformer/core';
const form = createForm<RegForm>({ model, schema }); // FormProxy: form.email is a node bound to model.$.email
```

Overloads `createForm({ form: {...} })` and `createForm(flatSchema)` are legacy — use `{ model, schema }`.

## 4. Validation — `validateFormModel(model, schema)`

- Value-only validators: `required()`, `email()`, `min(50000)` — factories from `@reformer/core/validators`.
- Cross-field / async: a custom `ModelValidator` `(value, scope, root) => ValidationError | null` (or `Promise<...>`), placed in a field's `validators`.
- Run all validators with `validateFormModel(model, schema)` → `{ valid, errors }`. It — not `form.validate()` — executes schema validators.

```ts
import { validateFormModel, type ModelValidator } from '@reformer/core';
const passwordsMatch: ModelValidator<string, unknown, RegForm> =
  (value, _scope, root) => (value !== root.password ? { code: 'mismatch', message: 'Passwords differ' } : null);
```

## 5. Behaviors — reactive dynamics (optional)

Computed / copied / conditionally-enabled fields. Two styles: DSL `defineFormBehavior` + operators,
or primitives in a `useEffect`. Register the DSL via `createForm({ model, schema, behavior })`.

```ts
import { defineFormBehavior } from '@reformer/core/behaviors';
const behavior = defineFormBehavior<OrderForm>(({ model, form }) => {
  compute(model.$.total, () => model.price * model.quantity);          // reads OTHER fields, writes its own
  copyFrom(model.$.registration, model.$.residence, { when: () => model.sameAddress });
  enableWhen(form.residence, () => model.sameAddress === false);        // state op — affects the node, not the value
});
```

Trap: **cycles** (`compute(a, () => a)` or `a→b→a`) loop forever. Plan dependencies and run them
through the `check_behaviors` tool; see `find_recipe cycle`.

## 6. Arrays & Wizard (when needed)

- **Array** node in the schema: `{ array: model.items, item: (im) => itemSchema, initialValue: {...full...} }`.
  In React use the `@reformer/cdk` `FormArray` compound; **key rows by `id`, not index**. `find_recipe form-array`.
- **Wizard**: `@reformer/cdk` `FormWizardConfig = { validateStep?, validateAll? }` — two callbacks returning
  `boolean | Promise<boolean>` (NOT schemas). `find_recipe wizard`.

## 7. Render

- **ui-kit**: `<FormField control={form.email} />` per field.
- **renderer-react**: `createRenderSchema<T>(() => renderNodeTree)`, conditional display via `hideWhen(node, () => cond)`, mount with `<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />`. `find_recipe render-schema`.
- **renderer-json**: JSON with string operators `$model(path)` / `$component(Name)` / `$dataSource(NAME)`,
  a `defineRegistry` mapping names → components, `convertJsonToM1Tree(json, registry, model)`, `<JsonRendererProvider settings={{ registry, model }}>` + `<JsonFormRenderer schema={json} />`.
  **Validate the JSON with the `validate_json_schema` tool before rendering.** `find_recipe json-schema`.

### Validation is on the model, not the render tree (renderer-react / renderer-json)

The render tree (RenderSchema or JSON) describes **layout**. It does NOT carry validators —
`JsonFieldNode` has no `validators`, and a RenderSchema leaf is display config. Validation lives
on the **model**: build a field schema `{ children: [{ value: model.$.x, validators: [...] }] }`,
pass it to `createForm({ model, schema })`, and run `validateFormModel(model, schema)` at submit.
So for renderer targets you keep two things bound to the same model: the **field schema** (values +
validators, for `createForm`/`validateFormModel`) and the **render tree** (layout, for the renderer).
For a wizard, the field schema is flat (all fields), independent of how steps nest them in the render tree.

## Checklist before you finish

1. Model initialises every field (incl. array-item fields). 2. Leaves are `{ value: model.$.x, component, ... }`.
3. Validators are factories/`ModelValidator`; run via `validateFormModel`. 4. Behaviors are acyclic (`check_behaviors`).
5. Arrays keyed by `id`. 6. renderer-json schema passed `validate_json_schema` → `valid`.
