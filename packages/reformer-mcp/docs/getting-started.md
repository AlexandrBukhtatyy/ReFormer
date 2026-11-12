# Getting Started with @reformer/mcp

Set up the ReFormer MCP server for Claude Code (or any MCP client) and build a first form with it.

## Prerequisites

- Node.js 18 or higher.
- An MCP client: Claude Code, Claude Desktop, an editor with MCP support.
- In the project where forms are built: `@reformer/core` and `@reformer/ui-kit` — `form_build`
  type-checks the module against them; `typescript` for that check (the server also finds the one
  next to itself).

## Install and register

```bash
# no installation: npx runs the server
claude mcp add --transport stdio reformer -- npx -y @reformer/mcp

# or install it and register the bin
npm install -g @reformer/mcp
claude mcp add --transport stdio reformer -- reformer-mcp
```

Project-level configuration, `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "reformer": { "command": "npx", "args": ["-y", "@reformer/mcp"] }
  }
}
```

Check: `claude mcp list` shows `reformer`. The resource `reformer://status` tells which
`@reformer/*` packages the server found and whether it can type-check forms.

## How a form is made

There is one path, and the server's `instructions` tell the agent about it:

1. The agent reads the grammar of the form description: `form_build {"grammar":"base"}`; more
   sections on demand (`arrays`, `wizard`, `components`, …).
2. It writes one file, `<dir>/form.intent.json`: fields, layout, validation, behavior, the target
   stack (`core`, `renderer-react`, `renderer-json`).
3. `form_build {"dir":"<dir>"}` compiles it, cross-checks it, type-checks the module and writes every
   module file itself. With errors nothing is written; the answer names each problem and the fix.
4. The agent fixes the intent and builds again until the answer starts with `✓ form_build`.

From a markdown spec, `plan_form {"specPath":"…","dir":"<dir>"}` drafts the intent first. On
`@reformer/core` the agent also writes the JSX markup in `index.tsx`; on the renderer targets the
build writes the schema too (`form.schema.ts`, or `form.schema.json` for `renderer-json`).

Ask, for example:

```
Create a registration form in src/forms/registration: email, password, password confirmation
that must match, renderer-react.
```

## Beyond building

The reference tools answer questions about the library when the agent writes its own code or meets
an unclear error: `choose_api` (which operator fits a requirement), `get_context`, `find_recipe`,
`search_docs`, `get_symbol_docs`, `list_symbols`. `validate_form` checks code, a JSON schema, an
intent or file names before running. The whole surface — [API Reference](./api.md).

## Next steps

- [API Reference](./api.md) — tools, resources, prompts, entry points, environment variables.
- [Troubleshooting](./troubleshooting.md) — when something does not work.
- [Testing Guide](./testing.md) and [Development Guide](./development.md) — working on the server.
