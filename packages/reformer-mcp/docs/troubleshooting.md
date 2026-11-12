# Troubleshooting

Common problems with the ReFormer MCP server and what to do. Start with the resource
`reformer://status`: it lists the `@reformer/*` packages the server found (where, which version,
with or without an index), whether it can type-check forms, the kit catalog, the build id and what
failed to load.

## Install and register

### "reformer-mcp: command not found"

The global npm bin is not in `PATH`. Register through npx instead:

```bash
claude mcp add --transport stdio reformer -- npx -y @reformer/mcp
```

or add the output of `npm config get prefix` + `/bin` to `PATH`.

### The server does not appear in `claude mcp list`, or its tools are missing

```bash
claude mcp remove reformer
claude mcp add --transport stdio reformer -- npx -y @reformer/mcp
claude mcp get reformer
```

Restart the client after registering. Run the server by hand to see its start-up error:
`npx -y @reformer/mcp` prints `ReFormer MCP Server started` on stderr and waits on stdin.

### "Unknown tool" for `generate_form`, `validate_json_schema` or `check_behaviors`

They are removed in 7.0: a form is built by `form_build` from `form.intent.json`, checks go through
`validate_form`. See the migration section of the README.

## Documentation comes back empty

`search_docs`, `get_symbol_docs` or `find_recipe` find nothing for a package — the server did not
find that package. Read `reformer://status`: a package with `root: null` is not installed in the
project (install it), one without an index is installed without its `llms-index.json` (a broken or
very old version).

## Building a form

### `✗ form_build: the environment — nothing written.`

`form_build` type-checks the module against the project's packages: install `@reformer/core` and
`@reformer/ui-kit` in the project that holds the form folder. In a monorepo where they resolve from
elsewhere, `REFORMER_TYPECHECK_ROOT` names a fallback root.

### `⚠️ Types NOT checked: …`

The module was written, but there was nothing to check types with — no `typescript` in the project
or next to the server. This is not "no errors": install `typescript` and build again.

### `dir` is required at a monorepo root

At a root `package.json` with `workspaces` the default `form` folder would land outside every app:
pass `dir` inside an app package, e.g. `form_build {"dir":"apps/web/src/forms/order"}`.

### `✗ form_build: form.intent.json is not read in full`

Each line names a record, the problem code and the expected shape. Fix the records and build again.
The codes and what they mean: [docs/llms/08-diagnostic-codes.md](./llms/08-diagnostic-codes.md).

### A file "edited by hand" is no longer updated

A module file without the mark `// @reformer-form-build` (or `meta.description` of
`form.schema.json`) is yours: the build leaves it alone and says so. Delete it to put it back under
the build. A hand-edited file the build no longer produces (e.g. `form.schema.ts` after switching to
`renderer-json`) is reported too: carry the edits over and delete it.

## The Builder assistant (browser worker)

### `mcp:build` or `plugins:build` stops: "dist @reformer/mcp is stale"

The sources or the package docs changed after the last full build, or `dist` was rebuilt by a bare
`tsc` (`npm run dev`) without the build id. Run `npm run build -w @reformer/mcp`, then the command
again.

### The MCP panel says the worker comes from another build

The worker bundle (`npm run mcp:build`) and the Builder plugins (`npm run plugins:build`) were built
from different states of `@reformer/mcp`: a form can pass `validate_form` in the worker and fail in
`build_form`, or the other way round. Rebuild both: `npm run mcp:build && npm run plugins:build`.

## Debug mode

`REFORMER_DEBUG=true` adds the `debug` tool and prompt and the `reformer://debug` resource:

```bash
claude mcp add --transport stdio reformer -e REFORMER_DEBUG=true -- npx -y @reformer/mcp
```

## Seeing what the agent did

- `REFORMER_TRACE_FILE=<file>` writes one JSON line per call (number, sizes, a digest of the
  arguments); with `REFORMER_TRACE_FULL=1` — the full arguments and answer text.
- The MCP Inspector shows the raw surface:
  `npx @modelcontextprotocol/inspector node packages/reformer-mcp/dist/index.js`.
- Client logs: `~/Library/Logs/Claude/mcp*.log` (macOS), `%APPDATA%\Claude\logs\mcp*.log` (Windows),
  `~/.config/Claude/logs/mcp*.log` (Linux).

## Getting help

Open an issue at [GitHub](https://github.com/AlexandrBukhtatyy/ReFormer/issues) with the Node.js
version, the OS, the content of `reformer://status`, the full error and the steps to reproduce.
