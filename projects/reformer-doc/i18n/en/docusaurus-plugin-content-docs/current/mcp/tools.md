---
sidebar_position: 3
---

# Tools

The MCP server provides tools the AI can call to perform tasks. It is convenient to group them by
the steps of working on a form.

| Step                    | Tools                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Figure out which API    | `choose_api` (requirement in your own words → operator), `get_context` (context for a build step) |
| Find reference material | `get_symbol_docs`, `list_symbols`, `find_recipe`, `search_docs`                                   |
| Build the form          | `plan_form` (spec → `FormIntent`), `generate_form` (`FormIntent` → form files)                    |
| Check                   | `validate_form`: `kind` = `code`, `json-schema`, `behaviors`, `bundle`, `layout`                  |
| Report a problem        | `report_issue`                                                                                    |

The role of each tool is described in the [Overview](./overview#tools). Below are the details of
`validate_form` and `report_issue`.

## validate_form

Checks a form before it runs. Returns `RF0xx` diagnostics with the line, a "what to do" hint and the
next call to make.

| `kind`        | What it checks                                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `code`        | The form's TypeScript: unknown or wrongly imported `@reformer` symbols, operators outside their schema, removed API    |
| `json-schema` | a renderer-json schema document                                                                                        |
| `behaviors`   | compute cycles — from a list of `{ target, reads[] }`                                                                  |
| `bundle`      | the `FormIntent` and the schema as a whole, cross-checked against each other                                           |
| `layout`      | the form module's file names against the canonical set (`form.schema.ts`, `form.behavior.ts`, `form.validation.ts`, …) |

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
