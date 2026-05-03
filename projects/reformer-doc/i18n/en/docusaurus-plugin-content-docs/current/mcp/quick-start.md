---
sidebar_position: 2
---

# Quick Start

Setting up @reformer/mcp takes less than 2 minutes.

## Requirements

- Node.js 18 or higher
- One of the supported IDEs

## Installation

### Option 1: Global Installation

```bash
npm install -g @reformer/mcp
```

### Option 2: Via npx (no installation)

You can use it directly via npx — no installation required.

## IDE Configuration

### Claude Code

```bash
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

Verify:

```bash
claude mcp list
```

### Cursor

Create `.cursor/mcp.json` in your project root:

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

Add to settings (`Ctrl+,` → MCP):

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

Add to Cline extension settings:

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

## First Request

After setup, try asking the AI to create a form:

```
Create a registration form with email, password, and confirm password fields
```

AI will automatically use @reformer/mcp tools to generate:

- TypeScript type for the form
- Form schema with components
- Validation rules
- React component

## Verify It Works

If the MCP server is configured correctly, AI will be able to:

1. **Answer questions about ReFormer** — AI gets up-to-date documentation
2. **Generate forms** — using the `create-form` prompt
3. **Check code** — using the `check_code` tool

Try asking:

```
How do I add email validation in ReFormer?
```

## Next Steps

- [Tools](./tools) — all available tools
- [Prompts](./prompts) — templates for common tasks
- [Examples](./examples) — step-by-step scenarios
