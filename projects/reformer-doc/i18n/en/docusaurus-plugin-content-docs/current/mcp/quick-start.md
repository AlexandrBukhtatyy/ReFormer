---
sidebar_position: 2
---

# Quick Start

Setting up @reformer/mcp takes less than 2 minutes.

## Requirements

- Node.js 18 or higher
- One of the supported IDEs

## Installation

### Option 1: Global installation

```bash
npm install -g @reformer/mcp
```

### Option 2: Via npx (no installation)

You can use it directly via npx — no installation required.

## IDE setup

### Claude Code

```bash
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

Verify:

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
      "args": ["@reformer/mcp"]
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
      "args": ["@reformer/mcp"]
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
      "args": ["@reformer/mcp"]
    }
  }
}
```

### The tool set instead of the default

By default the server gives two tools, `search` and `execute`: the assistant builds and changes the
form by the server's plan. API reference, code checking, resources and prompts are in the tool set
([surfaces](./overview#surfaces)). To turn it on, set an environment variable:

```bash
claude mcp add --transport stdio reformer -e REFORMER_SURFACE=tools -- npx @reformer/mcp
```

In the JSON config of Cursor, Windsurf and Cline — the `env` key:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "npx",
      "args": ["@reformer/mcp"],
      "env": { "REFORMER_SURFACE": "tools" }
    }
  }
}
```

## First request

After setup, try asking the AI to help with ReFormer:

```
Create a registration form with email, password and confirm password fields
```

The assistant starts with `execute` and a `reformer.formStart` call carrying the request text. The
server plans the work and leads through it: the assistant adds fields and rules with the builder,
and the server builds the form module — the model, the schema with components, the validation rules
and the markup — and checks the types. The work is finished when a server answer says `Done`.

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

## Next steps

- [Tools](./tools) — available tools
- [Examples](./examples) — usage scenarios
