# Development Guide

This guide covers how to develop and extend the ReFormer MCP server.

## Project Structure

```
packages/reformer-mcp/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Server entry point
│   ├── tools/             # MCP tools
│   │   ├── index.ts
│   │   ├── get-docs.ts
│   │   ├── search-docs.ts
│   │   ├── get-api.ts
│   │   ├── get-examples.ts
│   │   └── explain-error.ts
│   ├── prompts/           # MCP prompts
│   │   ├── index.ts
│   │   ├── help.ts
│   │   ├── create-form.ts
│   │   ├── manage-validation.ts
│   │   ├── manage-behavior.ts
│   │   └── debug-form.ts
│   └── utils/
│       └── docs-parser.ts # Documentation parser
├── docs/
└── README.md
```

## Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/AlexandrBukhtatyy/ReFormer.git
cd ReFormer

# Install dependencies
npm install

# Navigate to MCP package
cd packages/reformer-mcp

# Build
npm run build

# Watch mode for development
npm run dev
```

## Understanding MCP Architecture

### Server Setup (index.ts)

The server uses `@modelcontextprotocol/sdk`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server(
  { name: 'reformer-mcp', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);
```

### Tools

Tools are functions that Claude can call:

```typescript
// Definition
const toolDefinition = {
  name: 'my_tool',
  description: 'What the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter description' }
    },
    required: ['param']
  }
};

// Handler
async function myTool(args: { param: string }) {
  return {
    content: [{ type: 'text', text: 'Result' }]
  };
}
```

### Resources

Resources are passive data sources:

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'my://resource',
      name: 'My Resource',
      description: 'Description',
      mimeType: 'text/markdown'
    }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
  contents: [{ uri: request.params.uri, text: 'Content' }]
}));
```

### Prompts

Prompts are pre-built templates:

```typescript
const promptDefinition = {
  name: 'my-prompt',
  description: 'What the prompt does',
  arguments: [
    { name: 'input', description: 'Input description', required: true }
  ]
};

function getMyPrompt(args: { input: string }) {
  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Context...\n\n${args.input}` }
    }]
  };
}
```

## Adding a New Tool

1. Create `src/tools/my-tool.ts`:

```typescript
export const myToolDefinition = {
  name: 'my_tool',
  description: 'Description',
  inputSchema: { type: 'object', properties: {}, required: [] }
};

export async function myTool() {
  return { content: [{ type: 'text', text: 'Result' }] };
}
```

2. Export from `src/tools/index.ts`
3. Register in `src/index.ts`

## Adding a New Prompt

1. Create `src/prompts/my-prompt.ts`:

```typescript
export const myPromptDefinition = {
  name: 'my-prompt',
  description: 'Description',
  arguments: []
};

export function getMyPrompt() {
  return { messages: [{ role: 'user', content: { type: 'text', text: '...' } }] };
}
```

2. Export from `src/prompts/index.ts`
3. Register in `src/index.ts`

## Debugging

### Logging

Use `console.error` for logging (stdout is reserved for MCP):

```typescript
console.error('Debug:', data);
```

### View MCP logs

```bash
# Windows
Get-Content ~\AppData\Roaming\Claude\logs\mcp.log -Tail 50 -Wait

# macOS
tail -f ~/Library/Logs/Claude/mcp.log

# Linux
tail -f ~/.config/Claude/logs/mcp.log
```

## Best Practices

1. **Use stderr for logging** - stdout is for MCP communication
2. **Validate inputs** - Always check tool arguments
3. **Handle errors gracefully** - Return helpful error messages
4. **Keep responses concise** - Large responses slow down Claude
5. **Cache when possible** - Documentation doesn't change often
