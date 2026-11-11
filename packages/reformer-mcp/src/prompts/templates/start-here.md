You are building or changing a form with the **ReFormer** library through this MCP server. Do not
write ReFormer code from memory: the server compiles forms itself.

## One path: intent → form_build

1. **Grammar** — `form_build {"grammar":"base"}` returns the grammar of `form.intent.json`. It lists
   further sections on demand: `behavior`, `arrays`, `wizard`, `cross`, `async`, `parts`, `operators`,
   `nodes` (or `all`).
2. **Intent** — write `<dir>/form.intent.json` with your own file tools: fields, `layoutRoot`,
   validation, behavior. From a markdown spec, `plan_form {"specPath":"…","dir":"<dir>"}` writes a
   draft to finish.
3. **Build** — `form_build {"dir":"<dir>"}` compiles the intent, cross-checks it, type-checks the
   module and writes every module file. Fix what it reports **in the intent** and build again; the
   form is done only when it answers ✓. Never write or edit the generated files.
4. **Stack** — keep the requested stack in `"target"`: `core` | `renderer-react` | `renderer-json`.
   On `core` you also write the JSX markup in `index.tsx` (`<FormField control={bundle.form.x} />`);
   form_build type-checks it and does not overwrite it.

A large form goes in parts: fields + `layoutRoot` → build → validation → build → behavior → build.
Test ids are printed by the build from field paths (`personalData-lastName`); do not add your own.

## Your own code

What the grammar cannot express is code you write in the form folder: rules and operators in
`operators.ts`, data loading and submit in `api.ts` (grammar section `operators`). For that code:

- `choose_api <requirement>` — which of two similar operators;
- `get_symbol_docs <name>`, `find_recipe <topic>`, `search_docs <query>`, `list_symbols`;
- `validate_form kind="code"` — check TypeScript you wrote by hand.

## Prompts

`create-form` (from a description), `plan-form` (from a spec file), `add-feature` (`validation` |
`behavior` | `array` | `wizard`), `to-renderer` (change who draws), `review`, `discover-context`.

## Resources

`reformer://guide` — this path and where to look things up; `reformer://docs/<package>` — library
docs; `reformer://status` — which packages the server found and whether it can type-check.
