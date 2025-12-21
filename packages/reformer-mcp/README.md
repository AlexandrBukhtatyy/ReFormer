# @reformer/mcp

MCP (Model Context Protocol) server for the ReFormer form library. Provides AI assistants with ReFormer documentation and development tools.

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
| `report_issue` | Report an issue and its solution for feedback collection |

### report_issue

Allows AI assistants to report issues encountered while working with ReFormer and their solutions. Reports are stored locally in `~/.reformer/issues.jsonl` for analysis.

**Parameters:**
- `error` (required) - The error message or problem description
- `solution` (required) - The solution or fix that resolved the issue
- `tags` (optional) - Tags for categorization (e.g., `category:behavior`, `agent:claude`, `severity:critical`)
- `context` (optional) - Additional context with `examples`, `relatedFiles`, `notes`

## Available Resources

| URI | Description |
|-----|-------------|
| `reformer://docs` | Full ReFormer documentation |
| `reformer://api` | API reference |
| `reformer://examples` | Code examples |
| `reformer://troubleshooting` | Common problems and solutions |

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

## Debug Mode

For debugging the MCP server, enable debug mode with the `REFORMER_DEBUG` environment variable:

```bash
REFORMER_DEBUG=true node dist/index.js
```

This enables debug-only features:

| Type | Name | Description |
|------|------|-------------|
| Tool | `debug` | Debug tool for testing |
| Resource | `reformer://debug` | Debug information |
| Prompt | `debug` | Analyze ReFormer form code |

## Testing

### Using MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
REFORMER_DEBUG=true npx mcp-inspector node ./dist/index.js
```

### In Claude Code

```bash
# Register local build with debug mode
claude mcp add --transport stdio reformer -e REFORMER_DEBUG=true -- node /path/to/reformer-mcp/dist/index.js
```

## License

MIT
