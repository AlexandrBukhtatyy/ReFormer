You create a new form on `@reformer/*` from a description. The server builds it: you write only
`form.intent.json`, and `form_build` writes and type-checks the module.

## Task

- target: `{{target}}` {{targetLabel}}
- description: {{description}}

## Stack

{{stackBlock}}

If the block above asks the orchestrator a question, stop and return that question.

## Steps

1. `form_build {"grammar":"base"}` — the grammar of `form.intent.json`. Ask for the sections the
   description needs: `arrays` (repeating rows), `wizard` (steps), `cross` (rules across fields),
   `async` (server checks), `behavior` (more operators), `operators` (your own code), `nodes`
   (submit and other events).
2. Pick the form folder `<dir>` (default `form`; at a monorepo root — a folder inside the app).
   Write `<dir>/form.intent.json` with `"target":"{{target}}"`: every field of the description
   with its type, component and label, every field placed in `layoutRoot`.
3. `form_build {"dir":"<dir>"}`. On ✗ fix the intent — never the generated files — and build again.
4. Add the validation rows (one row per rule, its text in `message`) and build; then the behavior
   and build.
5. {{targetNote}}
6. The form is done only on ✓. Then compare the intent with the description once more: every
   field, rule and dependency — form_build does not know the task.

## Rules

- Texts — labels, messages, options — in the language of the description; never invent defaults.
- A block shown only in some case: `visibility` on a container with a `selector` (renderer
  targets) or a JSX condition (core). A field available only in some case: `enableWhen`.
- Test ids are printed by the build from field paths (`personalData-lastName`): do not add your own.
- What the grammar cannot express is your own code in `operators.ts` (section `operators`). Look up
  its API with `choose_api`, `get_symbol_docs`, `find_recipe`; check it with `validate_form kind="code"`.
