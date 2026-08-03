# Tools

Callable tools exposed by the server (use ListTools to enumerate at runtime). Names and
arguments are exact.

## get_symbol_docs

Full JSDoc for one public symbol of any `@reformer/*` package: description, signature,
params, `@returns`, every `@example`, source path.
- `symbol` (string, required) — e.g. `"createForm"`, `"validateModel"`, `"FormArray"`.
- `package` (string, optional) — e.g. `"@reformer/core"`; omit to search all.

Use before writing code against an unfamiliar symbol.

## find_recipe

A worked example / how-to for a scenario. Cascade: docs/llms filename → `##` section →
symbol `@example` → fallback list.
- `topic` (string, required) — keyword. Aliases resolve intuitive terms: `wizard`→multi-step,
  `form-array`→arrays, `cycle`→cycle-detection, `copy`→copy-from, `sync`→sync-fields (value
  propagation between fields — a **behavior**), and the validation contract:
  `validate`/`validation`/`cross`/`cross-field`/`validate-async`/`validate-when`→`validation`
  (the `validate`/`validateAsync`/`validateWhen`/`cross`/`each`/`apply` operators + the external
  `validateModel(model, schema)` runner), `json-schema`, etc.
- `package` (string, optional).

Use to copy a correct pattern instead of guessing.

## search_docs

Full-text search across every documentation section of all `@reformer/*` packages — for when
you can't name the symbol or recipe topic but can describe the task in words. Returns ranked
sections with their `reformer://docs/<pkg>/<slug>` resource URI + a matched snippet; read the
URI to get the full section.
- `query` (string, required) — e.g. `"conditional required validation"`, `"reset form after submit"`.
- `package` (string, optional) — one package or `*`.
- `limit` (number, optional) — default 10, max 25.

Reach for `find_recipe` (curated topic→recipe) or `get_symbol_docs` (one symbol) when you
already know the topic or name; `search_docs` is the fallback when you don't.

## list_symbols

The API surface by kind and package — discovery when you don't know a name.
- `kind` (optional) — `function` | `class` | `interface` | `type` | `const` | `enum`.
- `package` (optional) — one package or `*`.
- `nameContains` (optional) — case-insensitive substring of the symbol name (e.g. `"validate"`,
  `"FileUpload"`). Strongly recommended: the unfiltered surface is 800+ symbols.

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
