---
sidebar_position: 3
---

# Tools

The MCP server provides tools the AI can call to perform tasks. There are ten by default; the
eleventh, `debug`, appears only with `REFORMER_DEBUG=true`. The embedded profile (how the server runs
inside the builder assistant) has only the reference tools and `validate_form`: `plan_form`,
`form_build` and `report_issue` write files to disk. It is convenient to group the tools by the steps
of working on a form.

| Step                    | Tools                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Figure out which API    | `choose_api` (requirement in your own words → operator), `get_context` (context for a build step)        |
| Find reference material | `get_symbol_docs`, `list_symbols`, `find_recipe`, `search_docs`                                          |
| Build the form          | `plan_form` (spec → a draft `form.intent.json`), `form_build` (`form.intent.json` → form module on disk) |
| Check                   | `validate_form`: `kind` = `code`, `json-schema`, `behaviors`, `bundle`, `layout`                         |
| Report a problem        | `report_issue`                                                                                           |

`generate_form`, which returned the form files as text, and the aliases `validate_json_schema` and
`check_behaviors` were removed in 7.0 — a call answers "Unknown tool". Use `form_build` instead of
`generate_form`, and `validate_form` with `kind: "json-schema"` or `kind: "behaviors"` instead of the
aliases.

The role of each tool is described in the [Overview](./overview#tools). Below are the details of
`form_build`, `plan_form`, `validate_form` and `report_issue`.

## form_build

Builds a form module on disk from a single file — `<dir>/form.intent.json`. The agent writes and
edits only this file; `form_build` compiles it, cross-checks it, type-checks the result and writes
all module files itself. The answer is diagnostics only.

| Parameter | Type   | Required | Description                                                                                                                                                                           |
| --------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dir`     | string | No       | the form folder inside the project, `form` by default; required at a monorepo root                                                                                                    |
| `grammar` | string | No       | return the intent grammar instead of building: `base`, a section (`behavior`, `arrays`, `wizard`, `cross`, `async`, `parts`, `operators`, `nodes`), several comma-separated, or `all` |

- **Start with the grammar:** `form_build {"grammar":"base"}` needs neither a project nor a file;
  further sections on demand. A call before `form.intent.json` exists also returns the grammar.
- **Nothing is written while errors remain.** Errors come as a list with the file and line.
- **Built files start with the marker** `// @reformer-form-build`. A file edited by hand is detached:
  the build keeps your version and says so. Delete the file to put it back under the build.
- **`types.ts` and `api.ts` are yours from day one.** On the `core` stack `index.tsx` is a stub with
  samples (a field, visibility in JSX, `bundle.submission.submit`, steps): the build keeps it in step
  with the intent until you write your JSX markup there; from then on the file is yours and the build
  type-checks it. Switching to a renderer target replaces an untouched stub and refuses to keep
  markup written by hand.
- **An unknown key of a record is an error** naming the nearest valid key (`unknown-key`). A
  component prop written next to the field (`placeholder`, `min`) is moved into `componentProps`
  with a note.
- **The verdict is the one of `validate_form` with `kind: "bundle"`.** On top of it the build
  type-checks the module (an error names the file to fix) and needs the environment:
  `@reformer/core` and `@reformer/ui-kit` installed in the project.

The module layout and the intent format are in the `06-form-directory-layout` recipe of the
`@reformer/mcp` package (the "`form.intent.json`" section); `find_recipe` returns it too.

## plan_form

Drafts `<dir>/form.intent.json` from a markdown spec: fields with types and components, rules from
the spec tables, wizard steps, arrays. The draft is written to disk; the answer is a short summary and
a list of what to finish by hand (formulas of computed fields and visibility conditions are not
extracted from the text).

| Parameter  | Type   | Required | Description                                                          |
| ---------- | ------ | -------- | -------------------------------------------------------------------- |
| `specPath` | string | Yes      | the markdown spec, absolute or relative to the working directory     |
| `dir`      | string | No       | the form folder, as in `form_build` (`form` by default)              |
| `target`   | string | No       | the stack from the task: `core` / `renderer-react` / `renderer-json` |

- **An existing `form.intent.json` is never overwritten** — a draft starts the work, it does not
  replace it.
- **No free-text description** (`description` is not supported since 7.0): from a description the
  agent writes the intent itself, by the grammar from `form_build {"grammar":"base"}`.

## validate_form

Checks a form before it runs. Returns `RF0xx` diagnostics with the line, a "what to do" hint and the
next call to make.

| `kind`        | What it checks                                                                                                             |
| ------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `code`        | The form's TypeScript: unknown or wrongly imported `@reformer` symbols, operators outside their schema, removed API        |
| `json-schema` | a renderer-json schema document                                                                                            |
| `behaviors`   | compute cycles — from a list of `{ target, reads[] }`                                                                      |
| `bundle`      | the `FormIntent` judged as `form_build` judges it: record reading, C1–C13, placement, kit components; `schema` is optional |
| `layout`      | the form module's file names against the canonical set (`form.schema.ts`, `form.behavior.ts`, `form.validation.ts`, …)     |

`kind: 'code'` finds removed API by a table of former names — the same "before → after" replacement
is described on the [Migrating from earlier APIs](/docs/reference/migration) page.

## report_issue

Submits a report about an error and its solution for feedback collection.

**Parameters:**

| Parameter  | Type     | Required | Description                           |
| ---------- | -------- | -------- | ------------------------------------- |
| `error`    | string   | Yes      | Description of the error or problem   |
| `solution` | string   | Yes      | Solution or fix                       |
| `tags`     | string[] | No       | Tags for categorization and analytics |
| `context`  | object   | No       | Additional context (see below)        |

**Structure of `context`:**

| Field                    | Type     | Description                     |
| ------------------------ | -------- | ------------------------------- |
| `examples`               | array    | Code examples with descriptions |
| `examples[].description` | string   | Example description             |
| `examples[].code`        | string   | Example code                    |
| `relatedFiles`           | string[] | Paths to related files          |
| `notes`                  | string   | Additional notes                |

**Recommended tags:**

| Format             | Example                                    | Description                                                 |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------- |
| `category:<type>`  | `category:behavior`, `category:validation` | Category: schema, validation, behavior, react, types, other |
| `agent:<name>`     | `agent:claude`, `agent:cursor`             | AI agent name                                               |
| `severity:<level>` | `severity:critical`, `severity:minor`      | Problem severity                                            |

**Returns:**

Confirmation that the report was written successfully.

**How it works:**

1. The AI encounters an error while working with ReFormer
2. The AI solves the problem
3. The AI calls `report_issue` with a description of the error and the solution
4. The report is saved locally as a separate file — `<project root>/.reformer/issue_reports/<timestamp>-<slug>.json`

The directory can be overridden with the `REFORMER_ISSUE_REPORTS_DIR` environment variable (a
relative path is resolved against the server's working directory). The project root is the nearest
`package.json` with dependencies found upward from cwd; if there is none, reports are placed directly
in cwd. The server returns the exact path in its response.

**Example of AI usage:**

```
AI found an error: "Cycle detected in computeFrom"
AI identified the cause: effect depends on the target field
AI calls report_issue:
  - error: "Infinite loop in computeFrom when effect depends on target"
  - solution: "Use peek() instead of .value to read target without dependency"
  - tags: ["category:behavior", "agent:claude", "severity:critical"]
  - context:
      examples:
        - description: "Wrong - creates a dependency"
          code: "const current = targetNode.value.value;"
        - description: "Correct - no dependency"
          code: "const current = targetNode.value.peek();"
      relatedFiles: ["packages/reformer/src/core/behavior/behaviors/compute-from.ts"]
```

**Storage format (JSON):**

One report per file, pretty-printed with indentation:

```json
{
  "timestamp": "2026-01-15T10:30:00.000Z",
  "error": "...",
  "solution": "...",
  "tags": ["category:behavior"],
  "context": { "examples": [], "notes": "..." }
}
```

The file name is made of the timestamp and a short slug of the error. If two reports land in the
same millisecond, a `-2`, `-3`, … suffix is added to the name — an existing file is never
overwritten.

## Why collect feedback?

Error reports help to:

- Identify common user problems
- Improve the documentation
- Find bugs in the library
- Understand which patterns cause difficulties

All data is stored **locally** on your computer.
