# Form directory layout (core / renderer-react / renderer-json)

How to organize the files of one form. **Default = minimalist:** a flat set of files — one
`index.tsx` component plus one file per concern; wizard steps live inline in `index.tsx` or, one
folder per step, in `steps/<slug>/`. **One naming rule for every target:** `form.<role>` is a form
artifact whose suffix names its role (`form.schema` — markup, `form.behavior` — model behavior,
`form.render` — render behavior, `form.validation` — validation); every other file is plain-named. The base file set is
**identical across `@reformer/core`, `@reformer/renderer-react`, and `@reformer/renderer-json`**.
Scale up to the folder layout (§3) only for large forms. Use `[form-name]` / `[FormName]` as
placeholders.

> **Кратко по-русски.** Раскладка файлов формы (form directory layout) — как назвать файлы формы и
> куда положить каждый из них. Модуль формы — один каталог, и у каждой заботы в нём ровно один
> канонический файл. Правило имён: `form.<роль>` — артефакт формы, суффикс называет роль
> (`schema`, `behavior`, `render`, `validation`); остальные файлы без префикса; внутри папки шага
> `steps/<slug>/` имена те же. Имена из §1 — контракт, а не рекомендация. Прежние `renderer.*` и `validation.ts` —
> §7. Крупную форму раскладывают по папкам — §3.

> **The names in §1 are the contract, not a suggestion.** Do not invent `schema.ts`, `behavior.ts`,
> `json-schema.json`, `render-behavior.ts`, `initial-values.ts` or `dictionaries.ts` — every concern
> below already has exactly one canonical filename. Older example directories in this repository were
> written before this guide and still use the old names; they are references for *content*, never for
> *naming*.

> The default this guide leads with is configurable — see §5 (`REFORMER_FORM_LAYOUT`). This guide
> documents both the minimalist default and the folders scale-up regardless of the setting.

## 1. Minimalist (default) — flat, one file per concern

Everything lives in the form module root (no `lib/` / `schema/` / `components/` nesting). A single
`index.tsx` holds the whole form; one `form.validation.ts` holds all validation; every other
concern is one file. The only allowed nesting is the optional per-step folder `steps/<slug>/` (below).

**Naming rule:** `form.<role>` = an artifact of the form, the suffix names its role —
`form.schema` (markup), `form.behavior` (model behavior), `form.render` (render behavior),
`form.validation` (validation rules). Every other file is **plain-named**. The separator is a **dot**, never a dash and never a collapsed word:
`form.render.ts`, not `form-render.ts` / `render-behavior.ts` / `renderBehavior.ts`. The rule is the
same in every target — only the set of files differs.

**Base — identical in every target:**

```
[form-name]/
├── index.tsx           # entry + whole form: ONE assembly call (createCoreForm / createReactForm / createJsonForm) + render
├── types.ts            # form type + field enums + { value, label } option type + constant dictionaries
├── model.ts            # createModel + initial values + array-element factories
├── form.validation.ts  # ALL validation over the model → { validateStep, validateAll }
├── data-sources.ts     # options + async loaders (dataSources)
└── api.ts              # submit + prefill / load
```

**`form.schema.*` — the markup, one name in every target:**

| target           | file             | content                                                                                    |
| ---------------- | ---------------- | ------------------------------------------------------------------------------------------ |
| core             | `form.schema.ts` | M1 FormSchema `{ value: model.$.x, component, componentProps }`                             |
| renderer-react   | `form.schema.ts` | RenderNode tree (`createRenderSchema`)                                                      |
| renderer-json    | `form.schema.ts` | JSON-DSL literal (`$model` / `$component` / `$dataSource`) wrapped in `defineJsonSchema<T>` |

- **`.tsx` instead of `.ts` is fine** when the schema itself contains JSX (a `renderStepBody` prop,
  an inline cell renderer). Only the extension changes: `form.schema.tsx`, never `schema.tsx` /
  `json-schema.ts`.
- **renderer-json — why `.ts` is the default.** `defineJsonSchema<T>` types the literal against `T`,
  so a typo inside `$model(personalData.frstName)` is a **compile-time** error — the main thing
  standing between the DSL and a field that silently binds to nothing.
- **`form.schema.json` is an accepted variant** (renderer-json) — the same DSL stored as data
  (`import raw from './form.schema.json'` plus a cast to `JsonFormSchema<T>`). Take it knowingly:
  **`$model` paths stop being type-checked**, and nothing else picks the slack up.

**Behavior — two layers, two files:**

- `form.behavior.ts` — model behavior (`defineFormBehavior`: compute / enableWhen / hideWhen /
  copyFrom / onChange) — **all targets**.
- `form.render.ts` — render behavior (hideWhen / renderEffect / navigation / submit /
  data-loading) — **renderer-react & renderer-json only**.

**renderer-json also adds** `registry.ts` (plain) — binds components and the data-sources **from
`data-sources.ts`** to their `$component(...)` / `$dataSource(...)` names.

**renderer-json, optional — `wizard.tsx`:** a multi-step JSON form has to register some component
under `$component(Wizard)`, and **the library does not export one** (`RendererFormWizard` is
application code). The shim that adapts ui-kit `FormWizard` to the JSON step shape lives in
`wizard.tsx` or inline in `registry.ts` — **both are canonical**. See renderer-json
[07-form-wizard.md](../../../reformer-renderer-json/docs/llms/07-form-wizard.md).

**Wizard steps, optional — `steps/<slug>/`:** keep the steps inline in `index.tsx`, **or** give each
step a folder named by the kebab slug of its title **without a number** (`Контакты` → `kontakty`;
order comes from the aggregator, so reordering steps never renames folders). Inside a step folder
the names are the same as in the root:

```
steps/
├── index.ts                # aggregator: step order + stepValidations[] / stepRenders[]
└── kontakty/
    ├── form.validation.ts  # rules of this step's fields → export const stepValidation
    ├── form.render.ts      # render behavior of this step's nodes (renderer-* only)
    └── form.schema.ts      # markup of this step (optional; .tsx / .json as in the root)
```

Cross-step rules and behavior stay in the root `form.validation.ts` / `form.behavior.ts` /
`form.render.ts`.

A **data** schema (`form.schema.json`, renderer-json) is split by reference: the root keeps
`{ "$ref": "./steps/<slug>/form.schema.json" }` in `componentProps.steps`, the step file is
`{ "$schema", "node": <Step> }` (key `node`, not `root`), `steps/index.ts` exports
`stepSchemas: Record<ref, JsonFormStep>`, and `index.tsx` assembles the form with
`composeJsonFormSchema(rawSchema, stepSchemas)` before `createJsonForm` — see renderer-json
[07-form-wizard.md](../../../reformer-renderer-json/docs/llms/07-form-wizard.md#split-steps).

→ per-target file sets:

```
core (8):            index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts                  form.validation.ts  data-sources.ts  api.ts
renderer-react (9):  index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts  form.render.ts  form.validation.ts  data-sources.ts  api.ts
renderer-json (10):  index.tsx  types.ts  model.ts  form.schema.ts  form.behavior.ts  form.render.ts  form.validation.ts  data-sources.ts  api.ts  registry.ts

# same names, allowed shapes:
any target                        schema holds JSX             -> form.schema.tsx
renderer-json                     schema as raw data           -> form.schema.json  (no $model typing)
renderer-json + wizard, optional  shim for $component(Wizard)  -> wizard.tsx        (or inline in registry.ts)
any target + wizard, optional     steps as folders             -> steps/index.ts + steps/<slug>/{form.validation.ts, form.render.ts, form.schema.*}
```

Rules:

- **Wizard steps inline in `index.tsx` or in `steps/<slug>/`** — never `components/steps/`,
  `step1.tsx` or a numbered folder. Nested sub-forms (Address, PassportData, …) are inline blocks or
  small local helper components in `index.tsx`, not separate files.
- Leaves carry the **model signal** (`value: model.$.x`), never `form.X`.
- **renderer-react / renderer-json**: `RenderNode` / `JsonFieldNode` carry **no `validators`** —
  value validation is a separate `defineValidationSchema` over the model in `form.validation.ts`
  (executed by `validateModel`, injected into the wizard as `{ validateStep, validateAll }`).
- Derived fields → `form.behavior.ts`; domain constants/enums → `types.ts`; the two data concerns
  are split: field options + async loaders → `data-sources.ts`, submit/prefill → `api.ts`.
- **The per-target set is the whole module.** A concern with no file of its own does not get a new
  file — it belongs inside one of these. The documented exceptions are the optional `wizard.tsx`
  shim and the `steps/` folders above.

## 2. App-level infrastructure (renderer-json only) — recommendation, not a conformance bar

> **Status: aspirational.** Nothing in this repository implements the layout below: no example has a
> `src/renderer-json/` directory, and the meta-schema generator is currently wired to one specific
> form. A form that keeps its whole registry in its own `registry.ts` is therefore **not** violating
> the layout — **§1 alone is the conformance bar**, and neither a reviewer nor a validator should read
> a missing `src/renderer-json/` as a defect. Adopt §2 when a second or third JSON form appears in the
> app and the base registry actually starts getting copy-pasted.

The base component **registry** is mostly shared across all JSON forms — ui-kit components plus the
system containers (the `$component(Wizard)` shim, `Step`, `FIELD_WRAPPER`). The DSL meta-schema is
generated from that registry. Neither belongs to a single form — once there is more than one, lift
them to the app level (e.g. `src/renderer-json/`):

```
src/renderer-json/            # one per application
├── registry.ts               # base ComponentRegistry: ui-kit + the $component(Wizard) shim / Step + FIELD_WRAPPER
└── form-schema.schema.json    # GENERATED DSL meta-schema (npm run gen:form-schema) — derived from the registry
```

Once that app-level base exists, each form's own `registry.ts` composes it with the form's own
components + `data-sources.ts`, and that composed registry goes into `createJsonForm({ registry })`;
from then on do **not** copy the base registry or the meta-schema into a per-form file — regenerate
the meta-schema with `npm run gen:form-schema` when the base registry changes. Until it exists, a
self-contained per-form `registry.ts` is the correct shape, not a workaround.

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
├── schema/                   # form definition: model.ts, form.schema.ts (.tsx / .json), form.behavior.ts (+ form.render.ts), form.validation.ts, data-sources.ts, create-form.ts
└── components/
    ├── steps/                # one component per wizard step
    ├── nested-forms/         # reusable sub-forms (Address, PersonalData, …)
    └── ui/                   # helper blocks (summary, warnings, sections)
```

**Centralized vs co-located** (folders only): keep one `form.schema.ts` / `form.validation.ts` /
`form.behavior.ts` in `schema/` (easiest cross-target reuse), **or** co-locate each step's
`form.schema.ts` / `form.validation.ts` / `form.render.ts` inside its `steps/[Step]/` folder while keeping
the shared `model` + cross-step rules in `schema/`. Filenames keep their §1 stems inside folders
too — folders change where a file lives, never what it is called. For cross-target reuse keep
`lib/` + `schema/{model,form.behavior,form.validation}` once and add per-target presentation — never
duplicate model/behavior/validation. The app-level registry + meta-schema (§2) are unchanged.


## 4. Scaling

| Complexity              | Structure                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Tiny                    | single file: `index.tsx` (model + schema + component)                                        |
| **Default (minimalist)**| flat files (§1) — plain-named base + `form.schema` / `form.behavior` / `form.render`; wizard steps inline or in `steps/<slug>/`; base identical across targets |
| Large                   | folders (§3): `lib/` + `schema/` + `components/` (+ app-level registry/meta-schema for renderer-json) |

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

| File                          | Role                                          | core | renderer-react | renderer-json |
| ----------------------------- | --------------------------------------------- | :--: | :------------: | :-----------: |
| `types.ts`                    | form type + enums + option type + constants   |  ✅  |     reuse      |     reuse     |
| `model.ts`                    | reactive model (source of truth)              |  ✅  |     reuse      |     reuse     |
| `form.validation.ts`          | validators + validateStep/validateAll         |  ✅  |     reuse      |     reuse     |
| `data-sources.ts`             | options + async loaders (dataSources)         |  ✅  |     reuse      |     reuse     |
| `api.ts`                      | submit + prefill/load                         |  ✅  |     reuse      |     reuse     |
| `form.behavior.ts`            | model behavior                                |  ✅  |     reuse      |     reuse     |
| `form.schema.ts`              | markup: M1 FormSchema / RenderNode tree / JSON-DSL literal | ✅ own | ✅ own | ✅ own |
| `form.schema.tsx`             | same file when the schema contains JSX        | variant |    variant     |    variant    |
| `form.schema.json`            | same DSL as raw data — no `$model` typing     |  —   |       —        |    variant    |
| `form.render.ts`              | visibility / navigation / submit              |  —   |       ✅       | thin → shared |
| `registry.ts`                 | binds components + data-sources to DSL names  |  —   |       —        |      ✅       |
| `wizard.tsx`                  | app shim for `$component(Wizard)`             |  —   |       —        | optional (wizard) |
| `steps/index.ts` + `steps/<slug>/…` | per-step validation / render / markup   | optional (wizard) | optional (wizard) | optional (wizard) |
| **app** `registry.ts` (base)  | ui-kit + system components                    |  —   |       —        | app-level (§2, aspirational) |
| **app** `form-schema.schema.json` | generated DSL meta-schema                 |  —   |       —        | app-level (§2, aspirational) |

Renaming any of these is a defect in itself: the stems above are the contract that reviews, generators
and `find_recipe directory-layout` key on. Older example directories in this repository predate the
contract and are **not** naming references — see the note in renderer-json
[07-form-wizard.md](../../../reformer-renderer-json/docs/llms/07-form-wizard.md).

## 7. Former names (`renderer.*`, `validation.ts`)

Before the naming rule was unified, the render layer carried a `renderer.` prefix and validation
lived in a plain `validation.ts`. Modules written
that way keep working — `validate_form kind="layout"` reports these names as **warnings** (RF011,
"outdated name, rename to …"), never as errors:

| former name             | canonical name                         |
| ----------------------- | -------------------------------------- |
| `renderer.schema.ts`    | `form.schema.ts` (`.tsx` / `.json` alike) |
| `renderer.behavior.ts`  | `form.render.ts`                       |
| `renderer.wizard.tsx`   | `wizard.tsx`                           |
| `validation.ts`         | `form.validation.ts` (in `steps/<slug>/` too) |

Rename when you next touch the module; new code uses the canonical names only. With the unified
names a schema file alone no longer tells the target apart — pass `target` to
`validate_form kind="layout"` explicitly.
