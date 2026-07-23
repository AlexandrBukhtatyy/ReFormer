# Form directory layout (core / renderer-react / renderer-json)

How to organize the files of one form. **Default = minimalist:** a flat set of files — one
`index.tsx` component (ALL steps inline) plus one file per concern. Most files are **plain-named**;
only the two **layer-variable** concerns — `schema` and `behavior` — carry a `form.` / `renderer.`
prefix (dot) marking which layer they belong to. The base file set is otherwise **identical across
`@reformer/core`, `@reformer/renderer-react`, and `@reformer/renderer-json`**. Scale up to the folder
layout (§3) only for large forms. Use `[form-name]` / `[FormName]` as placeholders.

> The default this guide leads with is configurable — see §5 (`REFORMER_FORM_LAYOUT`). This guide
> documents both the minimalist default and the folders scale-up regardless of the setting.

## 1. Minimalist (default) — flat, one file per concern

Everything lives in the form module root (no `lib/` / `schema/` / `components/steps/` nesting). A
single `index.tsx` holds the whole form with **all steps inline**; one `validation.ts` holds all
validation; every other concern is one file.

**Naming rule:** files are **plain-named** by default. The **only** files that carry a prefix are
the two concerns that come in two layer-flavors — **schema** and **behavior** — using a dot:
`form.` = the M1 / model layer, `renderer.` = the render layer. A plain filename means the concern
is singular (no layer duality).

**Plain base — identical in every target:**

```
[form-name]/
├── index.tsx        # entry + whole form: createModel → createForm → render; ALL steps inline
├── types.ts         # form type + field enums + { value, label } option type + constant dictionaries
├── model.ts         # createModel + initial values + array-element factories
├── validation.ts    # ALL validation over the model → { validateStep, validateAll }
├── data-sources.ts  # options + async loaders (dataSources)
└── api.ts           # submit + prefill / load
```

**Layer-variable — `schema` (dot-prefixed by layer):**

| target           | file                     | content                                                        |
| ---------------- | ------------------------ | -------------------------------------------------------------- |
| core             | `form.schema.ts`         | M1 FormSchema `{ value: model.$.x, component, componentProps }` |
| renderer-react   | `renderer.schema.ts`     | RenderNode tree (`createRenderSchema`)                         |
| renderer-json    | `renderer.schema.json`   | JSON-DSL (`$model` / `$component` / `$dataSource`)             |

**Layer-variable — `behavior` (dot-prefixed by layer):**

- `form.behavior.ts` — model behavior (`defineFormBehavior`: compute / enableWhen / hideWhen /
  copyFrom / onChange) — **all targets**.
- `renderer.behavior.ts` — render behavior (hideWhen / renderEffect / navigation / submit /
  data-loading) — **renderer-react & renderer-json only**.

**renderer-json also adds** `registry.ts` (plain) — binds components and the data-sources **from
`data-sources.ts`** to their `$component(...)` / `$dataSource(...)` names. The data-sources stay in
`data-sources.ts`.

→ per-target file sets:

```
core (8):            index.tsx  types.ts  model.ts  form.schema.ts       form.behavior.ts                        validation.ts  data-sources.ts  api.ts
renderer-react (9):  index.tsx  types.ts  model.ts  renderer.schema.ts   form.behavior.ts  renderer.behavior.ts  validation.ts  data-sources.ts  api.ts
renderer-json (10):  index.tsx  types.ts  model.ts  renderer.schema.json form.behavior.ts  renderer.behavior.ts  validation.ts  data-sources.ts  api.ts  registry.ts
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

## 2. App-level infrastructure (renderer-json only)

The base component **registry** is mostly shared across all JSON forms — ui-kit components plus the
system containers (`RendererFormWizard`, `Step`, `FIELD_WRAPPER`). The DSL meta-schema is generated
from that registry. Neither belongs to a single form — lift them to the app level (e.g.
`src/renderer-json/`):

```
src/renderer-json/            # one per application
├── registry.ts               # base ComponentRegistry: ui-kit + RendererFormWizard/Step + FIELD_WRAPPER
└── form-schema.schema.json    # GENERATED DSL meta-schema (npm run gen:form-schema) — derived from the registry
```

Each form's own `registry.ts` composes the **app base registry** with its own components +
`data-sources.ts` before `convertJsonToM1Tree`. Do **not** copy the base registry or the meta-schema
into a per-form file — regenerate the meta-schema with `npm run gen:form-schema` when the base
registry changes.

## 3. Scale up: folders (large forms)

When a form grows large (many steps, heavy reuse across steps), promote the flat module to folders.
This is the only case where you split beyond the flat set:

```
[form-name]/
├── [FormName]Form.tsx        # entry
├── index.ts                  # public re-exports
├── lib/                      # domain raw material (target-agnostic): types, constants, calc, custom-validators, api
├── schema/                   # form definition: model.ts, schema.ts (/ render-schema.ts / json-schema.json), behavior.ts, validation.ts, data-sources.ts, create-form.ts
└── components/
    ├── steps/                # one component per wizard step
    ├── nested-forms/         # reusable sub-forms (Address, PersonalData, …)
    └── ui/                   # helper blocks (summary, warnings, sections)
```

**Centralized vs co-located** (folders only): keep one `schema.ts` / `validation.ts` / `behavior.ts`
in `schema/` (easiest cross-target reuse), **or** co-locate each step's `schema/validation/behavior`
inside its `steps/[Step]/` folder while keeping the shared `model` + cross-step rules in `schema/`.
For cross-target reuse keep `lib/` + `schema/{model,behavior,validation}` once and add per-target
presentation — never duplicate model/behavior/validation. The app-level registry + meta-schema (§2)
are unchanged.

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
| `renderer.schema.ts`          | RenderNode layout tree                        |  —   |       ✅       |       —       |
| `renderer.schema.json`        | this form's JSON layout                       |  —   |       —        |      ✅       |
| `renderer.behavior.ts`        | visibility / navigation / submit              |  —   |       ✅       | thin → shared |
| `registry.ts`                 | binds components + data-sources to DSL names  |  —   |       —        |      ✅       |
| **app** `registry.ts` (base)  | ui-kit + system components                    |  —   |       —        | **app-level** |
| **app** `form-schema.schema.json` | generated DSL meta-schema                 |  —   |       —        | **app-level** |
