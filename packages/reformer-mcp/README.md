# @reformer/mcp

MCP (Model Context Protocol) server for the ReFormer form library. Provides AI assistants like Claude with comprehensive context about ReFormer to help with form development.

## Features

- **Tools**: Get documentation, search, API reference, examples, error explanations
- **Resources**: Access full docs, API reference, and code examples
- **Prompts**: Pre-built templates for form creation, validation, behaviors, and debugging

## Installation

```bash
npm install -g @reformer/mcp
```

Or use directly with npx:

```bash
npx @reformer/mcp
```

## Usage with Claude Code

### Register the server

```bash
# Using npm global install
claude mcp add --transport stdio reformer -- reformer-mcp

# Or with npx
claude mcp add --transport stdio reformer -- npx @reformer/mcp
```

### Verify registration

```bash
claude mcp list
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_reformer_docs` | Get complete ReFormer documentation |
| `search_docs` | Search documentation for specific topics |
| `get_api_reference` | Get API reference for methods/types |
| `get_examples` | Get code examples by topic |
| `explain_error` | Explain and troubleshoot errors with examples |
| `get_function_signature` | Get exact TypeScript signatures for functions |
| `get_imports` | Get correct import statements by category |
| `get_pattern` | Get usage patterns for common scenarios |

## Available Resources

| URI | Description |
|-----|-------------|
| `reformer://docs` | Full documentation |
| `reformer://api` | API reference section |
| `reformer://examples` | Code examples |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `reformer-help` | Answer questions about ReFormer |
| `create-form` | Generate form schema from description |
| `manage-validation` | Add/modify/remove validation |
| `manage-behavior` | Add/modify/remove behaviors |
| `debug-form` | Debug form issues |

## Development

```bash
# Clone the repository
git clone https://github.com/AlexandrBukhtatyy/ReFormer.git
cd ReFormer/packages/reformer-mcp

# Install dependencies
npm install

# Build
npm run build

# Run locally
node dist/index.js
```

## Testing

### Using MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
npx mcp-inspector node ./dist/index.js
```

### In Claude Code

```bash
# Register local build
claude mcp add --transport stdio reformer -- node /path/to/reformer-mcp/dist/index.js

# Test by asking Claude about ReFormer
```

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Development Guide](./docs/development.md)
- [Testing Guide](./docs/testing.md)
- [API Reference](./docs/api.md)
- [Troubleshooting](./docs/troubleshooting.md)

## License

MIT
