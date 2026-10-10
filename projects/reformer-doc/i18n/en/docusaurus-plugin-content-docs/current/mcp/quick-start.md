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

## First request

After setup, try asking the AI to help with ReFormer:

```
Create a registration form with email, password and confirm password fields
```

The AI will automatically get the ReFormer documentation through the MCP server and help with:

- The form's TypeScript types
- The form schema with components
- Validation rules
- A React component

## Verifying it works

If the MCP server is configured correctly, the AI will be able to answer questions about ReFormer
using up-to-date documentation.

Try asking:

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
