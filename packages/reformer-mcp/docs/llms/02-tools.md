# Tools

Callable tools exposed by the server (use ListTools to enumerate at runtime). Names and
arguments are exact.

## get_symbol_docs

Full JSDoc for one public symbol of any `@reformer/*` package: description, signature,
params, `@returns`, every `@example`, source path.
- `symbol` (string, required) — e.g. `"createForm"`, `"validateFormModel"`, `"FormArray"`.
- `package` (string, optional) — e.g. `"@reformer/core"`; omit to search all.

Use before writing code against an unfamiliar symbol.

## find_recipe

A worked example / how-to for a scenario. Cascade: docs/llms filename → `##` section →
symbol `@example` → fallback list.
- `topic` (string, required) — keyword. Aliases resolve intuitive terms: `wizard`→multi-step,
  `form-array`→arrays, `cycle`→cycle-detection, `cross-field`→sync-fields/copy-from, `json-schema`, etc.
- `package` (string, optional).

Use to copy a correct pattern instead of guessing.

## list_symbols

The API surface by kind and package — discovery when you don't know a name.
- `kind` (optional) — `function` | `class` | `interface` | `type` | `const` | `enum`.
- `package` (optional) — one package or `*`.

E.g. all functions of `@reformer/core` enumerate every validator and behavior. Then
`get_symbol_docs` the one you want.

## validate_json_schema

Validate a `@reformer/renderer-json` form-DSL JSON schema **before rendering**. Checks node
structure, operator syntax (`$model`/`$component`/`$dataSource`), and unknown component/
data-source names.
- `schema` (object | JSON string, required) — the schema you generated.
- `componentNames` (string[], optional) — names in your registry, enables unknown-`$component(...)` detection.
- `dataSourceNames` (string[], optional) — enables unknown-`$dataSource(...)` detection.

Returns `{ valid, errors[] }`. Always run it on a renderer-json schema before handing it off.

## check_behaviors

Static cycle detection for reactive behaviors. Declare, per computed/copied field, what it reads;
the tool finds cyclic dependencies (the loops the runtime throws "Cycle detected" for).
- `dependencies` (required) — array of `{ target: string, reads: string[] }`.

E.g. `[{ target: "total", reads: ["price","quantity"] }]`. Run after planning compute/copyFrom.

## report_issue

Record a ReFormer problem + its fix to a local knowledge store (`~/.reformer/issues.jsonl`).
- `error` (string, required), `solution` (string, required), optional `tags`, `context`.

Use when you discover and fix a non-obvious ReFormer error, to help future runs.

---

_A `debug` tool exists only when the server runs with `REFORMER_DEBUG=true`; ignore it in normal use._
