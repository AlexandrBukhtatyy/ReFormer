# Form-building workflow

The canonical order for building a ReFormer form. A form is described ONE way for every way of
drawing it: one schema tree, one binding handle (`model.$.…`), one assembly (`createForm`), one
behavior. The single reactive model is the source of truth. Follow the steps top to bottom. Each
lists the decision, the key API, and the traps the runtime would otherwise punish. Look up exact
signatures with `get_symbol_docs`, worked examples with `find_recipe` (start with
`find_recipe unified-contract`).

```ts
// model.ts — initial values and templates of new array rows
export const createCreditModel = () =>
  createModel<CreditForm>({
    loanType: 'consumer',
    registrationAddress: blankAddress(),
    properties: arrayOf(blankProperty),
  });

// form.schema.ts — one schema for every way of drawing
export const creditSchema = (model: FormModel<CreditForm>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  children: [
    {
      selector: 'loan', // the key in validation.steps
      component: Step,
      componentProps: { title: 'Кредит' },
      children: [
        { model: model.$.loanType, component: SelectAsync, componentProps: { label: 'Тип' } }, // field
        { model: model.$.registrationAddress, part: address }, // sub-form
        { model: model.$.properties, component: FormArray, item: property }, // array of sub-forms
      ],
    },
  ],
});

// index.tsx — one assembly, one hook
const credit = useFormBundle(() =>
  createForm<CreditForm>({
    model: createCreditModel(),
    schema: creditSchema, // JSON: schema: creditJson, registry
    behavior: creditBehavior,
    validation: creditValidation,
  })
);
```

| Layer      | field                             | array                                    | sub-form                              |
| ---------- | --------------------------------- | ---------------------------------------- | ------------------------------------- |
| schema     | `{ model: model.$.x, component }` | `{ model: model.$.items, item }`         | `{ model: model.$.group, part }`      |
| validation | `validate(model.$.x, rules)`      | `applyEach(model.$.items, itemRules)`    | `apply(model.$.group, groupRules)`    |
| behavior   | `compute(model.$.x, …)`           | `applyEach(model.$.items, itemBehavior)` | `apply(model.$.group, groupBehavior)` |

## 0. Choose who draws the markup

- **core** — you write the markup in JSX: one `<FormField control={bundle.form.x} />` per field.
- **renderer-react** — `FormRenderer` draws the schema tree (layout + conditional display as data).
- **renderer-json** — the same tree as a JSON document + a component `registry` (string operators).

Steps 1–6 are the same for all three. They differ only in the shape of the schema passed to the
assembly (a builder or a document + `registry`) and in step 7.

## 1. Model — `createModel<T>(initial)`

The model owns all values. Decisions: the data shape as a `type` (NOT `interface` — see
`find_recipe type-safety-recipes`), and full initial values.

- Numbers optional → `null`; strings → `''`.
- An array of sub-forms is declared together with the template of a new row: `arrayOf(blank, items?)`.
  «Add» is then `model.items.push()` with no argument. The template returns the FULL element with
  plain values. An array that is the value of one field (a multi-select) is just `[]`.
- Export a factory (`createMyModel`), one model per assembly. Don't create it with `useMemo` in a
  component: the assembly in step 3 lives inside `useFormBundle` (a lazy `useState`).

```ts
import { arrayOf, createModel } from '@reformer/core';
type RegForm = { email: string; password: string; age: number | null; phones: Phone[] };
const blankPhone = (): Phone => ({ number: '', kind: 'mobile' });
export const createRegModel = () =>
  createModel<RegForm>({ email: '', password: '', age: null, phones: arrayOf(blankPhone) });
// model.email (value) · model.$.email (binding handle) · model.get() · model.set(full)
```

## 2. Schema — one tree of nodes

ONE schema: a field is described once and stands right where it is drawn. The schema is a builder
`(model) => node`; a node is bound to the model by the key `model` and the handle `model.$.…` —
**binding + display only, no validators**.

| Node      | Shape                                                   | Told apart by                 |
| --------- | ------------------------------------------------------- | ----------------------------- |
| field     | `{ model, component, componentProps }`                  | has `model`, no `item`/`part` |
| array     | `{ model, item, component, componentProps }`            | `model` + `item`              |
| sub-form  | `{ model, part }`                                       | `model` + `part`              |
| container | `{ component, componentProps, children }`               | has `children`, no `model`    |

```ts
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Box, Input, Section } from '@reformer/ui-kit';

// a sub-form (part): declared once, receives a sub-model, paths inside are relative to it
const address = (model: FormModel<Address>): FormSchemaNode => ({
  component: Box,
  children: [
    { model: model.$.region, component: Input, componentProps: { label: 'Регион' } },
    { model: model.$.city, component: Input, componentProps: { label: 'Город' } },
  ],
});

export const formSchema = (model: FormModel<MyForm>): FormSchemaNode => ({
  component: Box,
  children: [
    { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
    {
      selector: 'registration',
      component: Section,
      componentProps: { title: 'Адрес регистрации' },
      children: [{ model: model.$.registrationAddress, part: address }],
    },
  ],
});
```

Traps:

- `model: model.$.field` (a handle) — never a string, never the form node `form.field`.
- `model.$.…` is the handle for a field, a group AND an array. Without `$` you only read a value,
  mutate (`model.items.push()`) or pass a sub-model on.
- The keys `value:` / `array:`, the array facade `model.items` in a binding position, a second
  «render schema» describing the same fields — the former contract.
- No `validators:` key on a node — rules live in their own `defineValidationSchema` (step 4).
- Containers are optional: whoever writes the markup in JSX keeps only field nodes in the schema.
- `selector` is a node id for rules of the behavior (step 5), not a model path.

## 3. Assemble — ONE call, `createForm`

The model, the schema tree, the form, the behavior and the validation are built in a single pass.
The call is the same for every way of drawing; a JSON document goes in as `schema` together with
`registry`.

```ts
import { createForm, useFormBundle } from '@reformer/core';

const bundle = useFormBundle(() =>
  createForm<RegForm>({
    model: createRegModel(), // or initial: INITIAL
    schema: formSchema, // BUILDER (model) => node; JSON: the document + registry
    behavior: formBehavior, // optional, step 5
    validation: formValidation, // optional, step 4
  })
);
// bundle = { model, form, validation?, render }
// bundle.form.email is a node bound to model.$.email; bundle.validation carries validateStep/validateAll
```

In React always wrap the factory in `useFormBundle`: it is a lazy `useState` and runs the factory
once, while `useMemo` may drop its cache and rebuild the form, losing typed input.

`createCoreForm`, `createReactForm`, `createJsonForm` and the hooks `useReactForm` / `useJsonForm`
are the former contract — three factories for three ways of drawing. Low-level
`createFormFromModel({ model, schema })` remains public for special cases; the overloads
`createLegacyForm({ form: {...} })` and `createLegacyForm(flatSchema)` are legacy.

## 4. Validation — `defineValidationSchema`

Validation is its **own ambient schema** — a plain function over the model, imported from
`@reformer/core/validation`, separate from the form schema (step 2) and from the behavior (step 5).
It runs **on demand** (submit / step), not reactively. Never a `validators:` array on a node.

- **Schema**: `defineValidationSchema<T>(({ model }) => { … })`. The body calls bare **operators**:
  - `validate(model.$.x, rules[])` — sync value rules.
  - `validateAsync(model.$.x, asyncRules[])` — async rules `(value, { signal }) => Promise<ValidationError | null>`;
    the runner awaits them and passes an `AbortSignal` so a superseded request is cancelled. Network failure → return `null`.
  - `validateWhen(() => cond, () => { … })` — conditional branch: rules inside are active when `cond` is true, else their fields are cleared.
  - `cross(model.$.x, (f) => err | null)` — cross-field; `f` is a **snapshot** of the current scope, not `(value, scope, root)`.
  - `apply(model.$.group, groupRules)` — a sub-form: `groupRules` is a `defineValidationSchema<Group>` that receives the sub-model; one set of rules serves several groups.
  - `applyEach(model.$.items, itemRules)` — the same for every element of an array.
  - `apply(...schemas)` — compose schemas over the same model.

  A schema attached with `apply` / `applyEach` has its own scope: `cross` inside it receives the
  snapshot of the group / the row. `each(model.items, …)` and a direct call
  `groupRules({ model: model.group })` are the former contract.
- **Rules** are factories from `@reformer/core/validators` (`required()`, `email()`, `min(50000)`),
  reused as-is, or inline `(value) => ValidationError | null`.
- **To the assembly**: `validation: schema`, or — for a wizard — data
  `{ steps: { <step selector>: schema | null }, extras? }`. The assembly builds
  `bundle.validation` = `{ validateStep, validateAll, … }` from it.
- **Runner**: `validateModel(model, schema): Promise<boolean>` — routes each error into its own node,
  clears fields that became valid, cancels a superseded run (returns `false` — fail-closed), and
  returns `true` even when a `severity: 'warning'` error is showing (warnings don't block submit).
  Keep the schema a **stable `const`** (identity keys the stale-run cancellation).

```ts
import { apply, applyEach, cross, defineValidationSchema, validate, validateAsync } from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';

const phoneRules = defineValidationSchema<Phone>(({ model }) => {
  validate(model.$.number, [required()]);
});

export const formValidation = defineValidationSchema<RegForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
  // cross-field reads a snapshot of the scope — no scope/root params
  cross(model.$.confirmPassword, (f) =>
    f.confirmPassword !== f.password ? { code: 'mismatch', message: 'Passwords differ' } : null
  );
  // async — receives { signal }; network failure returns null (never blocks submit)
  validateAsync(model.$.email, [
    async (value, { signal }) => {
      const res = await fetch(`/api/check-email?e=${value}`, { signal });
      return (await res.json()).available ? null : { code: 'email-taken', message: 'Email taken' };
    },
  ]);
  apply(model.$.registrationAddress, addressRules); // sub-form
  applyEach(model.$.phones, phoneRules); // array rows
});
```

Trap: the old `ModelValidator (value, scope, root)` placed in a leaf's `validators` is gone, and
`validateFormModel` → `{ valid, errors }` is replaced by `validateModel` → `Promise<boolean>` that routes
errors into the nodes itself.

## 5. Behavior — the ONLY behavior of the form (optional)

One function, one file (`form.behavior.ts`), one `behavior` field of the assembly. Next to the model
and the form it gets the schema, so links over the model and rules for schema nodes stand side by
side. Everything is imported from `@reformer/core/behaviors`.

```ts
import { apply, applyEach, compute, defineFormBehavior, enableWhen, hideWhen, onComponentEvent } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior<CreditForm>(({ model, form, schema }) => {
  const isMortgage = () => model.loanType === 'mortgage';

  // links over the model
  compute(model.$.monthlyPayment, () => computeMonthlyPayment(model)); // reads OTHER fields, writes its own
  enableWhen(model.$.propertyValue, isMortgage, { resetOnDisable: true });

  // rules for schema nodes — addressed by `selector`
  hideWhen(schema.node('mortgage'), () => !isMortgage());
  onComponentEvent(schema.node('wizard'), 'onSubmit', async () => {
    await submitCreditApplication(model.get());
  });

  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior); // sub-forms
  applyEach(model.$.properties, propertyBehavior); // array rows
});
```

- Conditions read the **model** (`model.loanType`) in both kinds of rules — one constant serves
  `enableWhen` and `hideWhen`. `form.loanType.value.value` in a condition is the former contract.
- `hideWhen` hides a NODE; the field stays in the model and is still validated. When it must stop
  participating, pair it with `enableWhen` (which of the two — `choose_api`).
- Rules for nodes are executed by `FormRenderer`. When the markup is written by hand in JSX they do
  nothing: visibility, submit and data loading stay in JSX there.
- **Scopes are isolated.** `schema.node(selector)` sees its own scope only: the root behavior — the
  root tree without the contents of array `item`s and sub-form `part`s. A node inside a row or a
  part is addressed from the sub-behavior passed to `applyEach` / `apply`, which receives its own
  `schema`. So two mounts of one part do not conflict.
- A separate behavior for the render layer (`form.render.ts`, the `renderBehavior` field, a factory
  `(form, model, validation) => (schema) => …`) is the former contract.

Trap: **cycles** (`compute(a, () => a)` or `a→b→a`) loop forever. Plan dependencies and run them
through `validate_form kind="behaviors"`; see `find_recipe cycle`.

Bridge to validation (the only overlap between the layers): a behavior can _trigger_ a re-run —
`revalidateWhen([model.$.dep], () => void validateModel(model, schema))`.

## 6. Arrays & Wizard (when needed)

- **Array of sub-forms**: `arrayOf(blank)` in the model + the node
  `{ model: model.$.items, component: FormArray, item: itemRow }`; `itemRow` is a part
  `(model: FormModel<Item>) => node`. The node needs no `initialValue` — it is only a fallback for
  forms whose model is created from data without code. In JSX use `FormArraySection` from
  `@reformer/ui-kit` or the `@reformer/cdk` `FormArray` compound; **key rows by `id`, not index**.
  `find_recipe form-array`.
- **Wizard**: the library `FormWizard` (`@reformer/ui-kit`) as a schema node, steps are its
  `children`: `{ selector: 'loan', component: Step, componentProps: { title, icon }, children }`
  (`Step` from `@reformer/cdk/form-wizard`). A step is linked to its rules by `selector` —
  `validation: { steps: { loan: loanRules, contacts: contactsRules }, extras: crossStepRules }`; a
  step without a `selector` falls back to its ordinal number. The wizard takes the form and the
  validation from the assembly itself: no app shim, no `componentProps.steps`, no
  `makeValidationConfig(model)`, no `onInit` + `patchProps({ form, config })` — all of it is the
  former contract. In JSX `FormWizard` still takes `form`, `config={bundle.validation}` and `steps`
  as props. `find_recipe wizard`.

## 7. Draw

The bundle from step 3 goes to whoever draws.

- **core**: `<FormField control={bundle.form.email} />` per field; a wizard takes `form={bundle.form}`
  and `config={bundle.validation}`.
- **renderer-react**: `<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />`
  (`FormRenderer` from `@reformer/renderer-react`). `find_recipe render-schema`.
- **renderer-json**: the tree as a document of format 2 — `{ "format": 2, "parts": { … }, "root": { … } }`
  with string operators `$model(path)` / `$component(Name)` / `$dataSource(NAME)` / `$part(name)`,
  a `defineRegistry` mapping names → components (incl. `FormWizard`, `Step`, `FIELD_WRAPPER`), then
  the same `createForm({ model, schema: document, registry, … })` and `<FormRenderer form={bundle} />`
  — the field wrapper comes from the registry. A document without `"format": 2` is the former format
  (keys `value`/`array`, steps in `componentProps.steps`); `migrateJsonSchema` converts one.
  **Validate the document with `validate_form kind="json-schema"` before rendering**, and in dev
  call `validateFormSchema(document, { registry })` explicitly. `find_recipe json-schema`.
- **Field components**: put the component ITSELF into `component` — `Input`, `InputNumber` (numbers; `Input` has no `type: 'number'`), `InputSuggest`, `SelectAsync` (registry `Select`), `CheckboxWithLabel` (`Checkbox`), `SwitchWithLabel` (`Switch`), `RadioGroupOptions` (`RadioGroup`), `DatePicker`, `FileUploadDropzone` / `FileUploadInput` (no `variant` prop), … A ui-kit control declares its dialect (`checked`/`onCheckedChange`, `onValueChange`, …) as a static adapter, and the field wrapper (`FormField.Control`, the renderer leaf) binds it to the value seam itself. The old `*Field` line (`InputField`, `SelectField`, `CheckboxField`, …) and `withFormControl` were removed without aliases.
- **Raw third-party controls (non-ui-kit)**: add `resolveFieldAdapter(component) => FieldAdapter | undefined` to the renderer `settings` — the renderer maps the value-seam (`value` + `onChange(value)`) to each control's dialect. For your own control you can instead declare the dialect once with `defineFieldControl(Component, { adapter })` from `@reformer/ui-kit/fields`.

### Validation is a separate schema, not part of the form schema

The form schema (a TS tree or a JSON document) describes **binding and layout** and carries no
validators — there is no `$validator(...)` JSON operator by design. Validation is its own
`defineValidationSchema<T>(({ model }) => …)` bound to the same model. So a form keeps **three**
artifacts over one model, the same for every way of drawing: the **schema** (`form.schema.ts`), the
**validation** (`form.validation.ts`) and the **behavior** (`form.behavior.ts`). Schema and rules
stay independent: a layout pushed from the server changes display without touching the rules, and
vice versa.

## Checklist before you finish

1. The model initialises every field; arrays of sub-forms are `arrayOf(blank)`. 2. Nodes are
`{ model: model.$.x, component, ... }` — the key is `model`, no `validators:` on a node. 3. One
assembly: `createForm` in `useFormBundle`. 4. Validation is a separate `defineValidationSchema`
(sub-forms via `apply`, arrays via `applyEach`), passed as `validation`. 5. One behavior
`({ model, form, schema })`, acyclic (`validate_form kind="behaviors"`). 6. Arrays keyed by `id`.
7. A JSON document has `"format": 2` and passed `validate_form kind="json-schema"`. 8. The code
passed `validate_form kind="code"` — it reports keys and factories of the former contract.
