---
sidebar_position: 1
---

# Overview

The ReFormer MCP server is a service for AI assistants (Claude Code, Cursor, another MCP client):
through it an assistant creates and changes forms built on `@reformer/*`. The service plans the
work, builds the form module, checks the types and answers API questions, and the assistant does not
need to read the library sources.

The service is closed and paid. The open [`@reformer/mcp`](#packages) client (MIT) connects it to
your IDE: the reference, the tools and the form build run in the service, and everything that
concerns your files stays on your machine.

A form follows the unified contract: model → one schema → one `createForm` bundle → rules →
behavior → wizard (step flow) → rendering. The tool set (`REFORMER_SURFACE=tools`) adds the package
documentation as **resources**, reference **tools** (API selection, a JSDoc index of public symbols,
recipes, code checking) and workflow **prompts**.

## Access

The service is in early access: the `REFORMER_API_KEY` key is issued on request. Write to us — the
contacts (Telegram, email) are in the site footer.

For teams that cannot send form code and specs to an external service, the service is deployed on
your own infrastructure under a license, by agreement. The client points to it with the
`REFORMER_SERVICE_URL` variable.

## Why MCP — in numbers

The same agent with the server builds and edits forms more reliably, faster and cheaper than from
the package documentation alone. Over 180 Claude Sonnet runs, with the `code-guided-dsl` surface —
now the default — 96% of runs passed every check against 83% without MCP, the work went 3.5 times
faster and cost 4.4 times less. The summary infographic and the results per scenario are on the
[Measurements: with MCP and without](./benchmark) page.

## What is MCP?

[Model Context Protocol](https://modelcontextprotocol.io/) is an open standard from Anthropic for
integrating AI assistants with external tools and data. An MCP server declares to the client:

- **Resources** — access to documentation and data
- **Tools** — tools the AI can call
- **Prompts** — ready-made workflow scenarios

## Connection

The client runs through `npx`, the key is passed in an environment variable. Registering it in
Claude Code:

```bash
claude mcp add --transport stdio reformer -e REFORMER_API_KEY=<your key> -- npx -y @reformer/mcp
```

The client binary is called `reformer-mcp`: after `npm install -g @reformer/mcp` you can write
`reformer-mcp` instead of `npx -y @reformer/mcp`. Check the connection with `claude mcp list`. Setup
for other IDEs (Cursor, Windsurf, Cline) is in the [Quick Start](./quick-start).

| Variable               | What it sets                                                                                             |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `REFORMER_API_KEY`     | the service key; without it the cloud service does not answer, and the client says so right away         |
| `REFORMER_SERVICE_URL` | the service address without a path — for a service deployed on your side; the cloud one by default       |
| `REFORMER_SURFACE`     | what the server gives the assistant: `code-guided-dsl` (default), `tools`, … — see [surfaces](#surfaces) |
| `REFORMER_TRACE_FILE`  | a call log to a file (JSON Lines)                                                                        |

## What stays with you and what goes to the service

On your machine the client:

- reads and writes the form directory;
- type-checks with your project's compiler and your package versions;
- reads the form spec;
- saves `report_issue` reports to `.reformer/issue_reports`.

With each call the client sends the service only what that call needs: the files of the form
directory, the spec, the type-check result and the component catalog of `@reformer/ui-kit` if it is
installed. The service returns writes as operations — the client writes them to disk. MCP does not
work without a network connection and a key.

## Surfaces

The `REFORMER_SURFACE` environment variable picks what the server gives the assistant:

| Surface                         | What the assistant sees                                                         | When to use                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `code-guided-dsl` (default)     | two tools, `search` and `execute`; both take JavaScript                         | create or change a form                                                                          |
| `tools`                         | the [tool set](#tools), the [prompts](#prompts) and the [resources](#resources) | API reference for your own code, checking code with `validate_form`, your own `form.intent.json` |
| `code`, `guided`, `code-guided` | experiments: Code Mode (one `run_script`) and profiles for small models         | measurements                                                                                     |

### Default: search and execute

The server leads the work. The assistant starts it in `execute` with a `reformer.formStart` call
carrying the task text or a spec, then changes the form with the builder: method chains record
edits, `save()` sends them, and the server builds the module. Every file of the form folder — from
the server's response — is written by the client, the JSX markup of `@reformer/core` too.

```js
// execute — edits with the builder
const f = reformer.form();
f.add('email', 'Email').required().email();
f.add('company', 'Company')
  .required()
  .showWhen((m) => m.customerType === 'company');
console.log(await f.save());
```

Every answer ends with a `Next:` line with ready code for `execute` — until an answer says `Done`.
`search` only reads: the current form, the task and the parsed spec, the builder methods, the plan.
Details are in [Tools](./tools#default-search-and-execute).

### The tool set

```bash
claude mcp add --transport stdio reformer -e REFORMER_API_KEY=<your key> -e REFORMER_SURFACE=tools -- npx -y @reformer/mcp
```

Use the tool set when the assistant writes its own code next to a form and needs API reference,
when your tooling writes `form.intent.json` itself and calls `form_build`, or when the client works
through prompts.

## Tools

The server gives this set with `REFORMER_SURFACE=tools`.

| Tool              | Role                                                                                                                                                |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_context`     | Assembled context for one step of building a form: operator, signature, example, rules and anti-patterns within a token budget.                     |
| `choose_api`      | Pick an operator for a requirement stated in your own words ("field B is available only when A is filled") — with an example and common confusions. |
| `get_symbol_docs` | Full JSDoc of a public symbol from any `@reformer/*` package: signature, parameters, all `@example`s, source.                                       |
| `find_recipe`     | A recipe by scenario keyword (`wizard`, `form-array`, `json-schema`) or a symbol's `@example`.                                                      |
| `search_docs`     | Full-text search across the documentation of all packages, for when you can describe the task but cannot name it.                                   |
| `list_symbols`    | Public symbols by kind, package or part of the name.                                                                                                |
| `plan_form`       | A draft `<dir>/form.intent.json` from a markdown form spec: fields, rules from the spec tables, steps, arrays. Never overwrites an existing file.   |
| `form_build`      | A form module on disk from a single `form.intent.json`: compiling, type-checking and writing the files; the agent edits only the intent.            |
| `validate_form`   | Pre-run checking: code (`kind: "code"`), JSON schema, behavior cycles, the whole bundle and the module's file names (`kind: "layout"`).             |
| `report_issue`    | Save a problem you found and its solution as a separate JSON report in `<project root>/.reformer/issue_reports`.                                    |

A form is created along one path: the grammar `form_build {"grammar":"base"}` → your own
`<dir>/form.intent.json` (or a `plan_form` draft from a spec) → `form_build {"dir": …}`. The former
`generate_form` and the aliases `validate_json_schema` and `check_behaviors` were removed in 7.0.

The [builder AI assistant](/docs/builder/assistant) uses the same service with the same key: it takes
the reference and the form build from a description from the service and edits the form in the
editor. Each tool is described in detail in [Tools](./tools).

## Packages

| Package                 | License | What for                                                                                                                                                |
| ----------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@reformer/mcp`         | MIT     | the service client for IDEs, the `reformer-mcp` binary: form files, type-checking, the spec and reports stay local, everything else runs in the service |
| `@reformer/form-intent` | MIT     | the `FormIntent` contract for your own tools: types, normalization, printing validation and behavior rules to code, layout document types, `findCycle`  |

The `FormIntent` compiler (parsing the model's answer, the `form_build` verdict, building the module)
is part of the service and is not published as a separate package.

## Prompts

Only in the `REFORMER_SURFACE=tools` set: every prompt leads through `form_build`.

- `start-here` — the entry point: the canonical workflow of the unified contract and a map of which
  prompt, tool or resource to use at each step.
- `add-feature` — add one capability to a form built with `form_build`: `feature` = `validation` |
  `behavior` | `array` | `wizard`.
- `to-renderer` — switch the rendering approach: `FormRenderer` over the same TS schema
  (`renderer-react`) or the schema as a format 2 JSON document + a registry (`renderer-json`); the
  model, rules, behavior and the `createForm` call stay the same.
- `review` — a cross-package code review checklist.

Prompts do not reach every client: some agents have no access to `prompts/list`. That is why the same
content is also available in the tools (`get_context`, `plan_form`, `form_build` with `grammar`) and
in the `reformer://guide` resource. Parsing a spec and creating a form from a description are done
by the `plan_form` and `form_build` tools, or by `reformer.formStart` in the default surface.

## Resources

Only in the `REFORMER_SURFACE=tools` set.

- `reformer://guide` — the server's self-documentation: the workflow, the form file layout, which
  tool and resource to use at each step.
- `reformer://catalog` — a JSON map of packages and their sections (slug + title) — where to get
  section URIs from.
- `reformer://status` — what the client found in the project: the `@reformer/*` packages, whether
  type-checking is available. Read it when a tool reports an environment problem.
- `reformer://docs/<pkg>` — the full documentation of one package, for example `reformer://docs/cdk`.
  `<pkg>` is the name without the `@reformer/` prefix: `core`, `cdk`, `ui-kit`, `renderer-react`,
  `renderer-json`, …
- `reformer://docs/<pkg>/<section>` — a single section by its slug (the list is in
  `reformer://catalog`).

> The resources contain no list of symbols or signatures — use `list_symbols` / `get_symbol_docs`;
> for scenario recipes use `find_recipe`, for keyword search use `search_docs`.

## Next

- [Quick Start](./quick-start) — the key and IDE setup in 2 minutes.
- [Tools](./tools) — each tool in detail.
- [Prompts](./prompts) — workflow scenarios.
- [Examples](./examples) — usage scenarios.
