# Form directory layout (core / renderer-react / renderer-json)

How to organize the files of one form. **Default = minimalist:** a flat set of files — one
`index.tsx` component plus one file per concern; wizard steps live in the root schema or, one
folder per step, in `steps/<slug>/`. **One naming rule and one file set for every target:**
`form.<role>` is a form artifact whose suffix names its role (`form.schema` — the schema of the
form, `form.behavior` — the behavior of the form, `form.validation` — validation); every other
file is plain-named. The set is **identical across `@reformer/core`, `@reformer/renderer-react`,
and `@reformer/renderer-json`** — the contract of a form does not depend on who draws it;
renderer-json adds only `registry.ts`. Scale up to the folder layout (§3) only for large forms.
Use `[form-name]` / `[FormName]` as placeholders.

> **Кратко по-русски.** Раскладка файлов формы (form directory layout) — как назвать файлы формы и
> куда положить каждый из них. Модуль формы — один каталог, и у каждой заботы в нём ровно один
> канонический файл. Правило имён: `form.<роль>` — артефакт формы, суффикс называет роль
> (`schema`, `behavior`, `validation`); остальные файлы без префикса; внутри папки шага
> `steps/<slug>/` имена те же. Схема одна, поведение одно, сборка одна — поэтому набор файлов у
> всех таргетов одинаковый. Имена из §1 — контракт, а не рекомендация. Прежние имена
> (`form.render.ts`, `wizard.tsx`, `renderer.*`, `validation.ts`) — §7. Крупную форму раскладывают
> по папкам — §3.

> **The names in §1 are the contract, not a suggestion.** Do not invent `schema.ts`, `behavior.ts`,
> `json-schema.json`, `render-behavior.ts`, `initial-values.ts` or `dictionaries.ts` — every concern
> below already has exactly one canonical filename. Older example directories in this repository were
> written before this guide and still use the old names; they are references for _content_, never for
> _naming_.

> The default this guide leads with is configurable — see §5 (`REFORMER_FORM_LAYOUT`). This guide
> documents both the minimalist default and the folders scale-up regardless of the setting.

## 1. Minimalist (default) — flat, one file per concern

What files should a form have? Exactly the set below — the same files for every target.
Everything lives in the form module root (no `lib/` / `schema/` / `components/` nesting). A single
`index.tsx` holds the assembly; one `form.validation.ts` holds all validation; every other
concern is one file. The only allowed nesting is the optional per-step folder `steps/<slug>/` (below).

**Naming rule:** `form.<role>` = an artifact of the form, the suffix names its role —
`form.schema` (the one schema tree), `form.behavior` (the one behavior: links over the model and
rules for schema nodes), `form.validation` (validation rules). Every other file is **plain-named**.
The separator is a **dot**, never a dash and never a collapsed word: `form.behavior.ts`, not
`form-behavior.ts` / `behavior.ts` / `formBehavior.ts`.

**The set — identical in every target:**

```
[form-name]/
├── index.tsx           # entry: ONE assembly — createForm in useFormBundle — and whoever draws
├── types.ts            # form type + field enums + { value, label } option type + constant dictionaries
├── model.ts            # createModel factory + initial values + new-row templates (arrayOf)
├── form.schema.ts      # the schema: ONE tree of nodes — the form is built from it and drawn by it
├── form.behavior.ts    # the ONLY behavior: links over the model + rules for schema nodes
├── form.validation.ts  # ALL validation over the model; wizard: { steps: { <selector>: rules }, extras }
├── data-sources.ts     # options + async loaders (dataSources)
└── api.ts              # submit + prefill / load
```

**`form.schema.*` — one tree, two notations:**

| target         | file             | content                                                                                        |
| -------------- | ---------------- | ---------------------------------------------------------------------------------------------- |
| core           | `form.schema.ts` | builder `(model) => node`: `{ model: model.$.x, component, componentProps }`; the markup is JSX |
| renderer-react | `form.schema.ts` | the same builder, with containers — `FormRenderer` draws the tree                               |
| renderer-json  | `form.schema.ts` | the same tree as a document of format 2 (`$model` / `$component` / `$part`) in `defineJsonSchema<T>` |

- **`.tsx` instead of `.ts` is fine** when the schema itself contains JSX (an inline cell
  renderer). Only the extension changes: `form.schema.tsx`, never `schema.tsx` / `json-schema.ts`.
- **renderer-json — why `.ts` is the default.** `defineJsonSchema<T>` types the literal against `T`,
  so a typo inside `$model(personalData.frstName)` is a **compile-time** error — the main thing
  standing between the DSL and a field that silently binds to nothing.
- **`form.schema.json` is an accepted variant** (renderer-json) — the same DSL stored as data
  (`import raw from './form.schema.json'` plus a cast to `JsonFormSchema<T>`). Take it knowingly:
  **`$model` paths stop being type-checked**, and nothing else picks the slack up.

**Behavior — one layer, one file.** `form.behavior.ts` holds `defineFormBehavior<T>(({ model, form, schema }) => …)`:
links over the model (compute / enableWhen / copyFrom / onChange) and rules for schema nodes
(`hideWhen(schema.node('selector'), …)`, `onComponentEvent`, `onMount`) side by side — in **every**
target. There is no separate file for the render layer.

**renderer-json also adds** `registry.ts` (plain) — binds components and the data-sources **from
`data-sources.ts`** to their `$component(...)` / `$dataSource(...)` names, including the library
`FormWizard` / `Step` and the field wrapper `FIELD_WRAPPER`.

**Wizard** is the library `FormWizard` standing in the schema as a node with the steps in
`children` — it needs no file of its own. A step node carries a `selector`; the same word is the
key of the step's rules in `form.validation.ts`.

**Wizard steps, optional — `steps/<slug>/`:** keep the steps in the root schema, **or** give each
step a folder named by the kebab slug of its title **without a number** (`Контакты` → `kontakty`;
order comes from the aggregator, so reordering steps never renames folders). Inside a step folder
the names are the same as in the root:

```
steps/
├── index.ts                # aggregator: step order + the step schemas / rules
└── kontakty/
    ├── form.schema.ts      # the step node `{ selector, component: Step, … }` (optional; .tsx / .json as in the root)
    ├── form.validation.ts  # rules of this step's fields → export const stepRules
    └── form.behavior.ts    # behavior within this step (optional)
```

Cross-step rules and behavior stay in the root `form.validation.ts` / `form.behavior.ts`.

A **data** schema (`form.schema.json`, renderer-json) is split by reference: the root keeps
`{ "$ref": "./steps/<slug>/form.schema.json" }` among the wizard's `children`, the step file is
`{ "$schema", "node": <Step> }` (key `node`, not `root`), `steps/index.ts` exports
`stepSchemas: Record<ref, JsonFormStep>`, and `index.tsx` assembles the document with
`composeJsonFormSchema(rawSchema, stepSchemas)` before `createForm`.

→ per-target file sets:

```
core (8):            index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts  form.validation.ts  data-sources.ts  api.ts
renderer-react (8):  index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts  form.validation.ts  data-sources.ts  api.ts
renderer-json (9):   index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts  form.validation.ts  data-sources.ts  api.ts  registry.ts

# same names, allowed shapes:
any target                     schema holds JSX        -> form.schema.tsx
renderer-json                  schema as raw data      -> form.schema.json  (no $model typing)
any target + wizard, optional  steps as folders        -> steps/index.ts + steps/<slug>/{form.schema.*, form.validation.ts, form.behavior.ts}
```

Rules:

- **Wizard steps in the root schema or in `steps/<slug>/`** — never `components/steps/`,
  `step1.tsx` or a numbered folder. A nested sub-form (Address, PassportData, …) is a **part** — a
  function `(model) => node` next to the schema that uses it, mounted with `{ model, part }` — not
  a separate file per sub-form.
- Nodes carry the **model handle** (`model: model.$.x`), never `form.X`; the key is `model`, not
  `value` / `array`.
- Schema nodes carry **no `validators`** — value validation is a separate `defineValidationSchema`
  over the model in `form.validation.ts`, passed to the assembly as `validation`.
- Derived fields and node visibility → `form.behavior.ts`; domain constants/enums → `types.ts`;
  the two data concerns are split: field options + async loaders → `data-sources.ts`,
  submit/prefill → `api.ts`.
- **The set is the whole module.** A concern with no file of its own does not get a new file — it
  belongs inside one of these. The documented exception is the `steps/` folders above.

## 2. App-level infrastructure (renderer-json only) — recommendation, not a conformance bar

> **Status: aspirational.** Nothing in this repository implements the layout below: no example has a
> `src/renderer-json/` directory, and the meta-schema generator is currently wired to one specific
> form. A form that keeps its whole registry in its own `registry.ts` is therefore **not** violating
> the layout — **§1 alone is the conformance bar**, and neither a reviewer nor a validator should read
> a missing `src/renderer-json/` as a defect. Adopt §2 when a second or third JSON form appears in the
> app and the base registry actually starts getting copy-pasted.

The base component **registry** is mostly shared across all JSON forms — ui-kit components plus the
system ones (`FormWizard`, `Step`, `FIELD_WRAPPER`). The DSL meta-schema is generated from that
registry. Neither belongs to a single form — once there is more than one, lift them to the app
level (e.g. `src/renderer-json/`):

```
src/renderer-json/            # one per application
├── registry.ts               # base ComponentRegistry: ui-kit + FormWizard / Step + FIELD_WRAPPER
└── form-schema.schema.json    # GENERATED DSL meta-schema (npm run gen:form-schema) — derived from the registry
```

Once that app-level base exists, each form's own `registry.ts` composes it (`composeRegistries`)
with the form's own components + `data-sources.ts`, and that composed registry goes into
`createForm({ registry })`; from then on do **not** copy the base registry or the meta-schema into
a per-form file — regenerate the meta-schema with `npm run gen:form-schema` when the base registry
changes. Until it exists, a self-contained per-form `registry.ts` is the correct shape, not a
workaround.

> Raw (non-ui-kit) controls are bound by name the same way, but need a `resolveFieldAdapter` in the
> renderer **settings** (see `@reformer/renderer-react`), not in the registry itself.

## 3. Scale up: folders (large forms)

When a form grows large (many steps, heavy reuse across steps), promote the flat module to folders.
This is the only case where you split beyond the flat set (the `steps/<slug>/` folders of §1 are
still the flat layout — they only move per-step pieces out of the root files):

```
[form-name]/
├── [FormName]Form.tsx        # entry
├── index.ts                  # public re-exports
├── lib/                      # domain raw material (target-agnostic): types, constants, calc, custom-validators, api
├── schema/                   # form definition: model.ts, form.schema.ts (.tsx / .json), form.behavior.ts, form.validation.ts, data-sources.ts
└── components/
    ├── steps/                # one component per wizard step (markup written by hand)
    ├── nested-forms/         # reusable sub-forms (Address, PersonalData, …)
    └── ui/                   # helper blocks (summary, warnings, sections)
```

**Centralized vs co-located** (folders only): keep one `form.schema.ts` / `form.validation.ts` /
`form.behavior.ts` in `schema/` (easiest reuse between ways of drawing), **or** co-locate each
step's `form.schema.ts` / `form.validation.ts` / `form.behavior.ts` inside its `steps/[Step]/`
folder while keeping the shared `model` + cross-step rules in `schema/`. Filenames keep their §1
stems inside folders too — folders change where a file lives, never what it is called. The model,
the schema, the behavior and the validation are written ONCE and shared by every way of drawing;
only the entry differs. The app-level registry + meta-schema (§2) are unchanged.

## 4. Scaling

| Complexity               | Structure                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Tiny                     | single file: `index.tsx` (model + schema + component)                                                                                    |
| **Default (minimalist)** | flat files (§1) — plain-named base + `form.schema` / `form.behavior` / `form.validation`; wizard steps in the root schema or in `steps/<slug>/`; identical across targets |
| Large                    | folders (§3): `lib/` + `schema/` + `components/` (+ app-level registry/meta-schema for renderer-json)                                    |

## 5. Configuring the default (`REFORMER_FORM_LAYOUT`)

Which layout the **`create-form` prompt leads with** is configurable via the `REFORMER_FORM_LAYOUT`
environment variable, set in the MCP server registration `env` of your client's `.mcp.json` — the
same mechanism as `REFORMER_DEBUG`:

```jsonc
// .mcp.json
{ "mcpServers": { "reformer": { "command": "…", "env": { "REFORMER_FORM_LAYOUT": "minimalist" } } } }
```

Values: `minimalist` (default when unset/unrecognized) | `folders`. This guide documents both
layouts regardless; the env var only changes which one `create-form` steers toward by default.

## 6. Reuse map

The contract of a form is the same for every way of drawing, so almost every file is written once.

| File                                | Role                                                    |       core        |  renderer-react   |   renderer-json   |
| ----------------------------------- | ------------------------------------------------------- | :---------------: | :---------------: | :---------------: |
| `types.ts`                          | form type + enums + option type + constants             |        ✅         |       reuse       |       reuse       |
| `model.ts`                          | reactive model (source of truth) + new-row templates    |        ✅         |       reuse       |       reuse       |
| `form.validation.ts`                | rules; wizard: `{ steps, extras }`                      |        ✅         |       reuse       |       reuse       |
| `form.behavior.ts`                  | the one behavior: model links + node rules              |        ✅         |       reuse       |       reuse       |
| `data-sources.ts`                   | options + async loaders (dataSources)                   |        ✅         |       reuse       |       reuse       |
| `api.ts`                            | submit + prefill/load                                   |        ✅         |       reuse       |       reuse       |
| `form.schema.ts`                    | the one schema tree: TS builder / JSON document         |        ✅         |       reuse       | the same tree as a document |
| `form.schema.tsx`                   | same file when the schema contains JSX                  |      variant      |      variant      |      variant      |
| `form.schema.json`                  | same DSL as raw data — no `$model` typing               |         —         |         —         |      variant      |
| `registry.ts`                       | binds components + data-sources to DSL names            |         —         |         —         |        ✅         |
| `steps/index.ts` + `steps/<slug>/…` | per-step schema / validation / behavior                 | optional (wizard) | optional (wizard) | optional (wizard) |
| **app** `registry.ts` (base)        | ui-kit + system components                              |         —         |         —         | app-level (§2, aspirational) |
| **app** `form-schema.schema.json`   | generated DSL meta-schema                               |         —         |         —         | app-level (§2, aspirational) |

Rule nodes of the behavior (`hideWhen`, `onComponentEvent`, `onMount`) are executed by the renderer.
When the markup is written by hand (core) they do nothing: visibility, submit and data loading stay
in the JSX of `index.tsx` there.

Renaming any of these is a defect in itself: the stems above are the contract that reviews, generators
and `find_recipe directory-layout` key on. Older example directories in this repository predate the
contract and are **not** naming references.

## 7. Former names (`form.render.ts`, `wizard.tsx`, `renderer.*`, `validation.ts`)

The canon was aligned twice. First the render layer lost its `renderer.` prefix and validation got
the `form.` prefix. Then the unified contract removed two roles altogether: the separate behavior of
the render layer and the app shim of the wizard. Modules written the old way keep working —
`validate_form kind="layout"` reports these names as **warnings**, never as errors:

| former name                               | now                                                                                      | diagnostic |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- | ---------- |
| `renderer.schema.ts`                      | `form.schema.ts` (`.tsx` / `.json` alike) — rename                                       | RF011      |
| `validation.ts`                           | `form.validation.ts` (in `steps/<slug>/` too) — rename                                   | RF011      |
| `form.render.ts`, `renderer.behavior.ts`  | no such file: move the node rules into `form.behavior.ts` (in `steps/<slug>/` — into the step's own `form.behavior.ts`) | RF013      |
| `wizard.tsx`, `renderer.wizard.tsx`       | no such file: the wizard is the library `FormWizard` node; delete the shim               | RF013      |

Fix it when you next touch the module; new code uses the canonical names only. `core` and
`renderer-react` share one file set, so the files alone no longer tell these targets apart — pass
`target` to `validate_form kind="layout"` explicitly.
