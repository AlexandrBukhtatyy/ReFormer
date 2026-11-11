# Prompts

Workflow prompts. Each returns an instruction message for one step: what to write in
`form.intent.json`, which grammar section to ask for, when to call `form_build`.

> **Prompts are a human channel, and most agent clients do not expose them.** If you are an
> agent, check first: without a way to list or invoke prompts, none of this section is reachable
> for you — and there is no error to tell you so. Every prompt below names its tool equivalent;
> use that instead. This is not a fallback, it is the supported path for tool-only consumers.

| Prompt                        | Tool-only equivalent                                                        |
| ----------------------------- | --------------------------------------------------------------------------- |
| `start-here`                  | read the resource `reformer://guide`                                        |
| `discover-context`            | read `reformer://status`; `get_context` with your task and `target`          |
| `plan-form`                   | `plan_form {specPath, dir}`, then finish the draft and `form_build`         |
| `create-form`                 | `form_build {"grammar":"base"}`, write the intent, `form_build {dir}`       |
| `add-feature` / `to-renderer` | the grammar section of the feature, edit the intent, `form_build {dir}`     |
| `review`                      | `validate_form` — `kind: "layout"`, then `code` / `behaviors` / `json-schema` |

## start-here

No arguments. The one path to a form (grammar → `form.intent.json` → `form_build`), where your own
code goes, and the map of tools, prompts and resources.

**Tool-only equivalent:** the resource `reformer://guide`.

## discover-context

- `description` (required), `projectPath` (optional).

Detects the stack of the project (ui-kit, Tailwind, which renderer) and recommends a target.
Optional first step when the target isn't given.

## plan-form

- `specPath` (required), `target` (optional: core | renderer-react | renderer-json), `projectPath` (optional).

Summarises the spec — steps, fields, conditional and computed fields, arrays, API — and leads
through `plan_form` (a draft intent on disk), finishing the draft against the spec, and
`form_build` until ✓.

## create-form

- `description` (required), `target` (optional, default core), `projectPath` (optional).

A new form from a description: the detected stack, the grammar sections to ask for, the intent,
`form_build`, and what is left to you on the chosen target (the JSX markup on core).

## add-feature

One capability for a form built with `form_build`, chosen by `feature`:

- `validation` — rows of `validation` (sections `cross`, `async` when needed);
- `behavior` — records of `behavior` and `visibility` (`choose_api` per requirement);
- `array` — a record of `arrays` with row rules and behaviors (section `arrays`);
- `wizard` — a `FormWizard` root with steps (section `wizard`).

Arguments: `requirements` (what to add; for `wizard` — the steps and their fields) and, optionally,
`code` — the current `form.intent.json`.

## to-renderer

Switch the form to `target`: `renderer-react` (default) or `renderer-json` — `"target"` in the
intent and `form_build`; a hand-written `index.tsx` from core is moved out first. Optional `code` —
the current intent.

## review

- `code` (required).

Cross-package review checklist (state setup, integration, anti-patterns) for existing form code.

---

_A `debug` prompt exists only with `REFORMER_DEBUG=true`._
