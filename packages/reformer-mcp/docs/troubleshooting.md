# Troubleshooting

Common issues and solutions for the ReFormer MCP server.

## Installation Issues

### "reformer-mcp: command not found"

**Cause:** Global npm package not in PATH

**Solutions:**
1. Use npx instead:
   ```bash
   claude mcp add --transport stdio reformer -- npx @reformer/mcp
   ```

2. Check npm global bin path:
   ```bash
   npm config get prefix
   # Add the bin folder to your PATH
   ```

3. Reinstall globally:
   ```bash
   npm uninstall -g @reformer/mcp
   npm install -g @reformer/mcp
   ```

### "Cannot find module '@modelcontextprotocol/sdk'"

**Cause:** Dependencies not installed

**Solution:**
```bash
cd packages/reformer-mcp
npm install
npm run build
```

## Server Issues

### Server not starting

**Symptoms:** No response from MCP server

**Check:**
1. Node.js version (requires 18+):
   ```bash
   node --version
   ```

2. Build status:
   ```bash
   cd packages/reformer-mcp
   npm run build
   ```

3. Direct execution:
   ```bash
   node dist/index.js
   # Should show "ReFormer MCP Server started" on stderr
   ```

### "Documentation not found"

**Cause:** llms.txt file cannot be located

**Solutions:**
1. Install @reformer/core in your project:
   ```bash
   npm install @reformer/core
   ```

2. Run from monorepo root:
   ```bash
   cd /path/to/ReFormer
   node packages/reformer-mcp/dist/index.js
   ```

3. Check file exists:
   ```bash
   ls node_modules/@reformer/core/llms.txt
   # or
   ls packages/reformer/llms.txt
   ```

## Claude Code Integration

### Server not appearing in `claude mcp list`

**Cause:** Registration failed

**Solutions:**
1. Re-register with full path:
   ```bash
   claude mcp remove reformer
   claude mcp add --transport stdio reformer -- node /full/path/to/dist/index.js
   ```

2. Check registration:
   ```bash
   claude mcp list
   claude mcp get reformer
   ```

### Tools not available in Claude

**Symptoms:** Claude doesn't use ReFormer tools

**Solutions:**
1. Restart Claude Code:
   ```bash
   # Exit Claude Code (Ctrl+C)
   claude
   ```

2. Verify server is running:
   ```bash
   claude mcp list
   ```

3. Check logs for errors:
   ```powershell
   # Windows
   Get-Content ~\AppData\Roaming\Claude\logs\mcp.log -Tail 50
   ```

### "Unknown tool" or "Unknown prompt" errors

**Cause:** Version mismatch or incomplete build

**Solution:**
```bash
cd packages/reformer-mcp
npm run build
claude mcp remove reformer
claude mcp add --transport stdio reformer -- node ./dist/index.js
```

## Development Issues

### TypeScript compilation errors

**Check:**
1. TypeScript version:
   ```bash
   npx tsc --version
   ```

2. Clean and rebuild:
   ```bash
   rm -rf dist
   npm run build
   ```

### Changes not reflected

**Cause:** Using cached version

**Solution:**
1. Rebuild:
   ```bash
   npm run build
   ```

2. Remove and re-add MCP server:
   ```bash
   claude mcp remove reformer
   claude mcp add --transport stdio reformer -- node ./dist/index.js
   ```

## Logging and Debugging

### Enable verbose logging

Add to your server code:
```typescript
console.error('Debug:', JSON.stringify(data, null, 2));
```

### View MCP logs

**Windows:**
```powershell
Get-Content ~\AppData\Roaming\Claude\logs\mcp.log -Tail 100 -Wait
```

**macOS:**
```bash
tail -f ~/Library/Logs/Claude/mcp.log
```

**Linux:**
```bash
tail -f ~/.config/Claude/logs/mcp.log
```

### Test with MCP Inspector

```bash
npm install -g @modelcontextprotocol/inspector
npx mcp-inspector node ./dist/index.js
```

## Common Error Messages

### "ENOENT: no such file or directory"
- File path is incorrect
- Build was not run
- Working directory is wrong

### "SyntaxError: Cannot use import statement"
- Node.js doesn't support ESM
- Check `"type": "module"` in package.json
- Use Node.js 18+

### "TypeError: Cannot read properties of undefined"
- Tool arguments not provided
- Documentation file not found
- Invalid JSON-RPC request

## Getting Help

If you're still having issues:

1. Check [GitHub Issues](https://github.com/AlexandrBukhtatyy/ReFormer/issues)
2. Create a new issue with:
   - Node.js version
   - OS and version
   - Complete error message
   - Steps to reproduce
