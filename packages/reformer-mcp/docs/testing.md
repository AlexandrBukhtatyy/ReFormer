# Testing Guide

This guide covers how to test the ReFormer MCP server.

## Testing Methods

### 1. MCP Inspector (Recommended for Development)

The MCP Inspector provides a web UI for testing tools, resources, and prompts.

```bash
# Install globally
npm install -g @modelcontextprotocol/inspector

# Run with the server
npx mcp-inspector node ./dist/index.js
```

This opens a web interface where you can:
- View all registered tools, resources, and prompts
- Call tools with custom arguments
- Read resources
- Test prompts with different inputs

### 2. Claude Code Integration

Test the server directly in Claude Code:

```bash
# Build the server
cd packages/reformer-mcp
npm run build

# Register with Claude Code
claude mcp add --transport stdio reformer -- node d:/Work/ReFormer/packages/reformer-mcp/dist/index.js

# Verify registration
claude mcp list

# Start Claude Code and test
claude
```

Example test queries:
- "What is ReFormer?"
- "Show me how to create a form with validation"
- "Search for ArrayNode documentation"

### 3. Manual Testing

Run the server and send JSON-RPC messages:

```bash
# Start the server
node dist/index.js

# Send a tools/list request (in another terminal)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/index.js
```

## Test Cases

### Tools

#### get_reformer_docs
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_reformer_docs",
    "arguments": {}
  }
}
```
Expected: Full documentation text

#### search_docs
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_docs",
    "arguments": { "query": "validation" }
  }
}
```
Expected: Sections containing "validation"

#### get_api_reference
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_api_reference",
    "arguments": { "method": "createForm" }
  }
}
```
Expected: API docs for createForm

#### get_examples
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_examples",
    "arguments": { "topic": "validation" }
  }
}
```
Expected: Validation examples

#### explain_error
```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "explain_error",
    "arguments": { "error": "field not updating" }
  }
}
```
Expected: Explanation and solution

### Resources

#### List resources
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "resources/list"
}
```
Expected: List of 3 resources

#### Read resource
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "resources/read",
  "params": { "uri": "reformer://docs" }
}
```
Expected: Documentation content

### Prompts

#### List prompts
```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "prompts/list"
}
```
Expected: List of 5 prompts

#### Get prompt
```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "prompts/get",
  "params": {
    "name": "reformer-help",
    "arguments": { "question": "How do I validate an email?" }
  }
}
```
Expected: Prompt with documentation context

## Viewing Logs

### Windows
```powershell
Get-Content ~\AppData\Roaming\Claude\logs\mcp.log -Tail 50 -Wait
```

### macOS
```bash
tail -f ~/Library/Logs/Claude/mcp.log
```

### Linux
```bash
tail -f ~/.config/Claude/logs/mcp.log
```

## Troubleshooting Tests

### Server not starting
- Check Node.js version (18+)
- Verify build succeeded (`npm run build`)
- Check for TypeScript errors

### Tools not appearing
- Verify server is registered (`claude mcp list`)
- Check MCP logs for errors
- Restart Claude Code

### Documentation not found
- Ensure @reformer/core is installed or
- Run from the ReFormer monorepo root
