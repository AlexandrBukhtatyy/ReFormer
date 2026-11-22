---
sidebar_position: 2
---

# Quick Start

Connecting the ReFormer MCP server takes a couple of minutes: you need a service key and one entry in
your IDE settings.

## Requirements

- Node.js 18 or higher
- One of the supported IDEs
- A ReFormer service key `REFORMER_API_KEY` — the service is in early access and keys are issued on
  request: write to us, the contacts (Telegram, email) are in the site footer

## Installation

Nothing to install: the IDE starts the `@reformer/mcp` client through `npx`. If you prefer a global
install — `npm install -g @reformer/mcp`, and then write `reformer-mcp` instead of
`npx -y @reformer/mcp`.

## IDE setup

### Claude Code

```bash
claude mcp add --transport stdio reformer -e REFORMER_API_KEY=<your key> -- npx -y @reformer/mcp
```

Check:

```bash
claude mcp list
```

### Cursor

Create a `.cursor/mcp.json` file in the project root:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["-y", "@reformer/mcp"],
      "env": { "REFORMER_API_KEY": "<your key>" }
    }
  }
}
```

Restart Cursor.

### Windsurf

Add to the settings (`Ctrl+,` → MCP):

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["-y", "@reformer/mcp"],
      "env": { "REFORMER_API_KEY": "<your key>" }
    }
  }
}
```

### Cline (VS Code)

Add to the Cline extension settings:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["-y", "@reformer/mcp"],
      "env": { "REFORMER_API_KEY": "<your key>" }
    }
  }
}
```

The key is a secret. If the settings file lives in the project repository (`.cursor/mcp.json`,
`.mcp.json`), do not commit it with the key: set `REFORMER_API_KEY` in the environment the IDE
starts from and remove it from the file.

### The tool set instead of the default

By default the server gives two tools, `search` and `execute`: the assistant builds and changes the
form following the server's plan. API reference, code checking, resources and prompts are in the tool
set ([surfaces](./overview#surfaces)). To turn it on, set an environment variable:

```bash
claude mcp add --transport stdio reformer -e REFORMER_API_KEY=<your key> -e REFORMER_SURFACE=tools -- npx -y @reformer/mcp
```

In the JSON config of Cursor, Windsurf and Cline — in the same `env` key:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["-y", "@reformer/mcp"],
      "env": { "REFORMER_API_KEY": "<your key>", "REFORMER_SURFACE": "tools" }
    }
  }
}
```

### A service deployed on your side

If the service is deployed on your infrastructure (under a license), set its address without a path
in `REFORMER_SERVICE_URL`, for example `"REFORMER_SERVICE_URL": "https://reformer.internal.example"`.
The key is the one your service accepts; if your service does not require a key, `REFORMER_API_KEY`
can be left unset.

## First request

After setup, try asking the AI to help with ReFormer:

```
Create a registration form with email, password and confirm password fields
```

The assistant starts with `execute` and a `reformer.formStart` call carrying the request text. The
server plans the work and leads through it: the assistant adds fields and rules with the builder,
and the server builds the form module — the model, the schema with components, the validation rules
and the markup — and checks the types. The client writes the form files in your project. The work is
finished when a server answer says `Done`.

## Verifying it works

If the MCP server is configured correctly, the assistant's tool list has `search` and `execute` of
the `reformer` server (in Claude Code — the `/mcp` command).

With the tool set (`REFORMER_SURFACE=tools`) the assistant also answers questions about ReFormer
from up-to-date documentation. Try asking:

```
How do I add email validation in ReFormer?
```

```
What behaviors does ReFormer have?
```

```
How do I show fields conditionally?
```

## Troubleshooting

| Symptom                                                    | What to do                                                                                                                               |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| the client prints `REFORMER_API_KEY is not set`            | the key did not reach the client process: check `env` in the IDE settings or the environment variable                                    |
| tools answer with an access error                          | the key is wrong or expired — request a new one                                                                                          |
| the service is unreachable                                 | a network connection to the service is needed; for your own service check `REFORMER_SERVICE_URL` — an address without a path (no `/mcp`) |
| the form builds, but type-checking reports the environment | open the `reformer://status` resource (tool set): which `@reformer/*` packages the client found                                          |

## Next steps

- [Overview](./overview) — surfaces, what goes to the service, packages
- [Tools](./tools) — available tools
- [Examples](./examples) — usage scenarios
