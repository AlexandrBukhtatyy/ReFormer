You design and write a new form on `@reformer/*`.

## Args

- target: `{{target}}` {{targetLabel}}
- description: {{description}}

## Stage 0 — MCP discovery (CRITICAL: do this before any code)

{{stackBlock}}

⚠️ **If the discovery block above contains a question for the orchestrator** — STOP and return the question. Do NOT fall back to plain HTML / inline-style — that invalidates the MCP test.

## The contract — the same for every target

A form is described ONE way, whoever draws it: markup by hand in JSX (`core`), `FormRenderer` over a TS schema (`renderer-react`), `FormRenderer` over a JSON document (`renderer-json`). The targets differ only in the shape of the schema (a builder function or a document + registry) and in who draws the markup.

| File                 | What it holds                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `model.ts`           | the data type, initial values, templates of new array rows (`arrayOf(blank)`); a factory over `createModel<T>` |
| `form.schema.ts`     | ONE tree of nodes: a field sits right where it is drawn                                                       |
| `form.validation.ts` | rules over the model (`defineValidationSchema`) — prompt `add-feature`, `feature: validation` |
| `form.behavior.ts`   | the ONLY behavior: links over the model and rules for schema nodes — prompt `add-feature`, `feature: behavior` |
| `index.tsx`          | the assembly: `createForm` + `useFormBundle` + whoever draws                                                  |

## Critical inline rules

- **The model is the source of truth**: `createModel<T>(initialValues)` holds the data; values never live in the schema. Export a factory (`export const createMyModel = () => createModel<MyForm>({ … })`) — one model per assembly.
- **One schema, one binding key — `model`**. A node is bound to a part of the model by the key `model` and the handle `model.$.…`:

  | Node      | Shape                                                          | Told apart by                |
  | --------- | -------------------------------------------------------------- | ---------------------------- |
  | field     | `{ model: model.$.email, component: Input, componentProps }`   | has `model`, no `item`/`part` |
  | array     | `{ model: model.$.items, component: FormArray, item: itemRow }` | `model` + `item`             |
  | sub-form  | `{ model: model.$.address, part: address }`                    | `model` + `part`             |
  | container | `{ component: Section, componentProps, children: [ … ] }`      | has `children`, no `model`   |

  `model.$.…` is ALWAYS the binding handle — for a field, a group and an array alike. Without `$` you only read a value (`model.loanType === 'mortgage'`), mutate (`model.items.push()`) or pass a sub-model on. The keys `value:` and `array:` and the array facade `model.items` in a binding position are the former contract — ❌ do not emit them.

- **The schema is a BUILDER**, never a prebuilt tree: `export const formSchema = (model: FormModel<MyForm>): FormSchemaNode => ({ … })`. Nodes hold the model's own handles, so the tree cannot exist before the model. The builder takes ONE argument — there is no `(model, form?)` second parameter and nobody calls it twice.
- **Sub-form = a part**, declared once, mounted wherever needed: `const address = (model: FormModel<Address>): FormSchemaNode => ({ component: Box, children: [{ model: model.$.city, component: Input }] })`, then `{ model: model.$.registrationAddress, part: address }` and `{ model: model.$.residenceAddress, part: address }`. Inside a part every path is relative to the sub-model it receives. A title for one particular place is an ordinary container around the node.
- **Array of sub-forms**: `{ model: model.$.properties, component: FormArray, item: propertyRow }` — `item` is the same kind of part, built for every element. The template of a NEW element lives in the model: `properties: arrayOf(blankProperty)` (`arrayOf` from `@reformer/core`), so the node carries no `initialValue` and «Add» is `model.properties.push()` with no argument. `component` is required for add/remove/reorder UI — the renderer ships no array chrome; use `FormArray` (editable) or `List` (display-only) from `@reformer/ui-kit`. An array that is the VALUE of one field (multi-select `tags: []`) is an ordinary field node and needs no template.
- **The schema carries NO validators**: a leaf `validators: [...]` array is the old shape — do not emit it. Validation is a separate `defineValidationSchema<T>(({ model }) => …)`; behavior is `defineFormBehavior<T>(({ model, form, schema }) => …)`. This prompt does NOT write them — use the prompt `add-feature` (`feature: validation` / `feature: behavior`); every node here stays pure description.
- **ONE assembly — `createForm`** (`@reformer/core`), wrapped in `useFormBundle`: `useFormBundle(() => createForm<MyForm>({ model: createMyModel(), schema: formSchema, behavior, validation }))` → a bundle `{ model, form, validation?, render }`. `useFormBundle` runs the factory exactly once (a lazy `useState`); `useMemo` is ❌ wrong here — React may drop its cache and rebuild the form, losing typed input. `createCoreForm` / `createReactForm` / `createJsonForm` and the hooks `useReactForm` / `useJsonForm` are the former contract — ❌ do not emit them.
- **Who draws**:
  - `renderer-react` — `<FormRenderer form={bundle} settings=\{{ fieldWrapper: FormField }} />` (`FormRenderer` from `@reformer/renderer-react`, `FormField` from `@reformer/ui-kit`);
  - `renderer-json` — `<FormRenderer form={bundle} />`: the field wrapper comes from the registry entry `FIELD_WRAPPER`;
  - `core` — your own JSX over the same bundle: `<FormField control={bundle.form.email} testId="email" />`. NOT the cdk compound `FormField.Root/Label/Control/Error` for ordinary fields.
- **Conditional fields → hide, not disable**. Type/status conditional (loanType, employmentStatus) → a rule for a schema node in `form.behavior.ts`: `hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage')` — so give that container a `selector: 'mortgage'` now. Node rules are executed by the renderer; for `core` the same condition is a JSX conditional (`{model.loanType === 'mortgage' && <FormField … />}`). Progressive disclosure (`confirmPassword` after `password`) → `enableWhen(model.$.confirmPassword, () => !!model.password)` — out of scope here, flag it for `add-feature` (`feature: behavior`).
- **Wizard** — a library component as a schema node, steps are its children: `{ selector: 'wizard', component: FormWizard, children: [{ selector: 'loan', component: Step, componentProps: { title: 'Кредит' }, children: [ … ] }] }` (`FormWizard` from `@reformer/ui-kit`, `Step` from `@reformer/cdk/form-wizard`). The step `selector` is the key of that step's rules in `validation.steps`. The wizard takes the form and the validation from the assembly itself — there is no app shim, no `componentProps.steps`, no `onInit`/`patchProps` injection. Details: prompt `add-feature` (`feature: wizard`).
- **Spec compliance — literal**: every spec field = a separate schema field with the same name and the same step. No merging, no skipping, no moving.
- **testId convention**: dotted path (`step1.loanAmount`, `step2.passportData.series`), never bare leaf names — collisions inevitable across steps. **NEVER pre-prefix `input-` to the testId value** — the renderer auto-prefixes when emitting `data-testid="input-${testId}"`. Pre-prefixed `testId: 'input-step1.X'` produces double-prefixed `data-testid="input-input-step1.X"` → playwright selectors that look for `[data-testid^="input-step1."]` silently miss every field.
- **User-facing strings**: from spec or in the user's native language. No default English `"Select an option..."` placeholders.
- **`required(...)` always with `{ message }`**: never default `"Поле обязательно для заполнения"`. (Applies in the separate validation layer — validator factories `required()/min()/…` come from `@reformer/core/validators` and live inside the `defineValidationSchema`, never on schema nodes.)
- **`componentProps` use camelCase React-style prop names**, not HTML-lowercase. Pass-through to the React leaf component → React DOM rejects the lowercase variant with a console warning. Common offenders: `readOnly` (NOT `readonly`), `htmlFor` (NOT `for`), `tabIndex` (NOT `tabindex`), `autoFocus` (NOT `autofocus`), `maxLength` / `minLength` (NOT `maxlength` / `minlength`).
- **A field node carries the MODEL HANDLE (`model: model.$.x`), NEVER the resolved `form.X` FieldNode.** The tree binds to the model; the state node (errors/disabled) is resolved by the handle. Putting `form.X` into a node is wrong — it is neither a handle nor a component, so the node is **silently ignored**: the form looks empty, no console error. A step body / array row / sub-form receives the **model** (or its sub-model), never a `path` and never the `form` instance.

  ```typescript
  // ❌ silent fail — FieldNodes, not handles; the renderer ignores these nodes
  const step = (form: FormProxy<MyForm>) => ({
    component: Box,
    children: [{ component: form.email }, { component: form.password }],
  });

  // ✅ correct — nodes carry model handles; the builder takes the model only
  export const formSchema = (model: FormModel<MyForm>): FormSchemaNode => ({
    component: Box,
    children: [
      { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
      { model: model.$.password, component: InputPassword, componentProps: { label: 'Пароль' } },
    ],
  });
  ```

- **All input-rendering `componentProps` (`label`, `placeholder`, `options`, `mask`, `rows`, anything the component reads) MUST live on the field node's `componentProps`**. Symptoms when a prop is dropped: `label` missing → the field renders without a label; `options` missing → `RadioGroupOptions` throws `TypeError: t.map is not a function` at mount, `SelectAsync` shows an empty dropdown; `placeholder` missing → the input shows nothing.

## The assembly — `index.tsx`

{{{{raw}}}}

```tsx
import { createForm, useFormBundle } from '@reformer/core';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { formBehavior } from './form.behavior';
import { formSchema } from './form.schema';
import { formValidation } from './form.validation';
import { createMyModel, type MyForm } from './model';

export function MyFormPage() {
  // ONE call: model + schema tree + form + behavior + validation.
  // useFormBundle (lazy useState) runs the factory exactly once — never useMemo.
  const bundle = useFormBundle(() =>
    createForm<MyForm>({
      model: createMyModel(),
      schema: formSchema, // renderer-json: the document, plus `registry`
      behavior: formBehavior,
      validation: formValidation,
    })
  );

  // renderer-react
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
  // renderer-json:  <FormRenderer form={bundle} />
  // core:           your JSX — <FormField control={bundle.form.email} />
}
```

{{{{/raw}}}}

## If `target=renderer-json` — the same tree as a document (format 2)

The schema is a pure-string operator DSL: `'$model(path)'` (field/group/array), `'$component(Name)'` (registry component), `'$dataSource(NAME)'` (registry value), `'$fn(name)'` (registry function), `'$part(name)'` (a named part of the document). The document is turned into a tree by the registry: pass both to the SAME `createForm` — `createForm<MyForm>({ model, schema: formSchema, registry, behavior, validation })`.

```jsonc
{
  "format": 2,
  "parts": {
    // a sub-form and an array row are the same thing: a part that receives a sub-model
    "address": {
      "component": "$component(Box)",
      "children": [{ "model": "$model(city)", "component": "$component(Input)" }],
    },
    "propertyRow": {
      "component": "$component(Box)",
      "children": [{ "model": "$model(type)", "component": "$component(Input)" }],
    },
  },
  "root": {
    "selector": "wizard",
    "component": "$component(FormWizard)",
    "children": [
      {
        "selector": "loan",
        "component": "$component(Step)",
        "componentProps": { "title": "Кредит" },
        "children": [
          {
            "model": "$model(loanType)",
            "component": "$component(SelectAsync)",
            "componentProps": { "label": "Тип", "options": "$dataSource(LOAN_TYPES)" },
          },
          { "model": "$model(registrationAddress)", "part": "$part(address)" },
          {
            "model": "$model(properties)",
            "component": "$component(FormArray)",
            "item": "$part(propertyRow)",
          },
        ],
      },
    ],
  },
}
```

- The schema file is **`form.schema.ts`** — a `defineJsonSchema<MyForm>({ format: 2, … })` literal, so a typo inside `$model(...)` fails to compile. Keeping the same DSL as raw data in `form.schema.json` is an accepted variant, but it gives up `$model` path typing and nothing else catches a bad path.
- `"format": 2` is required — a document without it is the former format (keys `value`/`array`, steps in `componentProps.steps`) and the assembly does not read it; `migrateJsonSchema(v1)` converts one.
- Paths inside a part are relative to the sub-model of the place it is mounted at (`"$model(city)"`, not `"$model(registrationAddress.city)"`).
- `registry.ts`: every `$component(Name)` is registered with `reg.component(Name, Component)` — including the library `FormWizard` and `Step`; `reg.component(FIELD_WRAPPER, FormField)` sets the field wrapper; option arrays go through `reg.dataSource('NAME', value)` and are referenced as `'$dataSource(NAME)'` — never inline arrays in JSON.
- `selector` is a plain-string node id for `schema.node(selector)` in the behavior — **not** a model path. `testId` stays in `componentProps` and does not drive field resolution.
- Check the document in dev explicitly: `validateFormSchema(document, { registry })` from `@reformer/renderer-json/validate` (load it with a dynamic `import()` so ajv stays out of the production bundle) and show `SchemaErrorPanel` when it reports errors.

```jsonc
// ❌ former contract — keys `value` / `array`, bare strings never resolve
{ "value": "$model(loanAmount)", "component": "Input" }

// ✅ the binding key is `model`; the component is an operator
{ "model": "$model(loanAmount)", "component": "$component(InputNumber)",
  "componentProps": { "testId": "step1.loanAmount", "label": "Сумма кредита" } }
```

## Layout & visual density

{{layoutSection}}

## Prerequisites — read these resources via ReadMcpResourceTool

**You MUST read these BEFORE writing the schema. Skipping = wrong imports / wrong layout / wrong shape.**

- `find_recipe unified-contract` — the contract in one place
- `reformer://docs/core/import-patterns`
- `reformer://docs/core/quick-start-minimal-working-form`
- `reformer://docs/core/common-patterns`
- `reformer://docs/core/ui-component-patterns`
- `reformer://docs/core/non-existent-api-do-not-use`
- `reformer://docs/ui-kit/quick-start` (if `@reformer/ui-kit` detected)
- `reformer://docs/ui-kit/components`
- Directory layout — default is **`{{layoutMode}}`**. Run `find_recipe directory-layout` for where each file goes for `{{target}}` (incl. renderer-json app-level base registry + DSL meta-schema).
  {{rendererPrereqs}}

## Task

1. Stage 0 — verify detected stack (above). If gap → ask, don't code.
2. Design the form structure from the description (fields, types, groups, arrays, sub-forms, steps).
3. Write the typed `type MyForm = { ... }` and a model factory over `createModel<MyForm>(…)`; arrays of sub-forms as `arrayOf(blankRow)`.
4. Write the schema as a BUILDER over the model (`(model) => node`), with field nodes `{ model: model.$.field, component, componentProps }`, sub-forms as parts, arrays with `item`. For `renderer-json` — the same tree as a format-2 document plus `registry.ts`.
5. Assemble in ONE call wrapped in `useFormBundle`: `createForm<MyForm>({ model, schema, behavior?, validation? })` (+ `registry` for `renderer-json`).
6. Use components from the detected ui-kit + Tailwind layout from the skeleton above.
7. Organize files per the directory layout: {{{layoutGuidance}}}
8. Don't add validation/behaviors — out of scope. Give `selector` to every container a later rule will address.

## Output checklist

- [ ] Прочитал все ресурсы из Prerequisites: yes/no
- [ ] Model holds data; assembly is ONE `createForm` call wrapped in `useFormBundle` — no `createCoreForm` / `createReactForm` / `createJsonForm`, no `useMemo`
- [ ] Used ui-kit + Tailwind from detected stack (not plain HTML)
- [ ] All spec fields included (walked the list)
- [ ] Field node complete: `{ model: model.$.field, component, componentProps }` per field — the binding key is `model`, the value is a handle, not a bare name
- [ ] Conditional containers have a `selector`; hiding is a behavior rule (`hideWhen`) or a JSX conditional, NOT `enableWhen`
- [ ] testId = dotted-path
- [ ] Array node = `{ model: model.$.<path>, component, item }`; the new-row template is `arrayOf(blank)` in the model, no `initialValue` on the node
- [ ] Sub-forms are parts (`{ model, part }`), declared once
- [ ] Wizard (if any) = library `FormWizard` node with steps in `children`; every step has a `selector`
- [ ] User-facing strings localized from spec
- [ ] `SelectAsync`/`RadioGroupOptions` have `options` on the node's `componentProps` (for `renderer-json` via `'$dataSource(NAME)'`), never dropped
- [ ] (`renderer-json`) the document has `"format": 2`; every `$component(...)` and `FIELD_WRAPPER` is registered
- [ ] Final note: «использовал `@reformer/ui-kit` + Tailwind по detected стеку» (or reason why not)
