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

The schema is a tree; each **field leaf** carries value-signal + component + props — **binding + display
only, no validators**. Validation is a *separate* ambient schema (step 4), not a key on the leaf.
Layout (Step/Section/Grid) stays in React, not in the schema.

```ts
import { Input } from '@reformer/ui-kit';
const schema = {
  children: [
    { value: model.$.email, component: Input, componentProps: { label: 'Email' } },
    { value: model.$.password, component: Input, componentProps: { label: 'Password' } },
  ],
};
```

Traps: `value: model.$.field` (a signal) — never `value: 'field'`. Don't forget `componentProps.label`.
No `validators:` key on the leaf — the old `{ value, validators: [...] }` shape is gone; rules live in
their own `defineValidationSchema` (step 4).

## 3. Create the form — `createForm({ model, schema })`

```ts
import { createForm } from '@reformer/core';
const form = createForm<RegForm>({ model, schema }); // FormProxy: form.email is a node bound to model.$.email
```

Overloads `createForm({ form: {...} })` and `createForm(flatSchema)` are legacy — use `{ model, schema }`.

## 4. Validation — `defineValidationSchema` + `validateModel(model, schema)`

Validation is its **own ambient schema** — a plain function over the model, imported from
`@reformer/core/validation`, separate from the field schema (step 2) and from behaviors (step 5).
It runs **on demand** (submit / step), not reactively. Never a `validators:` array on a leaf.

- **Schema**: `defineValidationSchema<T>(({ model }) => { … })` — a thin identity wrapper (like
  `defineFormBehavior`). The body calls bare **operators**, valid only during a `validateModel` run:
  - `validate(sig, rules[])` — sync value rules.
  - `validateAsync(sig, asyncRules[])` — async rules `(value, { signal }) => Promise<ValidationError | null>`;
    the runner awaits them and passes an `AbortSignal` so a superseded request is cancelled. Network failure → return `null`.
  - `validateWhen(() => cond, () => { … })` — conditional branch: rules inside are active when `cond` is true, else their fields are cleared.
  - `cross(sig, (f) => err | null)` — cross-field; `f` is a **snapshot** of the current scope (`model.get()`), not `(value, scope, root)`.
  - `each(model.arr, (im) => { … })` — per array item (`im` is the item sub-model).
  - `apply(...schemas)` — compose sub-schemas over the same model (e.g. build the full schema from per-step ones).
- **Rules** are factories from `@reformer/core/validators` (`required()`, `email()`, `min(50000)` — now
  nullable-accepting), reused as-is, or inline `(value) => ValidationError | null`.
- **Runner**: `validateModel(model, schema): Promise<boolean>` — routes each error into its own node
  (`getNodeForSignal(sig).setErrors(...)`), clears fields that became valid, cancels a superseded run
  (returns `false` — fail-closed), and returns `true` even when a `severity: 'warning'` error is showing
  (warnings don't block submit). It — not `form.validate()` — is what executes the rules. Keep the schema a
  **stable `const`** (identity keys the stale-run cancellation).

```ts
import { defineValidationSchema, validate, validateAsync, cross, validateModel }
  from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';

const schema = defineValidationSchema<RegForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  validate(model.$.confirmPassword, [required()]);
  // cross-field reads a form snapshot — no scope/root params
  cross(model.$.confirmPassword, (f) =>
    f.confirmPassword !== f.password ? { code: 'mismatch', message: 'Passwords differ' } : null);
  // async — receives { signal }; network failure returns null (never blocks submit)
  validateAsync(model.$.email, [
    async (value, { signal }) => {
      const res = await fetch(`/api/check-email?e=${value}`, { signal });
      return (await res.json()).available ? null : { code: 'email-taken', message: 'Email taken' };
    },
  ]);
});

const ok = await validateModel(model, schema); // Promise<boolean>
```

Trap: the old `ModelValidator (value, scope, root)` placed in a leaf's `validators` is gone, and
`validateFormModel` → `{ valid, errors }` is replaced by `validateModel` → `Promise<boolean>` that routes
errors into the nodes itself. Cross-field is now `cross(sig, f => …)` over `model.get()`; async is
`validateAsync` with `{ signal }`, not a `Promise`-returning `ModelValidator`.

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

Bridge to validation (the only overlap between the layers): behaviors don't own validation, but a
behavior can *trigger* a re-run — `revalidateWhen([model.$.dep], () => void validateModel(model, schema))`.

## 6. Arrays & Wizard (when needed)

- **Array** node in the schema: `{ array: model.items, item: (im) => itemSchema, initialValue: {...full...} }`.
  In React use the `@reformer/cdk` `FormArray` compound; **key rows by `id`, not index**. `find_recipe form-array`.
- **Wizard**: `@reformer/cdk` `FormWizardConfig = { validateStep?, validateAll? }` — two callbacks returning
  `boolean | Promise<boolean>` (NOT schemas). Build them from validation schemas with a
  `makeValidationConfig(model)` returning `{ validateStep: (n) => validateModel(model, STEP_SCHEMAS[n - 1]),
  validateAll: () => validateModel(model, fullSchema) }`, where `fullSchema = defineValidationSchema(() =>
  apply(...STEP_SCHEMAS, extras))`. `find_recipe wizard`.

## 7. Render

- **ui-kit**: `<FormField control={form.email} />` per field.
- **renderer-react**: `createRenderSchema<T>(() => renderNodeTree)`, conditional display via `hideWhen(node, () => cond)`, mount with `<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />`. `find_recipe render-schema`.
- **renderer-json**: JSON with string operators `$model(path)` / `$component(Name)` / `$dataSource(NAME)`,
  a `defineRegistry` mapping names → components, `convertJsonToM1Tree(json, registry, model)`, `<JsonRendererProvider settings={{ registry, model }}>` + `<JsonFormRenderer schema={json} />`.
  **Validate the JSON with the `validate_json_schema` tool before rendering.** `find_recipe json-schema`.

### Validation is a separate schema, not part of the render tree (renderer-react / renderer-json)

The render tree (RenderSchema or JSON) describes **layout** and carries no validators — `JsonFieldNode`
has no `validators`, a RenderSchema leaf is display config, and there is no `$validator(...)` JSON operator
by design. Validation is its own `defineValidationSchema<T>(({ model }) => …)` bound to the same model and
run with `validateModel(model, schema)` at submit / per step. So a renderer target keeps up to **three**
artifacts over one model: the **field schema** (values + components, for `createForm`) — for renderer-json
produced by `convertJsonToM1Tree(json, registry, model)` — the **validation schema** (rules, for
`validateModel`), and optionally a **behavior schema** (`defineFormBehavior`). Schema and rules stay
independent: a layout pushed from the server changes display without touching the rules, and vice versa.
For a wizard the validation schema is flat (all fields), independent of how steps nest in the render tree.

## Checklist before you finish

1. Model initialises every field (incl. array-item fields). 2. Leaves are `{ value: model.$.x, component, ... }`
— no `validators:` on the leaf. 3. Validation is a separate `defineValidationSchema` (rules = `@reformer/core/validators`
factories, `cross`, `validateAsync`); run via `validateModel(model, schema)` → `Promise<boolean>`. 4. Behaviors are
acyclic (`check_behaviors`). 5. Arrays keyed by `id`. 6. renderer-json schema passed `validate_json_schema` → `valid`.
