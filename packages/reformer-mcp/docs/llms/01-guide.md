# ReFormer MCP — start-here guide

This MCP server gives you everything needed to build a form with the ReFormer library
**from this server alone** — no need to read the library source. It exposes documentation
(resources), lookup tools, and workflow prompts.

## How to use it (recommended order)

1. **Get oriented** — run the `start-here` prompt (or read this guide). It returns the M1
   workflow and the map below.
2. **Plan** — for a form from a spec, use the `plan-form` prompt (it reads and parses the spec
   file). For a free-text description, use `create-form`. To detect the target stack, `discover-context`.
3. **Read the workflow** — the M1 build workflow (model → schema → validation → behaviors → arrays →
   wizard → render). It is part of this guide; the whole self-doc is one resource: `reformer://guide`.
4. **Look things up as you code**:
   - `find_recipe <topic>` — a worked example for a scenario (e.g. `wizard`, `form-array`, `cycle`, `json-schema`).
   - `get_symbol_docs <name>` — exact signature + `@example` of a function/type (e.g. `createForm`, `validateFormModel`).
   - `list_symbols` — the API surface by kind/package when you don't know the name.
5. **Add features** with the focused prompts: `add-validation`, `add-behavior`, `add-form-array`, `add-wizard`.
6. **Migrate render target**: `to-renderer` (core → renderer-react), `to-renderer-json` (react → JSON).
7. **Check your work**:
   - `check_behaviors` — declare compute/copy dependencies, get cycle detection.
   - `validate_json_schema` — validate a renderer-json JSON schema before rendering.
   - `review` — cross-package code-review checklist.

## What's where

The full self-doc of this server is one resource — `reformer://guide` (aka `reformer://docs/mcp`) —
covering: **Tools** (callable lookup + validation), **Prompts** (one per workflow step),
**Resources** (`reformer://docs/<pkg>[/<section>]` for the 5 library packages), and the **M1 workflow**.
Individual sections are addressable per-heading (slug from the H2 title); enumerate exact URIs with ListResources.

## The 5 library packages (read their docs via resources)

- `@reformer/core` — model, schema, validation, behaviors (`reformer://docs/core`).
- `@reformer/cdk` — headless FormArray / FormWizard / FormField compounds (`reformer://docs/cdk`).
- `@reformer/ui-kit` — styled field components: Input, Select, Checkbox… (`reformer://docs/ui-kit`).
- `@reformer/renderer-react` — declarative RenderSchema (`reformer://docs/renderer-react`).
- `@reformer/renderer-json` — JSON schema + registry (`reformer://docs/renderer-json`).

## Golden rules

- **M1**: one `createModel` is the source of truth; schema leaves reference its signals (`value: model.$.x`).
- Validation runs through `validateFormModel(model, schema)`, not `form.validate()`.
- The removed path-based API (`validate(path.x)`, `RenderSchemaFn = (path) =>`, `ValidationSchemaFn`) is gone — don't use it.
- Prefer `createForm({ model, schema })` over legacy overloads.
