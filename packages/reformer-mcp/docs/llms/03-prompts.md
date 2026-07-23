# Prompts

Workflow prompts (use ListPrompts to enumerate). Each returns an instruction message that
orchestrates one step and points you at the resources/tools to read. Invoke them in roughly
this order.

## start-here

No arguments. The entry point: returns the M1 workflow, the map of prompts/tools/resources,
and the reading order. Call it first when asked to build or modify a form.

## discover-context

- `description` (required), `projectPath` (optional).

Detects the target stack (ui-kit / Tailwind / which renderer) from the consumer project and
recommends a render target. Optional first step when the target isn't given.

## plan-form

- `specPath` (required), `target` (optional: core | renderer-react | renderer-json), `projectPath` (optional).

Reads and parses a markdown spec file, then returns a roadmap: steps, fields, conditionals,
behaviors, API endpoints, a risk matrix, and verification scenarios. Use when the form comes
from a written spec.

## create-form

- `description` (required), `target` (optional, default core), `projectPath` (optional).

Turns a free-text form description into build instructions for the chosen target (quick-start,
FormSchema reference, imports, stack-aware skeleton). Use for the initial form when there is no spec file.

## add-validation

- `code` (existing FormSchema, required), `requirements` (required).

Adds validation (built-in factories in `validate(sig, [...])`, cross-field `cross`, async
`validateAsync`) as a standalone `defineValidationSchema` run by `validateModel`.

## add-behavior

- `code` (required), `requirements` (required).

Wires reactive behaviors: `compute`, `copyFrom`, `enableWhen`, `onChange`, etc. Pair with the
`check_behaviors` tool to rule out cycles.

## add-form-array

- `code` (required), `requirements` (required).

Turns a field into a dynamic array: schema `{ array, item, initialValue }` + the CDK `FormArray` compound.

## add-wizard

- `code` (required), `steps` (required).

Turns a single-page form into a multi-step `FormWizard` with a `FormWizardConfig` `{ validateStep, validateAll }`.

## to-renderer / to-renderer-json

- `code` (required).

Migrate render target: `to-renderer` (core manual JSX → renderer-react RenderSchema),
`to-renderer-json` (renderer-react RenderSchema → renderer-json JSON + registry). After
`to-renderer-json`, validate the result with `validate_json_schema`.

## review

- `code` (required).

Cross-package review checklist (state setup, integration, anti-patterns) for existing form code.

---

_A `debug` prompt exists only with `REFORMER_DEBUG=true`._
