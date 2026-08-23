# Form directory layout (core / renderer-react / renderer-json)

How to organize the files of one form. **Default = minimalist:** a flat set of files — one
`index.tsx` component (ALL steps inline) plus one file per concern. Most files are **plain-named**;
the **layer-variable** concerns — `schema` and `behavior`, plus the optional renderer-json wizard
shim — carry a `form.` / `renderer.` prefix (dot) marking which layer they belong to. The base file
set is otherwise **identical across `@reformer/core`, `@reformer/renderer-react`, and
`@reformer/renderer-json`**. Scale up to the folder layout (§3) only for large forms. Use
`[form-name]` / `[FormName]` as placeholders.

> **Кратко по-русски.** Раскладка файлов формы (form directory layout) — как назвать файлы формы и
> куда положить каждый из них. Модуль формы — один каталог, и у каждой заботы в нём ровно один
> канонический файл. Имена файлов формы из §1 — контракт, а не рекомендация. Структура файлов формы
> одинакова для `core`, `renderer-react` и `renderer-json`: различаются только `schema` и
> `behavior`. Крупную форму раскладывают по папкам — §3.

> **The names in §1 are the contract, not a suggestion.** Do not invent `schema.ts`, `behavior.ts`,
> `json-schema.json`, `render-behavior.ts`, `initial-values.ts` or `dictionaries.ts` — every concern
> below already has exactly one canonical filename. Older example directories in this repository were
> written before this guide and still use the old names; they are references for *content*, never for
> *naming*.

> The default this guide leads with is configurable — see §5 (`REFORMER_FORM_LAYOUT`). This guide
> documents both the minimalist default and the folders scale-up regardless of the setting.

## 1. Minimalist (default) — flat, one file per concern

Everything lives in the form module root (no `lib/` / `schema/` / `components/steps/` nesting). A
single `index.tsx` holds the whole form with **all steps inline**; one `validation.ts` holds all
validation; every other concern is one file.

**Naming rule:** files are **plain-named** by default. A prefix is carried only by the concerns that
come in two layer-flavors — **schema** and **behavior** (and the optional renderer-json **wizard**
shim) — using a dot: `form.` = the M1 / model layer, `renderer.` = the render layer. A plain filename
means the concern is singular (no layer duality). The separator is a **dot**, never a dash and never
a collapsed word: `renderer.behavior.ts`, not `render-behavior.ts` / `render.behavior.ts` /
`renderBehavior.ts`.

**Plain base — identical in every target:**

```
[form-name]/
├── index.tsx        # entry + whole form: ONE assembly call (createCoreForm / createReactForm / createJsonForm) + render; ALL steps inline
├── types.ts         # form type + field enums + { value, label } option type + constant dictionaries
├── model.ts         # createModel + initial values + array-element factories
├── validation.ts    # ALL validation over the model → { validateStep, validateAll }
├── data-sources.ts  # options + async loaders (dataSources)
└── api.ts           # submit + prefill / load
```

**Layer-variable — `schema` (dot-prefixed by layer):**

| target           | file                   | content                                                                                    |
| ---------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| core             | `form.schema.ts`       | M1 FormSchema `{ value: model.$.x, component, componentProps }`                             |
| renderer-react   | `renderer.schema.ts`   | RenderNode tree (`createRenderSchema`)                                                      |
| renderer-json    | `renderer.schema.ts`   | JSON-DSL literal (`$model` / `$component` / `$dataSource`) wrapped in `defineJsonSchema<T>` |

- **`.tsx` instead of `.ts` is fine** for either renderer when the schema itself contains JSX (a
  `renderStepBody` prop, an inline cell renderer). Only the extension changes — the stem stays
  canonical: `renderer.schema.tsx`, never `render-schema.tsx` / `schema.tsx` / `json-schema.ts`.
- **renderer-json — why `.ts` is the default.** `defineJsonSchema<T>` is an identity helper that types
  the literal against `T`, so a typo inside `$model(personalData.frstName)` is a **compile-time**
  error. That check is the main thing standing between the DSL and a field that silently binds to
  nothing, and it exists only in TypeScript.
- **`renderer.schema.json` is an accepted variant** — the same DSL stored as data: a schema pushed
  from a server, edited by non-TS tooling, or imported as `import raw from './renderer.schema.json'`
  plus a cast to `JsonFormSchema<T>`. Take it knowingly: **`$model` paths stop being type-checked**,
  and nothing else picks the slack up — not `tsc`, not the DSL meta-schema, not registry resolution.
  When the schema is authored in the repo next to the model, prefer `.ts`.

**Layer-variable — `behavior` (dot-prefixed by layer):**

- `form.behavior.ts` — model behavior (`defineFormBehavior`: compute / enableWhen / hideWhen /
  copyFrom / onChange) — **all targets**.
- `renderer.behavior.ts` — render behavior (hideWhen / renderEffect / navigation / submit /
  data-loading) — **renderer-react & renderer-json only**.

**renderer-json also adds** `registry.ts` (plain) — binds components and the data-sources **from
`data-sources.ts`** to their `$component(...)` / `$dataSource(...)` names. The data-sources stay in
`data-sources.ts`.

**renderer-json, optional — `renderer.wizard.tsx`:** a multi-step JSON form has to register some
component under `$component(Wizard)`, and **the library does not export one** — `RendererFormWizard`
is application code, not a `@reformer/*` export. The shim that adapts ui-kit `FormWizard` to the JSON
step shape (`$component(Step)` container nodes carrying `componentProps.title/icon`) therefore has to
live in the app. Put it in `renderer.wizard.tsx` — same prefix rule as everything else, `renderer.` =
render layer — or keep it inline in `registry.ts`. **Both are canonical**; pick one. This is the only
file allowed beyond the per-target sets below, and only for renderer-json + wizard. See renderer-json
[07-form-wizard.md](../../../reformer-renderer-json/docs/llms/07-form-wizard.md).

→ per-target file sets:

```
core (8):            index.tsx  types.ts  model.ts  form.schema.ts      form.behavior.ts                        validation.ts  data-sources.ts  api.ts
renderer-react (9):  index.tsx  types.ts  model.ts  renderer.schema.ts  form.behavior.ts  renderer.behavior.ts  validation.ts  data-sources.ts  api.ts
renderer-json (10):  index.tsx  types.ts  model.ts  renderer.schema.ts  form.behavior.ts  renderer.behavior.ts  validation.ts  data-sources.ts  api.ts  registry.ts

# same names, allowed shapes:
renderer-react / renderer-json    schema holds JSX             -> renderer.schema.tsx
renderer-json                     schema as raw data           -> renderer.schema.json  (no $model typing)
renderer-json + wizard, optional  shim for $component(Wizard)  -> renderer.wizard.tsx   (or inline in registry.ts)
```

Rules:

- **All steps inline in `index.tsx`** — no `components/steps/`. Nested sub-forms (Address,
  PassportData, …) are inline blocks or small local helper components in `index.tsx`, not separate
  files.
- Leaves carry the **model signal** (`value: model.$.x`), never `form.X`.
- **renderer-react / renderer-json**: `RenderNode` / `JsonFieldNode` carry **no `validators`** —
  value validation is a separate `defineValidationSchema` over the model in `validation.ts`
  (executed by `validateModel`, injected into the wizard as `{ validateStep, validateAll }`).
- Derived fields → `form.behavior.ts`; domain constants/enums → `types.ts`; the two data concerns
  are split: field options + async loaders → `data-sources.ts`, submit/prefill → `api.ts`.
- **The per-target set is the whole module.** A concern with no file of its own does not get a new
  file — it belongs inside one of these. The single documented exception is the optional
  `renderer.wizard.tsx` shim above.

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
This is the only case where you split beyond the flat set:

```
[form-name]/
├── [FormName]Form.tsx        # entry
├── index.ts                  # public re-exports
├── lib/                      # domain raw material (target-agnostic): types, constants, calc, custom-validators, api
├── schema/                   # form definition: model.ts, form.schema.ts (renderers: renderer.schema.ts / .tsx / .json), form.behavior.ts (+ renderer.behavior.ts), validation.ts, data-sources.ts, create-form.ts
└── components/
    ├── steps/                # one component per wizard step
    ├── nested-forms/         # reusable sub-forms (Address, PersonalData, …)
    └── ui/                   # helper blocks (summary, warnings, sections)
```

**Centralized vs co-located** (folders only): keep one `form.schema.ts` / `validation.ts` /
`form.behavior.ts` in `schema/` (easiest cross-target reuse), **or** co-locate each step's
`schema/validation/behavior` inside its `steps/[Step]/` folder while keeping the shared `model` +
cross-step rules in `schema/`. Filenames keep their §1 stems inside folders too — folders change
where a file lives, never what it is called. For cross-target reuse keep `lib/` +
`schema/{model,behavior,validation}` once and add per-target presentation — never duplicate
model/behavior/validation. The app-level registry + meta-schema (§2) are unchanged.


## 4. Scaling

| Complexity              | Structure                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Tiny                    | single file: `index.tsx` (model + schema + component)                                        |
| **Default (minimalist)**| flat files (§1) — one `index.tsx` (all steps inline), plain-named base + dot-prefixed `schema`/`behavior`; base identical across targets |
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
| `validation.ts`               | validators + validateStep/validateAll         |  ✅  |     reuse      |     reuse     |
| `data-sources.ts`             | options + async loaders (dataSources)         |  ✅  |     reuse      |     reuse     |
| `api.ts`                      | submit + prefill/load                         |  ✅  |     reuse      |     reuse     |
| `form.behavior.ts`            | model behavior                                |  ✅  |     reuse      |     reuse     |
| `form.schema.ts`              | M1 FormSchema field tree                      |  ✅  |       —        |       —       |
| `renderer.schema.ts`          | layout tree: RenderNode / JSON-DSL literal    |  —   |       ✅       |      ✅       |
| `renderer.schema.tsx`         | same file when the schema contains JSX        |  —   |    variant     |    variant    |
| `renderer.schema.json`        | same DSL as raw data — no `$model` typing     |  —   |       —        |    variant    |
| `renderer.behavior.ts`        | visibility / navigation / submit              |  —   |       ✅       | thin → shared |
| `registry.ts`                 | binds components + data-sources to DSL names  |  —   |       —        |      ✅       |
| `renderer.wizard.tsx`         | app shim for `$component(Wizard)`             |  —   |       —        | optional (wizard) |
| **app** `registry.ts` (base)  | ui-kit + system components                    |  —   |       —        | app-level (§2, aspirational) |
| **app** `form-schema.schema.json` | generated DSL meta-schema                 |  —   |       —        | app-level (§2, aspirational) |

Renaming any of these is a defect in itself: the stems above are the contract that reviews, generators
and `find_recipe directory-layout` key on. Older example directories in this repository predate the
contract and are **not** naming references — see the note in renderer-json
[07-form-wizard.md](../../../reformer-renderer-json/docs/llms/07-form-wizard.md).
