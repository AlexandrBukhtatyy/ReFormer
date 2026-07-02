# Form directory layout (core / renderer-react / renderer-json)

How to organize the files of one form across the three render targets. A form is one
**shared core** (data + rules, target-agnostic) plus a thin **presentation layer** that
differs per target. Only the presentation layer changes between `@reformer/core`,
`@reformer/renderer-react`, and `@reformer/renderer-json` — the core is written once and
reused. Layout below is generalized from a real complex multi-step form; use `[form-name]`
/ `[FormName]` as placeholders.

## 1. Overview — what is shared vs target-specific

| Layer                     | core (+ ui-kit)              | renderer-react            | renderer-json                     |
| ------------------------- | ---------------------------- | ------------------------- | --------------------------------- |
| Types / constants / api   | shared                       | reuse                     | reuse                             |
| `model.ts`                | shared                       | reuse                     | reuse                             |
| `validation.ts`           | shared                       | reuse                     | reuse                             |
| `behavior.ts` (model)     | shared                       | reuse                     | reuse                             |
| `utils/compute/`          | shared                       | reuse                     | reuse                             |
| Field/layout tree         | `schema.ts` + step components | `render-schema.ts`        | `json-schema.json` + `registry.ts` |
| Render behavior           | — (React components)         | `render-behavior.ts`      | thin `render-behavior.ts` → shared |
| Entry component           | `[FormName]Form.tsx`         | `[FormName]FormRenderer.tsx` | `[FormName]FormRendererJson.tsx` |

Rule of thumb: **put anything that isn't layout into the shared core.** Renderer variants
should import the core (types, model, validation, behavior, constants, api, compute, ui
components), not re-declare it.

## 2. Shared core (all targets)

```
[form-name]/
├── types/
│   ├── [form-name].ts        # main form interface + field enums (LoanType, EmploymentStatus…)
│   └── option.ts             # shared { value, label } option type
├── constants/
│   └── [form-name].ts        # option dictionaries (LOAN_TYPES, GENDERS, …) used by schema + behavior
├── api/
│   ├── index.ts              # re-exports
│   ├── fetch-*.ts            # data sources (dictionaries, regions, cities, …) + a mock for dev
│   └── submit-*.ts           # submit endpoint
├── utils/compute/
│   └── compute-*.ts          # pure functions for derived fields (age, monthlyPayment, totalIncome…)
├── model.ts                  # createModel factory + initial values + blank-element factories for arrays
├── validation.ts             # validators + validateFormModel config → { validateStep, validateAll }
└── behavior.ts               # defineFormBehavior: compute / copyFrom / enableWhen / onChange
```

- **`model.ts`** is the source of truth (`FormModel<[FormName]>`); every target binds to its signals.
- **`validation.ts`** and **`behavior.ts`** are target-agnostic — the same reactive rules power all three.
- Split `utils/compute/*` one function per derived field so `behavior.ts` reads cleanly.

## 3. Target: core (+ ui-kit)

Adds the field tree as a `FormSchema` plus React components for layout.

```
[form-name]/
├── …shared core (section 2)…
├── schema.ts                 # FormSchema tree: { value: model.$.x, component, componentProps }
├── create-form.ts            # assembly: createForm({ model, schema, behavior }) → { model, form }
├── operators.ts              # optional: custom behavior operators (loadOptionsOn, clearWhenOff…)
├── components/
│   ├── steps/                # one component per wizard step (BasicInfoForm, …)
│   ├── nested-forms/         # reusable sub-forms (Address, PersonalData, …)
│   └── ui/                   # helper blocks (summary, warnings, sections)
├── hooks/                    # React hooks (load data, copy address, …)
└── [FormName]Form.tsx        # entry: builds model+form, renders FormWizard + step components
```

## 4. Target: renderer-react

Layout lives in a `RenderSchema` tree (data, not JSX), so per-step components are not needed.
`components/ui/` blocks are still reused.

```
[form-name]/
├── …shared core (section 2)…
├── render-schema.ts          # RenderNode tree: containers (Step/Section/Box) + field leaves
│                             # created via createRenderSchema(() => buildSchema(model))
├── render-behavior.ts        # hideWhen / renderEffect / navigation / submit / data-loading
└── [FormName]FormRenderer.tsx # entry: builds model+form, renders <FormRenderer />
```

- Leaves carry the **model signal** (`{ value: model.$.x, component, componentProps }`), never the resolved `form.X`.
- Give a `selector` to any node you manipulate programmatically (`hideWhen`, `patchProps`).

## 5. Target: renderer-json

Layout is a static JSON document (string operators) plus a component registry. Runtime
entities (a `FormProxy`, a validation config) are injected via a thin render-behavior.

```
[form-name]/
├── …shared core (section 2)…
├── json-schema.json          # layout as JSON: "$model(x)" / "$component(Name)" / "$dataSource(NAME)"
├── form-schema.schema.json    # JSON Schema validating json-schema.json structure
├── registry.ts               # component + dataSource registry (names → components / option arrays / fns)
├── render-behavior.ts        # thin: onInit injects form + validation into the wizard, then delegates
│                             # to the shared renderer-react render-behavior
└── [FormName]FormRendererJson.tsx # entry: convertJsonToM1Tree(json, registry, model) + <JsonFormRenderer />
```

- The JSON is loadable from a string (server/CMS/file); `registry.ts` maps `$component(...)` / `$dataSource(...)` to real components and values.
- The render-behavior is intentionally thin — it reuses the renderer-react behavior so visibility/navigation/submit logic is defined once.

## 6. Reuse map

| File / folder            | Role                                              | core | renderer-react | renderer-json |
| ------------------------ | ------------------------------------------------- | :--: | :------------: | :-----------: |
| `types/`, `constants/`   | data interface + option dictionaries              |  ✅  |     reuse      |     reuse     |
| `api/`, `utils/compute/` | data sources + derived-field functions            |  ✅  |     reuse      |     reuse     |
| `model.ts`               | reactive model (source of truth)                  |  ✅  |     reuse      |     reuse     |
| `validation.ts`          | validators + validateStep/validateAll config      |  ✅  |     reuse      |     reuse     |
| `behavior.ts`            | model behavior (compute/copyFrom/enableWhen)      |  ✅  |     reuse      |     reuse     |
| `schema.ts`              | FormSchema field tree                             |  ✅  |       —        |       —       |
| `components/steps,nested-forms` | per-step / sub-form React components        |  ✅  |       —        |       —       |
| `components/ui/`         | helper UI blocks                                  |  ✅  |     reuse      |     reuse     |
| `render-schema.ts`       | RenderNode layout tree                            |  —   |       ✅       |       —       |
| `render-behavior.ts`     | visibility/navigation/submit                      |  —   |       ✅       | thin → shared |
| `json-schema.json` + `registry.ts` | JSON layout + component/dataSource registry |  —   |       —        |      ✅       |

## 7. Scaling

| Complexity | Structure                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------- |
| Simple     | Single file: `[FormName]Form.tsx` (model + schema + component)                               |
| Medium     | Split shared core: `types.ts`, `model.ts`, `schema.ts`, `validation.ts`, entry component    |
| Complex    | Full layout above: `behavior.ts`, `constants/`, `api/`, `utils/compute/`, plus the target's presentation layer (`schema.ts` + `components/` **or** `render-schema.ts` **or** `json-schema.json` + `registry.ts`) |

For a single target keep everything in one `[form-name]/` module. To ship the same form on
several targets, keep the shared core once and add the per-target presentation files (or
per-target subfolders) that import it — never duplicate model/validation/behavior.
