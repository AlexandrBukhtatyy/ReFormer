#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getFullDocs, getSection, getExamples } from './utils/docs-parser.js';

// Tools
import {
  getDocsToolDefinition,
  getDocsTool,
  searchDocsToolDefinition,
  searchDocsTool,
  getApiToolDefinition,
  getApiTool,
  getExamplesToolDefinition,
  getExamplesTool,
  explainErrorToolDefinition,
  explainErrorTool,
} from './tools/index.js';

// Prompts
import {
  helpPromptDefinition,
  getHelpPrompt,
  createFormPromptDefinition,
  getCreateFormPrompt,
  manageValidationPromptDefinition,
  getManageValidationPrompt,
  manageBehaviorPromptDefinition,
  getManageBehaviorPrompt,
  debugFormPromptDefinition,
  getDebugFormPrompt,
} from './prompts/index.js';

// Server instance
const server = new Server(
  {
    name: 'reformer-mcp',
    version: '1.0.0-beta.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ==================== TOOLS ====================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      getDocsToolDefinition,
      searchDocsToolDefinition,
      getApiToolDefinition,
      getExamplesToolDefinition,
      explainErrorToolDefinition,
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'get_reformer_docs':
      return await getDocsTool();

    case 'search_docs':
      return await searchDocsTool(args as { query: string });

    case 'get_api_reference':
      return await getApiTool(args as { method?: string });

    case 'get_examples':
      return await getExamplesTool(args as { topic?: string });

    case 'explain_error':
      return await explainErrorTool(args as { error: string });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ==================== RESOURCES ====================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'reformer://docs',
        name: 'ReFormer Documentation',
        description: 'Complete ReFormer library documentation',
        mimeType: 'text/markdown',
      },
      {
        uri: 'reformer://api',
        name: 'ReFormer API Reference',
        description: 'API reference for ReFormer methods and types',
        mimeType: 'text/markdown',
      },
      {
        uri: 'reformer://examples',
        name: 'ReFormer Examples',
        description: 'Code examples for ReFormer usage',
        mimeType: 'text/markdown',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  switch (uri) {
    case 'reformer://docs':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: getFullDocs(),
          },
        ],
      };

    case 'reformer://api':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: getSection('API Reference'),
          },
        ],
      };

    case 'reformer://examples':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: getExamples(),
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ==================== PROMPTS ====================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      helpPromptDefinition,
      createFormPromptDefinition,
      manageValidationPromptDefinition,
      manageBehaviorPromptDefinition,
      debugFormPromptDefinition,
    ],
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'reformer-help':
      return getHelpPrompt(args as { question: string });

    case 'create-form':
      return getCreateFormPrompt(args as { description: string });

    case 'manage-validation':
      return getManageValidationPrompt(args as { task: string });

    case 'manage-behavior':
      return getManageBehaviorPrompt(args as { task: string });

    case 'debug-form':
      return getDebugFormPrompt(args as { code: string });

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ==================== START SERVER ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout, which is used for MCP communication)
  console.error('ReFormer MCP Server started');
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
