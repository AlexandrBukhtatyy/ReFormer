# ReFormer MCP — start-here guide

This MCP server gives you everything needed to build a form with the ReFormer library
**from this server alone** — no need to read the library source. It exposes documentation
(resources), lookup tools, and workflow prompts.

## How to use it (recommended order)

1. **Get oriented** — run the `start-here` prompt (or read this guide). It returns the
   workflow and the map below.
2. **Plan** — for a form from a spec, use the `plan-form` prompt (it reads and parses the spec
   file). For a free-text description, use `create-form`. To detect the target stack, `discover-context`.
3. **Read the workflow** — the build workflow of the unified form contract (model → one schema →
   one assembly `createForm` → validation → the one behavior → wizard → draw). It is part of this
   guide; the whole self-doc is one resource: `reformer://guide`. The contract in one place:
   `find_recipe unified-contract`.
4. **Look things up as you code**:
   - `find_recipe <topic>` — a worked example for a scenario (e.g. `wizard`, `form-array`, `cycle`, `json-schema`).
   - `get_symbol_docs <name>` — exact signature + `@example` of a function/type (e.g. `createForm`, `validateModel`).
   - `list_symbols` — the API surface by kind/package when you don't know the name.
5. **Add features** with the prompt `add-feature` — `feature`: `validation` | `behavior` | `array` | `wizard`.
6. **Change who draws**: prompt `to-renderer` — `target`: `renderer-react` (JSX → `FormRenderer` over
   the same schema) | `renderer-json` (the schema as a JSON document + registry).
7. **Check your work** — one tool, `validate_form`, by `kind`:
   - `layout` — file names of the form module against the canonical set;
   - `code` — unknown symbols, operators outside their schema, keys and factories of the former contract;
   - `behaviors` — declare compute/copy dependencies, get cycle detection;
   - `json-schema` — a renderer-json document before rendering;
   - `bundle` — a FormIntent and its schema against each other.

   And the prompt `review` — a cross-package code-review checklist.

## What's where

The full self-doc of this server is one resource — `reformer://guide` (aka `reformer://docs/mcp`) —
covering: **Tools** (callable lookup + validation), **Prompts** (one per workflow step),
**Resources** (`reformer://docs/<pkg>[/<section>]` for the 5 library packages), and the **workflow**.
Individual sections are addressable per-heading (slug from the H2 title); enumerate exact URIs with ListResources.

## The 5 library packages (read their docs via resources)

- `@reformer/core` — model, schema, validation, behaviors (`reformer://docs/core`).
- `@reformer/cdk` — headless FormArray / FormWizard / FormField compounds (`reformer://docs/cdk`).
- `@reformer/ui-kit` — styled field components: Input, Select, Checkbox… (`reformer://docs/ui-kit`).
- `@reformer/renderer-react` — `FormRenderer`: draws the schema tree (`reformer://docs/renderer-react`).
- `@reformer/renderer-json` — the schema as a JSON document + registry (`reformer://docs/renderer-json`).

## Golden rules

- **One contract for every way of drawing**: one schema tree, one binding handle, one assembly, one behavior. One `createModel` is the source of truth; schema nodes are bound to it by the key `model` and the handle `model.$.…` — field `{ model: model.$.x, component }`, array `{ model: model.$.items, item }`, sub-form `{ model: model.$.group, part }`. The keys `value:` / `array:` are the former contract.
- **One assembly**: `useFormBundle(() => createForm({ model, schema, registry?, behavior?, validation? }))` → `{ model, form, validation?, render }`. `createCoreForm` / `createReactForm` / `createJsonForm` are the former contract.
- **One behavior**: `defineFormBehavior(({ model, form, schema }) => …)` holds both the links over the model and the rules for schema nodes (`hideWhen(schema.node(selector), …)`). A separate `form.render.ts` / `renderBehavior` is the former contract.
- Validation is a **separate on-demand schema**, not a schema-leaf concern: run `validateModel(model, schema)` from `@reformer/core/validation` (schema built with `defineValidationSchema(({ model }) => { validate(sig, [rules]); … })`), never `form.validate()`. Ambient operators inside the schema: `validate` / `validateAsync` / `validateWhen` / `cross` / `apply` (a sub-form) / `applyEach` (array rows); field rules (`required()`/`min()`/…) come from `@reformer/core/validators`. Schema nodes carry **no** validators.
- The old validation contract is gone — don't use `validateFormModel`, schema leaves with `{ value, validators: [...] }`, `ModelValidator(value, scope, root)`, conditional `{ when, children }` nodes, or the path-based `ValidationSchemaFn` / `validate(path.x)`. Use the `@reformer/core/validation` operators above instead.
- Low-level `createFormFromModel({ model, schema })` stays for special cases; a form is assembled with `createForm`.
