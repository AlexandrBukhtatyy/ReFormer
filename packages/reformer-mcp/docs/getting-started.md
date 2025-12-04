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

Once registered, Claude will automatically have access to ReFormer tools and knowledge.

### Example: Ask about ReFormer

Simply ask Claude:

```
How do I create a form with validation in ReFormer?
```

Claude will use the `get_reformer_docs` tool to fetch documentation and provide accurate answers.

### Example: Generate a form

```
Create a user registration form with email, password, and confirm password fields
```

Claude can use the `create-form` prompt to generate complete form code.

### Example: Debug an issue

```
Why is my form field not updating when I type?
```

Claude will use the documentation and `explain_error` tool to help troubleshoot.

## Available Capabilities

### Tools

- `get_reformer_docs` - Complete documentation
- `search_docs` - Search for specific topics
- `get_api_reference` - API details for methods
- `get_examples` - Code examples
- `explain_error` - Error explanations

### Resources

- `reformer://docs` - Full documentation
- `reformer://api` - API reference
- `reformer://examples` - Code examples

### Prompts

- `reformer-help` - General help
- `create-form` - Form generation
- `manage-validation` - Validation management
- `manage-behavior` - Behavior management
- `debug-form` - Form debugging

## Next Steps

- [Development Guide](./development.md) - Learn how to develop MCP servers
- [Testing Guide](./testing.md) - Test the MCP server
- [API Reference](./api.md) - Detailed API documentation
