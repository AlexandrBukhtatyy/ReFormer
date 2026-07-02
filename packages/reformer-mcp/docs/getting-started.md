# Getting Started with @reformer/mcp

This guide will help you set up and use the ReFormer MCP server with Claude Code.

## Prerequisites

- Node.js 18 or higher
- Claude Code CLI installed
- (Optional) @reformer/core installed in your project

## Installation

### Global Installation (Recommended)

```bash
npm install -g @reformer/mcp
```

### Project Installation

```bash
npm install @reformer/mcp
```

## Registering with Claude Code

### Option 1: Global command

```bash
claude mcp add --transport stdio reformer -- reformer-mcp
```

### Option 2: npx (no installation required)

```bash
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

### Option 3: Project-level configuration

Add to your project's `.mcp.json`:

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

## Verifying Installation

```bash
# Check registered servers
claude mcp list

# You should see "reformer" in the list
```

## Using the Server

Once registered, Claude will automatically have access to ReFormer documentation and tools.

### Example: Ask about ReFormer

Simply ask Claude:

```
How do I create a form with validation in ReFormer?
```

Claude will use the documentation resources to provide accurate answers.

### Example: Generate a form

```
Create a user registration form with email, password, and confirm password fields
```

Claude uses the documentation to generate complete form code.

### Example: Debug an issue

```
Why is my form field not updating when I type?
```

Claude will use the documentation to help troubleshoot.

## Available Capabilities

### Tools

- `report_issue` - Report errors and solutions for feedback collection

### Resources

- `reformer://guide` - Server self-documentation
- `reformer://docs[/<pkg>[/<section>]]` - Library docs (all / one package / one section)

## Next Steps

- [Development Guide](./development.md) - Learn how to develop MCP servers
- [Testing Guide](./testing.md) - Test the MCP server
- [API Reference](./api.md) - Detailed API documentation
