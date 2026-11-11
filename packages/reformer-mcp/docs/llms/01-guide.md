# ReFormer MCP — start-here guide

## Start here — one path to a form

**Write `<dir>/form.intent.json`, then `form_build {"dir":"<dir>"}` compiles, checks and writes the
module. Never write the module files yourself.**

### The path

1. `form_build {"grammar":"base"}` — the grammar of the intent. Sections on demand: `behavior`,
   `arrays`, `wizard`, `cross`, `async`, `parts`, `operators`, `nodes` (or `all`). Needs no project.
2. Write `<dir>/form.intent.json` with your own file tools. From a markdown spec,
   `plan_form {"specPath":"…","dir":"<dir>"}` writes a draft to finish (never over an existing file).
3. `form_build {"dir":"<dir>"}` cross-checks the intent, type-checks the module and writes every
   file — or nothing while errors remain. Fix the intent on ✗; the form is done on ✓. `dir` is
   relative to the working directory, `form` by default; at a monorepo root pass a folder inside an app.
4. `"target"` keeps the stack, the contract is the same for all three: `core` — you write the JSX
   markup in `index.tsx` (form_build keeps it and type-checks it); `renderer-react` — `FormRenderer`
   over the TS schema; `renderer-json` — the schema as a JSON document plus a registry.

A large form goes in parts: fields + `layoutRoot` → build → validation → build → behavior → build.

### What form_build writes

A flat module with the same names on every target: `model.ts`, `form.schema.ts`,
`form.validation.ts`, `form.behavior.ts`, optional `form.flow.ts` (wizard steps) and
`form.messages.ts` (messages by rule code), `registry.ts` (renderer-json), `data-sources.ts`,
`index.tsx` (the assembly; your markup on core). Yours from the start: `types.ts`, `api.ts` and the
bodies in `operators.ts`. A generated file you edit by hand is detached — the build stops rewriting
it; delete it to bring it back. Test ids come from field paths (`personalData-lastName`).

### Your own code

What the grammar cannot express — own rules and operators (`operators.ts`), loading and submit
(`api.ts`), the markup on core — is code against the library contract:

- `createModel<T>()` is the source of truth; ONE schema tree binds a node by `model: model.$.field`;
- ONE assembly — `createForm({ model, schema, behavior, validation })` inside `useFormBundle`;
- ONE behavior — `defineFormBehavior(({ model, form, schema }) => …)`; validation —
  `defineValidation(({ model }) => …)` with rules from `@reformer/core/validators`, a `{ code }` each;
- checks and submit go through the bundle: `bundle.validate()`, `bundle.submission.submit(handler)`.

### Tools

| Need                                                   | Tool                                              |
| ------------------------------------------------------ | ------------------------------------------------- |
| build a form; the intent grammar                       | `form_build`                                      |
| a draft intent from a markdown spec                    | `plan_form`                                       |
| which of two similar operators                         | `choose_api`                                      |
| context for one step of your own code                  | `get_context`                                     |
| signature and example of a symbol                      | `get_symbol_docs`                                 |
| a worked recipe (`wizard`, `form-array`, `json-schema`) | `find_recipe`                                    |
| docs by words / the API surface                        | `search_docs` / `list_symbols`                    |
| check own code, file names, behaviors, a JSON schema   | `validate_form` (`code`, `layout`, `behaviors`, `json-schema`, `bundle`) |
| report a problem of the server                         | `report_issue`                                    |

Prompts: `start-here`, `create-form` (from a description), `plan-form` (from a spec file),
`add-feature` (`validation` | `behavior` | `array` | `wizard`), `to-renderer`, `review`,
`discover-context`.

### Resources

- `reformer://docs/mcp` — the full self-doc of this server: every tool, prompt and resource in detail.
- `reformer://docs/<package>[/<section>]` — library docs: `core`, `cdk`, `ui-kit`, `renderer-react`,
  `renderer-json`, `form-registry`.
- `reformer://catalog` — every section as `[slug, title]`; `search_docs` returns ready URIs.
- `reformer://status` — which packages the server found, their indexes, whether it can type-check.
  Read it when docs come back empty or a tool reports an environment problem.
