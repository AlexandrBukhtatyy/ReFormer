# Tools

Callable tools exposed by the server (use ListTools to enumerate at runtime). Names and
arguments are exact.

## get_context

Assembled context for ONE step of work: operator + signature + a canonical example + rules,
anti-patterns and links, deduplicated and cut to a budget.

- `task` (string, required) — the task in your own words, in English or Russian.
- `topics` (string[], optional) — topic ids from `reformer://catalog`; without them the topics are
  inferred from the task.
- `target` (string, optional) — `core` | `cdk` | `ui-kit` | `renderer-react` | `renderer-json`.
- `profile` (string, optional) — `minimal` (~400 tok) | `implementation` (default, ~1000)
  | `debug` (~1800, anti-patterns ahead of the example) | `full` (no ceiling).
- `maxTokens` (number, optional) — a hard ceiling, overrides the profile.

**For a pointed "which API does this" question `choose_api` is cheaper and sharper.** This is
measured, not assumed: as the ONLY call `get_context` gives 69.6% first-pass against 95.7% for
`choose_api` plus a pointed search, at twice the cost per task. `get_context` helps when you need the
context of a whole step at once, or a hard token ceiling.

The shape of the answer shows its confidence: when no rule matched and no symbol is confirmed by the
sections found, there is no `## API` block — the answer says so and leads with sections instead. An
empty block is safer than a confident guess.

## choose_api

Which ReFormer operator meets a requirement stated in your own words. It answers the question the
docs search does not: **which of two similar ones** — `computeFrom` vs `copyFrom`, `copyFrom` vs
`syncFields`, `enableWhen` vs `hideWhen`, `resetWhen` vs `enableWhen`, `validateWhen` vs
`enableWhen`, `resetWhen` vs `onChange`.

The last pair is about the trigger, and it is confused most often. `resetWhen` holds by a
**condition** ("while the payment method is not a card"), while "clear the field when the controlling
one changed" is the **fact of a change**, that is `onChange`. Clearing an array is `onChange` too:
`ModelArray` has its own `.clear()`, and `resetValue` does not apply to it.

- `requirement` (string, required) — ONE requirement, in English or Russian. E.g. "field B is
  available only when A is filled", "total = price \* quantity", "confirmPassword must match
  password".
- `target` (string, optional) — `core` | `renderer-react` | `renderer-json`; narrows the fallback
  search when no rule matched.

Returns the recommended symbol with its signature, a canonical example, why it fits, when it does
NOT, and the anti-patterns the docs record for that substitution. Deterministic: the same requirement
gives the same answer. Each answer also says how the operator is written in `form.intent.json`.

Measured on the eval corpus (46 tasks): with `choose_api` as the first step first-pass went from
80.4% to 95.7%, median tokens per task from 916 to 299, and no task was left unsolved.

## get_symbol_docs

Full JSDoc for one public symbol of any `@reformer/*` package: description, signature,
params, `@returns`, every `@example`, source path.

- `symbol` (string, required) — e.g. `"createForm"`, `"validateModel"`, `"FieldArray"`.
- `package` (string, optional) — e.g. `"@reformer/core"`; omit to search all.

Use before writing code against an unfamiliar symbol.

## find_recipe

A worked example / how-to for a scenario. Cascade: docs/llms filename → `##` section →
symbol `@example` → **full-text search** (same index as `search_docs`) → fallback list.
An unknown topic is no longer a dead end: it comes back as ranked `reformer://docs/…`
candidates with snippets, and the top hit is inlined when it matches a section heading.

- `topic` (string, required) — keyword. Aliases resolve intuitive terms: `wizard`→multi-step,
  `form-array`→arrays, `cycle`→cycle-detection, `copy`→copy-from, `sync`→sync-fields (value
  propagation between fields — a **behavior**), and the validation contract:
  `validate`/`validation`/`cross`/`cross-field`/`validate-async`/`validate-when`→`validation`
  (the `validate`/`validateAsync`/`validateWhen`/`cross`/`apply`/`applyEach` operators + the external
  `validateModel(model, schema)` runner), `json-schema`, `unified-contract` (the contract of a form in
  one place: one schema, one assembly, one behavior), etc.
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

## validate_form

One door to every check of a form. The kind of check is the `kind` argument; the result always has
one shape: `RF0xx` diagnostics with the place, what to do and a ready next call.

- `kind: "code"` — generated TypeScript. Catches what `tsc` does not see: an unknown `@reformer/*`
  symbol (`RF002`, with similar names), an import from the wrong package OR the wrong subpath
  (`RF003` — `validate` lives only in `@reformer/core/validation`), a validation or behavior
  operator outside its schema (`RF004`/`RF005` — the rule is just not registered, and the field
  silently goes unvalidated), `@deprecated` and removed API of the previous form contract (`RF010`):
  the factories `createCoreForm` / `createReactForm` / `createJsonForm`, the hooks `useReactForm` /
  `useJsonForm`, `JsonFormRenderer`, the node keys `value:` / `array:`, the operator `each`,
  `makeValidationConfig`, the field `renderBehavior` — with the replacement named and the recipe
  `find_recipe unified-contract`.
- `kind: "json-schema"` — a schema document (JSON DSL): node structure, operator syntax, unknown
  component and data-source names. The document is of format 2 (`"format": 2`: key `model`,
  dictionary `parts`, operator `$part`); a document of the previous format gets one error advising
  `migrateJsonSchema`; an object without `format` and `root` (a JSON Schema of the data, a FormIntent)
  is named as "not a form document".
- `kind: "behaviors"` — cycles in computed fields (`RF006`), from the declared `{ target, reads[] }`.
- `kind: "bundle"` — `intent` (an object or a JSON string) is judged the way the build judges it,
  one verdict: problems reading a record (`RF014`, with the nearest key), the C1–C13 cross-checks
  (every `$model` exists in the model, every `$component` is registered, every `$part` is declared,
  every rule target exists, visibility selectors are in the schema, steps are not mixed with other
  nodes — C13), a field outside the layout, a lost issue text, a component not from the kit
  (`RF008`), rules the target does not run (`RF016`: visibility on core). `schema` is optional:
  without it the intent is checked against the schema the build would make.
- `kind: "layout"` — the NAMES of the form module files against the canon (`files[]` + `target`).
  One set for every target; files of the previous contract (`form.render.ts`, `wizard.tsx`,
  `renderer.*`, `validation.ts`) are warnings that say where to move their content.

The limits of the check are printed ALWAYS, a clean report included: "no errors" must not read as
"the code is right" — the parse is line-based, without a TypeScript AST (a deliberate choice:
`typescript` weighs 23 MB and is not a required dependency).

The former `validate_json_schema` and `check_behaviors` are replaced by this tool and removed in 7.0.

## plan_form

A markdown spec → a draft `<dir>/form.intent.json` on disk. The answer is a short summary — what
was parsed (fields, steps, arrays, rules) and what to finish by hand; the intent itself is not
printed, so a large JSON never passes through the model twice. An existing intent file is never
overwritten.

- `specPath` (string, required) — the spec, absolute or relative to the working directory.
- `dir` (string, optional) — the form folder, as in `form_build` (default `form`; required at a
  monorepo root).
- `target` (string, optional) — `core` | `renderer-react` | `renderer-json`.

The parse is heuristic and says so: field types without a type column are guessed by name; formulas
of computed fields and visibility rules are not extracted. A free-text description is no longer
parsed — it gave an empty draft: write the intent by the grammar instead.

## form_build

The one way to make a form: a module on disk from one file, `<dir>/form.intent.json`. You write and
edit only that file with your own Write/Edit; `form_build` compiles it, cross-checks it, type-checks
the module and writes every module file itself, answering with diagnostics only. Nothing is written
while errors remain. There is no `form_build` in the browser worker — it has no disk.

`generate_form` of 6.x, which printed the files for the agent to write by hand, is removed in 7.0,
and so are the aliases `validate_json_schema` and `check_behaviors` (use `validate_form`).

- `dir` (string, optional) — the form folder relative to the working directory, `form` by default;
  required at a monorepo root (a `package.json` with `workspaces`): the default would put the form
  outside every app.
- `grammar` (string, optional) — return the intent grammar instead of building: `base`, a section
  (`behavior`, `arrays`, `wizard`, `cross`, `async`, `parts`, `operators`, `nodes`), several
  comma-separated (`base` may be one of them: `base,arrays` is the base and the section), or `all`.
  `components` lists the kit components by purpose (fields and containers, for a form or a page);
  `components:Card,Tabs` describes each — role, import, parts and props with types, values and the
  kit's descriptions. Needs neither a project nor an intent file.

Without an intent file the call answers with the base grammar. Built files start with the mark
`// @reformer-form-build`; a file edited by hand is detached — the build leaves it alone and says
so. `types.ts` and `api.ts` belong to you. `index.tsx` is built on every target: on `core` it is a
stub with samples — a field, visibility in JSX, `bundle.submission.submit`, steps — kept in step
with the intent until you write your markup there; a renderer target replaces an untouched stub with
its assembly and refuses to keep markup written by hand. Details — `06-form-directory-layout`,
section «`form.intent.json`».

A finding is one line: `<code> at <place>: <what is wrong> → <what to do>`. An unknown key of a
record is an error (`unknown-key`, with the nearest key); a component prop written next to the field
(`placeholder`, `min`) is moved into `componentProps` with a note. The verdict is the one of
`validate_form kind="bundle"`; on top of it the build type-checks the module (a type error says
which file to fix) and needs the environment: `@reformer/core` and `@reformer/ui-kit` installed in
the project.

The lines of the answer, in order (tools and test harnesses parse them — the format is fixed by a
test):

| Line                                                                              | When                                                                                                                                                                                             |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `⚠️ form_build: nothing built — <why>. <next call>`                               | first line when nothing was built and the grammar follows: `<dir>/form.intent.json` does not exist (a `form.intent.json` found above the folder is named), or `grammar` came together with `dir` |
| `✗ form_build: <what> — nothing written.`                                         | first line of a refusal; `<what>` — `form.intent.json is not read in full`, `N errors`, `the environment`, `wrong imports`, …                                                                    |
| `- <finding>`                                                                     | under a refusal: at most 12 findings                                                                                                                                                             |
| `… and N more.`                                                                   | after the 12th finding, or after the 20th warning                                                                                                                                                |
| `✓ form_build: written N, unchanged M. Fields F, arrays A, rules R, behaviors B.` | first line of a success                                                                                                                                                                          |
| `Types checked, no errors.`                                                       | second line: the module type-checked clean                                                                                                                                                       |
| `⚠️ Types NOT checked: <reason>. …`                                               | second line instead: nothing to check with (no `typescript`); not "no errors"                                                                                                                    |
| `Folder <path>: <files>.`                                                         | the module folder and its files                                                                                                                                                                  |
| `⚠️ …`                                                                            | reminders: no markup yet on core, operator stubs, files edited by hand that the build no longer produces                                                                                         |
| `Edited by hand and left as is: <files>. …`                                       | files detached from the build                                                                                                                                                                    |
| `Warnings: N.`                                                                    | then `- <warning>` lines, at most 20                                                                                                                                                             |

## report_issue

Record a ReFormer problem + its fix as a JSON report on disk — one file per report,
`<project root>/.reformer/issue_reports/<timestamp>-<slug>.json`.

- `error` (string, required), `solution` (string, required), optional `tags`, `context`.

The directory is configurable via the `REFORMER_ISSUE_REPORTS_DIR` env var — an absolute path;
a leading `~` expands to the home directory, a relative value is refused with a text answer. Project root = nearest `package.json` with dependencies above
cwd, searched from outside `node_modules` (an npx run from `node_modules/@reformer/mcp` still writes
to the app); when there is none, reports land in cwd itself. The default `.reformer/` gets its own
`.gitignore`, so reports never reach your commits.

Use when you discover and fix a non-obvious ReFormer error, to help future runs.

## Guided profile (`REFORMER_SURFACE=guided`)

A surface for small local models: the server plans the work and builds; the model only sends
small edits. It lists four tools — `form_start`, `form_edit`, `form_status`, `form_build` — and
no reference tools. Every answer ends with `Next:` — one exact call — until `Done`.

`REFORMER_SURFACE=code-guided` puts the same API inside Code Mode — one `run_script` tool, the
functions are `reformer.formStart`, `reformer.formEdit`, `reformer.formStatus`,
`reformer.formBuild`. The `Next:` lines come as code (`await reformer.formEdit({…})`); a script
that prints nothing gets the answer of its last call. Its `run_script` has its own TypeScript
declaration: `edits: Edit[]`, where `Edit` is a union by `op` with a doc line on every key, the
answer layout under `@returns` and `@example` calls; the preamble says the server writes every file
of the form folder. A call there does not throw: a failed build after applied edits is an answer
with `✗ form_build`, not a script error. The plain Code Mode surface is unchanged.

The form files belong to the server. `form.intent.json` written by hand is put back to the last
version the server wrote (or removed, if the server has not written one yet) before `form_edit`,
`form_status` and `form_build` read it; module files written by hand are rebuilt. Build answers
speak in edits: a type error points to the edit that fixes it, without file names or a file
list. `form_build` with no plan and no form leads to `form_start` instead of the grammar.

- **`form_start`** `{dir?, target, task? | specPath?, formName?}` — plans the stages from the
  task words or the spec (fields; rows, steps, validation, cross-field rules, reactions as
  needed; markup on core) and saves them to `<dir>/form.plan.json`. With `specPath` and no intent
  yet, it drafts `form.intent.json` from the spec as `plan_form` does. A task that names a `.md`
  file the server can read (as written or inside `dir`) gets it as `specPath`.

  **A form already in `dir`** (an intent and no plan, or a plan of a change): the task changes it.
  The plan is one stage `edit`: the changes with `form_edit`, then `confirm: "edit"` after a check
  of the changes — what was added, removed or renamed since the start, and what the task names: a
  key in backticks or parentheses (`` `phone` ``, `(phone)`; bare latin keys in a Russian text when
  none is quoted), a field label in a sentence that removes it, a step in «…». A field the task does
  not name that lost its checks is a difference too («the rest stays as is»). The checks of a new
  form (numbers, labels, lost fields) do not run on a change.

- **`form_edit`** `{dir?, edits}` — flat edits; the server writes `form.intent.json` and runs the
  same build as `form_build` (the answer holds its `✓`/`✗ form_build` lines). Edits apply one by
  one: a rejected edit says how to fix it, the others still apply; `"edits":[]` only builds.

  | op                            | Keys                                                                                                                                                                                        |
  | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | `add_field`, `set_field`      | `name`, `label`, `type` (string number boolean date), `options`, `mask`, `initialValue`, `placeholder`, `readonly`, `component`, `step`; `set_field` with `array` — a row field             |
  | `remove_field`                | `name` — a field, an array or a group; also drops its rules and names the rules of other fields that still read it                                                                          |
  | `rename_field`                | `name`, `to`, `label` — rewrites rules, behaviors (targets, sources, `expr`), conditions, visibility and the layout                                                                         |
  | `rename_step`, `remove_step`  | `title` (or number), `to`; `remove_step` drops the step with its fields, rules and behaviors                                                                                                |
  | `add_array`, `add_item_field` | `name`, `label`, `minItems`, `maxItems`; `array`, `name`, `label`, `type`. A plan without rows refuses `add_array` once; the same call again adds the stage                                 |
  | `add_step`, `place`           | `title`, `fields`; `name`, `step` (number, title or selector)                                                                                                                               |
  | `add_rule`                    | `field`, `array`, `required` `email` `phone` `url` `integer` (true), `min` `max` `minLength` `maxLength` (numbers), `pattern`, `rule`, `cross`, `equals` (another field), `when`, `message` |
  | `remove_rule`                 | `field`, `rule` — one validator; without it every rule of the field                                                                                                                         |
  | `add_behavior`                | `kind` (a core operator), `target`, `expr`, `array`, `when`, `resetOnDisable`; `sources` come from `expr`; the same behavior of the field is replaced                                       |
  | `remove_behavior`             | `target`, `kind` — one kind; without it every behavior of the field                                                                                                                         |
  | `add_visibility`              | `field` or `fields`, `showWhen` or `hideWhen` — renderer targets only                                                                                                                       |
  | `set_form`                    | `formName`                                                                                                                                                                                  |
  | `markup`                      | core only: the server writes JSX in `index.tsx` and keeps it in step with later edits                                                                                                       |

  The server fills what it knows: the component by type, rule codes when a `message` is given,
  `sources` from the expression, the target from the plan. It also reads the usual slips: a
  check written on the field becomes its rule, a mask also gets its format check, `min`/`max` of
  a text are its length, a hand-written email pattern is `email`, choices written
  `value — label` are split, a rule of a field shown on a condition is checked only while shown,
  numbers of a formula are made null-safe. A name in `expr` or `when` that is not a field is
  rejected with the list of fields.

- **`form_status`** `{dir?, skip?, add?, confirm?}` — the stages, the last build, the next
  call. `skip` drops a stage the task does not need (validation is not skipped when the form has
  rules or the task names checks; behavior — when the task has a formula or a field shown on a
  condition), `add` adds one it needs, `confirm: "validation"` closes the check of the form
  against the task, `confirm: "edit"` — the check of a change.

A stage is done by the content of the intent, not by the model's word; `Done` needs a passing
build on the current files with types checked. Validation ends with a check against the task: the
answer shows the task, the fields and the rules, and names what differs — an input the task names
`(name)` with no field, a field the task calls required with no `required` rule, a field the task
shows on a condition with no visibility, a number of the task no rule uses (numbers of a formula
and list markers do not count), a bound the task does not name, a mask not in the task's format, a
default of the task without `initialValue`, labels not in the task's language — with a ready
`form_edit` call where it can be derived. The first `confirm` with differences is refused; a second
one is accepted.

---

_A `debug` tool exists only when the server runs with `REFORMER_DEBUG=true`; ignore it in normal use._
