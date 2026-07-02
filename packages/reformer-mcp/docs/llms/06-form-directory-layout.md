# Form directory layout (core / renderer-react / renderer-json)

How to organize the files of one form. A form module is three folders — `lib/` (domain raw
material), `schema/` (the form definition), `components/` (React layout) — plus an entry
component and an `index.ts`. **Keep the module root to just the entry + `index.ts`; put
everything else in a folder.** Only `schema/` (and `components/`) differ between
`@reformer/core`, `@reformer/renderer-react`, and `@reformer/renderer-json`; `lib/` is
identical. Layout is generalized — use `[form-name]` / `[FormName]` as placeholders.

## 1. Overview

| Folder / file          | What lives there                                             | core | renderer-react | renderer-json |
| ---------------------- | ----------------------------------------------------------- | :--: | :------------: | :-----------: |
| `lib/`                 | domain helpers: types, constants, calc, validators, api      |  ✅  |     reuse      |     reuse     |
| `schema/`              | form definition: model + field/layout tree + behavior + validation | ✅ | ✅ (differs) | ✅ (differs) |
| `components/`          | React layout (`steps/`, `nested-forms/`, `ui/`)              |  ✅  |   `ui/` only   |   `ui/` only  |
| `[FormName]Form*.tsx`  | entry component                                             |  ✅  |       ✅       |      ✅       |
| `index.ts`             | public re-exports of the module                             |  ✅  |       ✅       |      ✅       |

Rule of thumb: **domain raw material → `lib/`; anything describing the form → `schema/`;
React layout → `components/`; root = entry + `index.ts`.** For renderer-json the reusable
infrastructure (base component registry + DSL meta-schema) is lifted to the **app level**
(section 5) — the form carries only its own JSON layout and data-sources.

## 2. `lib/` — domain helpers (shared, identical in all targets)

```
lib/
├── types.ts             # form interface + field enums + the { value, label } option type
├── constants.ts         # option dictionaries (LOAN_TYPES, GENDERS, …)
├── calc.ts              # pure functions for derived fields (age, monthlyPayment, …); or calc/ when many
├── custom-validators.ts # reusable validator factories
└── api.ts               # data sources + submit; or api/ when many
```

`lib/` is target-agnostic — it's imported by `schema/`, and reused as-is when the same form
ships on another target.

## 3. `schema/` — the form definition (this is where targets differ)

### Target: core (+ ui-kit)

```
[form-name]/
├── [FormName]Form.tsx        # entry: builds model+form, renders FormWizard + step components
├── index.ts
├── schema/
│   ├── model.ts              # createModel + initial values + array-element factories
│   ├── schema.ts             # FormSchema tree: { value: model.$.x, component, componentProps }
│   ├── behavior.ts           # defineFormBehavior: compute / copyFrom / enableWhen / onChange
│   ├── validation.ts         # validators + validateFormModel config → { validateStep, validateAll }; or validation/
│   └── create-form.ts        # assembly: createForm({ model, schema, behavior }) → { model, form }
├── lib/                      # (section 2)
└── components/
    ├── steps/                # one component per wizard step
    ├── nested-forms/         # reusable sub-forms (Address, PersonalData, …)
    └── ui/                   # helper blocks (summary, warnings, sections)
```

### Target: renderer-react

Layout lives in a `RenderSchema` tree (data, not JSX) → no per-step components; only
`components/ui/` is reused. In `schema/`, `schema.ts` is replaced by `render-schema.ts`
(+ `render-behavior.ts`); no `create-form.ts` (the entry assembles it).

```
[form-name]/
├── [FormName]FormRenderer.tsx  # entry: builds model+form, renders <FormRenderer />
├── index.ts
├── schema/
│   ├── model.ts
│   ├── render-schema.ts        # RenderNode tree (createRenderSchema) — containers + field leaves
│   ├── behavior.ts             # model behavior (reused across targets)
│   ├── render-behavior.ts      # hideWhen / renderEffect / navigation / submit / data-loading
│   └── validation.ts
├── lib/
└── components/
    └── ui/                     # helper blocks referenced by render-schema
```

Leaves carry the **model signal** (`{ value: model.$.x, component, componentProps }`), never
`form.X`. Give a `selector` to any node you drive programmatically (`hideWhen`, `patchProps`).

### Target: renderer-json

The form carries only its own JSON layout + form-specific dataSources. The **base component
registry and DSL meta-schema are app-level, not per-form** (section 5).

```
[form-name]/
├── [FormName]FormRendererJson.tsx # entry: convertJsonToM1Tree(json, appRegistry+formDataSources, model)
├── index.ts
├── schema/
│   ├── model.ts
│   ├── json-schema.json          # THIS form's layout: "$model(x)" / "$component(Name)" / "$dataSource(NAME)"
│   ├── data-sources.ts           # form-specific dataSources (options, item-labels) — extends the app registry
│   ├── behavior.ts               # model behavior (reused)
│   ├── render-behavior.ts        # thin: onInit injects form+validation into the wizard, delegates to shared behavior
│   └── validation.ts
├── lib/
└── components/
    └── ui/                       # form-specific blocks referenced from the JSON via $component(...)
```

## 4. Organizing `schema`: centralized vs co-located

Two ways to arrange the field schema, validation and behavior — pick per project.

**① Centralized** — one `schema.ts` / `validation.ts` / `behavior.ts` for the whole form in
`schema/`; `components/steps/` holds only the step components (as shown in section 3). Easiest
to reuse across targets and to read all of the form's rules in one place.

**② Co-located by step** — each step folder holds its component plus its own `schema.ts` /
`validation.ts` / `behavior.ts`. **Form-level rules stay in `schema/`**: the shared `model.ts`,
cross-step `behavior.ts` (e.g. a premium computed from fields on different steps), cross-step
`validation.ts`, and `create-form.ts` that assembles the per-step partial schemas. Better
navigation and ownership in large forms; cross-target reuse is looser.

```
[form-name]/                    # ② co-located (core)
├── [FormName]Form.tsx
├── index.ts
├── schema/                     # form-level only
│   ├── model.ts                # shared model
│   ├── behavior.ts             # cross-step behavior
│   ├── validation.ts           # cross-step validation
│   └── create-form.ts          # assembles the per-step partial schemas
├── lib/
├── steps/                      # step = component + its own schema/validation/behavior
│   ├── PolicyInfo/
│   │   ├── PolicyInfoForm.tsx
│   │   ├── schema.ts
│   │   ├── validation.ts
│   │   └── behavior.ts
│   └── …                       # one folder per step
├── nested-forms/
└── components/ui/
```

The same choice applies to `renderer-react` / `renderer-json`: keep one `render-schema.ts` /
`json-schema.json`, or split it into per-step fragments living in the step folders (the
cross-step `model`/`behavior`/`validation` still stay in `schema/`).

## 5. App-level infrastructure (renderer-json only)

The component registry is mostly **shared across all JSON forms** — ui-kit components plus the
system containers (`RendererFormWizard`, `Step`, `FIELD_WRAPPER`). The DSL meta-schema is
**generated from that registry**. Neither belongs to a single form — lift them to the app level
(e.g. `src/renderer-json/` or `src/lib/forms/`):

```
src/renderer-json/            # one per application
├── registry.ts               # base ComponentRegistry: ui-kit + RendererFormWizard/Step + FIELD_WRAPPER
└── form-schema.schema.json    # GENERATED DSL meta-schema (npm run gen:form-schema) — derived from the registry
```

Each form's entry composes the **app base registry** with its own `schema/data-sources.ts`
(options, item-label fns, form-specific components) before `convertJsonToM1Tree`. Do **not**
copy the base registry or the meta-schema into a per-form folder — regenerate the meta-schema
with `npm run gen:form-schema` when the base registry changes.

## 6. Reuse map

| Folder / file                   | Role                                     | core | renderer-react | renderer-json |
| ------------------------------- | ---------------------------------------- | :--: | :------------: | :-----------: |
| `lib/*`                         | domain helpers (types/constants/calc/api/validators) | ✅ | reuse | reuse |
| `schema/model.ts`               | reactive model (source of truth)         |  ✅  |     reuse      |     reuse     |
| `schema/behavior.ts`            | model behavior                           |  ✅  |     reuse      |     reuse     |
| `schema/validation.ts`          | validators + validateStep/validateAll    |  ✅  |     reuse      |     reuse     |
| `schema/schema.ts`              | FormSchema field tree                    |  ✅  |       —        |       —       |
| `schema/render-schema.ts`       | RenderNode layout tree                   |  —   |       ✅       |       —       |
| `schema/render-behavior.ts`     | visibility / navigation / submit         |  —   |       ✅       | thin → shared |
| `schema/json-schema.json`       | this form's JSON layout                  |  —   |       —        |      ✅       |
| `schema/data-sources.ts`        | form-specific dataSources                |  —   |       —        |      ✅       |
| `components/steps`,`nested-forms` | per-step / sub-form components          |  ✅  |       —        |       —       |
| `components/ui`                 | helper UI blocks                         |  ✅  |     reuse      |     reuse     |
| **app** `registry.ts` (base)    | ui-kit + system components               |  —   |       —        | **app-level** |
| **app** `form-schema.schema.json` | generated DSL meta-schema               |  —   |       —        | **app-level** |

## 7. Scaling

| Complexity | Structure                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------- |
| Simple     | Single file: `[FormName]Form.tsx` (model + schema + component)                               |
| Medium     | `lib/` (`types`, `constants`) + `schema/` (`model`, `schema`, `validation`) + entry — no deeper nesting |
| Complex    | Full layout: `schema/` + `lib/` + `components/` (+ app-level `registry` / meta-schema for renderer-json) |

For a single target keep everything in one `[form-name]/` module. To ship the same form on
several targets, keep `lib/` + `schema/{model,behavior,validation}` once and add the
per-target presentation files inside `schema/` (`schema.ts` / `render-schema.ts` /
`json-schema.json` + `data-sources.ts`) — never duplicate model/behavior/validation.
