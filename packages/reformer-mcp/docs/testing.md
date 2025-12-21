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

# Run with debug mode enabled
REFORMER_DEBUG=true npx mcp-inspector node ./dist/index.js
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
- "How do I use ArrayNode?"

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

#### report_issue
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "report_issue",
    "arguments": {
      "error": "Form recreates on every render",
      "solution": "Wrap createForm in useMemo",
      "tags": ["category:react", "agent:claude"],
      "context": {
        "examples": [
          { "description": "Correct usage", "code": "const form = useMemo(() => createForm(...), []);" }
        ]
      }
    }
  }
}
```
Expected: Confirmation message with file path

#### debug (Debug Mode Only)
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "debug",
    "arguments": {}
  }
}
```
Expected: Debug information (only works with REFORMER_DEBUG=true)

### Resources

#### List resources
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "resources/list"
}
```
Expected: List of 4 resources (docs, api, examples, troubleshooting)

#### Read resource
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/read",
  "params": { "uri": "reformer://docs" }
}
```
Expected: Documentation content

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "resources/read",
  "params": { "uri": "reformer://troubleshooting" }
}
```
Expected: Troubleshooting content

### Prompts

#### List prompts
```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "prompts/list"
}
```
Expected: Empty list (or 1 prompt in debug mode)

#### Get debug prompt (Debug Mode Only)
```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "prompts/get",
  "params": {
    "name": "debug",
    "arguments": { "code": "const form = createForm<T>({...})" }
  }
}
```
Expected: Prompt with documentation context (only works with REFORMER_DEBUG=true)

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

### Debug features not available
- Ensure `REFORMER_DEBUG=true` is set
- Re-register server with environment variable:
  ```bash
  claude mcp add --transport stdio reformer -e REFORMER_DEBUG=true -- node ./dist/index.js
  ```

### Documentation not found
- Ensure @reformer/core is installed or
- Run from the ReFormer monorepo root
