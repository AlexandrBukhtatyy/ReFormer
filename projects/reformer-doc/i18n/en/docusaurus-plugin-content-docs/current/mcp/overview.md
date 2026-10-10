---
sidebar_position: 1
---

# Overview

`@reformer/mcp` is an MCP (Model Context Protocol) server for the `@reformer/*` library. It supplies
AI assistants (Claude Code, Cursor, other MCP clients) with per-package documentation, a JSDoc index
of public symbols, and reference form examples — right in the conversation context.

The idea is that the server alone is enough for an assistant to build a form with ReFormer: there is
no need to read the library sources. The server exposes documentation as **resources**, reference and
generating **tools** (API selection, form planning and assembly, code checking), and workflow
**prompts** following the unified form contract: model → one schema → one `createForm` bundle →
rules → behavior → wizard (step flow) → rendering.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard from Anthropic for
integrating AI assistants with external tools and data. An MCP server declares to the client:

- **Resources** — access to documentation and data
- **Tools** — tools the AI can call
- **Prompts** — ready-made workflow scenarios

## Installation / setup

```bash
# Globally
npm install -g @reformer/mcp

# Or via npx without installing
npx @reformer/mcp
```

The binary is called `reformer-mcp`. Registering it in Claude Code:

```bash
# Global install
claude mcp add --transport stdio reformer -- reformer-mcp

# Via npx
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

Check the connection with `claude mcp list`. Setup for other IDEs (Cursor, Windsurf, Cline) is in the
[Quick Start](./quick-start). Debug mode is enabled with the `REFORMER_DEBUG=true` environment
variable (it adds the `debug` tool, the `reformer://debug` resource and a prompt of the same name).

## Tools

| Tool              | Role                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_context`     | Assembled context for one step of building a form: operator, signature, example, rules and anti-patterns within a token budget.                     |
| `choose_api`      | Pick an operator for a requirement stated in your own words ("field B is available only when A is filled") — with an example and common confusions. |
| `get_symbol_docs` | Full JSDoc of a public symbol from any `@reformer/*` package: signature, parameters, all `@example`s, source.                                       |
| `find_recipe`     | A recipe by scenario keyword (`wizard`, `form-array`, `json-schema`) or a symbol's `@example`.                                                      |
| `search_docs`     | Full-text search across the documentation of all packages, for when you can describe the task but cannot name it.                                   |
| `list_symbols`    | Public symbols by kind, package or part of the name.                                                                                                |
| `plan_form`       | A form spec (markdown) or a description → `FormIntent`: fields, arrays, rules, behavior, layout.                                                    |
| `generate_form`   | `FormIntent` → a set of form files (`model.ts`, `form.schema.ts`, `form.validation.ts`, `form.behavior.ts`, …) with cross-checking.                 |
| `validate_form`   | Pre-run checking: code (`kind: "code"`), JSON schema, behavior cycles, the whole bundle and the module's file names (`kind: "layout"`).             |
| `report_issue`    | Save a problem you found and its solution as a separate JSON report in `<project root>/.reformer/issue_reports`.                                    |
| `debug`           | Only with `REFORMER_DEBUG=true` — an internal tool for developing the server itself.                                                                |

## Prompts

- `start-here` — the entry point: the canonical workflow of the unified contract and a map of which
  prompt, tool or resource to use at each step.
- `discover-context` — determine the project's target stack (`core` / `renderer-react` /
  `renderer-json`) from the form description and the project directory.
- `plan-form` — read a form spec (markdown) and return a development plan.
- `create-form` — create a form from a description (`description`, `target`).
- `add-feature` — add one capability to an existing form: `feature` = `validation` |
  `behavior` | `array` | `wizard`.
- `to-renderer` — switch the rendering approach: `FormRenderer` over the same TS schema
  (`renderer-react`) or the schema as a format 2 JSON document + a registry (`renderer-json`); the
  model, rules, behavior and the `createForm` call stay the same.
- `review` — a cross-package code review checklist.
- `debug` — only with `REFORMER_DEBUG=true`.

Prompts do not reach every client: some agents have no access to `prompts/list`. That is why the same
content is also available in the tools (`get_context`, `plan_form`, `generate_form`) and in the
`reformer://guide` resource.

## Resources

- `reformer://guide` — the server's self-documentation: the workflow, the form file layout, which
  tool and resource to use at each step.
- `reformer://catalog` — a JSON map of packages and their sections (slug + title) — where to get
  section URIs from.
- `reformer://docs/<pkg>` — the full documentation of one package, for example `reformer://docs/cdk`.
  `<pkg>` is the name without the `@reformer/` prefix: `core`, `cdk`, `ui-kit`, `renderer-react`,
  `renderer-json`, …
- `reformer://docs/<pkg>/<section>` — a single section by its slug (the list is in
  `reformer://catalog`).

> The resources contain no list of symbols or signatures — use `list_symbols` / `get_symbol_docs`;
> for scenario recipes use `find_recipe`, for keyword search use `search_docs`.

## Next

- [Quick Start](./quick-start) — installation and IDE setup in 2 minutes.
- [Tools](./tools) — each tool in detail.
- [Prompts](./prompts) — workflow scenarios.
- [Examples](./examples) — usage scenarios.
