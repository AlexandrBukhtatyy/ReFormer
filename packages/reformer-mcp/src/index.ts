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

import { getFullDocs, getSection, getExamples, getTroubleshooting } from './utils/docs-parser.js';

// Tools
import {
  debugToolDefinition,
  debugTool,
  reportIssueToolDefinition,
  reportIssueTool,
} from './tools/index.js';

// Prompts
import { debugPromptDefinition, getDebugPrompt } from './prompts/index.js';

// Check debug mode
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

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
  const tools: Array<typeof reportIssueToolDefinition | typeof debugToolDefinition> = [
    reportIssueToolDefinition,
  ];
  if (isDebugMode) {
    tools.push(debugToolDefinition);
  }
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'report_issue':
      return await reportIssueTool(
        args as {
          error: string;
          solution: string;
          code?: string;
          category?: 'schema' | 'validation' | 'behavior' | 'react' | 'types' | 'other';
        }
      );

    case 'debug':
      if (!isDebugMode) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return await debugTool(args as { section?: string });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ==================== RESOURCES ====================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources = [
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
    {
      uri: 'reformer://troubleshooting',
      name: 'ReFormer Troubleshooting',
      description: 'Common problems and solutions',
      mimeType: 'text/markdown',
    },
  ];

  if (isDebugMode) {
    resources.push({
      uri: 'reformer://debug',
      name: 'Debug Info',
      description: 'Debug information for MCP server development',
      mimeType: 'text/markdown',
    });
  }

  return { resources };
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

    case 'reformer://troubleshooting':
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: getTroubleshooting(),
          },
        ],
      };

    case 'reformer://debug':
      if (!isDebugMode) {
        throw new Error(`Unknown resource: ${uri}`);
      }
      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: `# Debug Info\n\nDocs loaded: ${getFullDocs().length} chars`,
          },
        ],
      };

    default:
      throw new Error(`Unknown resource: ${uri}`);
  }
});

// ==================== PROMPTS ====================

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts = [];
  if (isDebugMode) {
    prompts.push(debugPromptDefinition);
  }
  return { prompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'debug':
      if (!isDebugMode) {
        throw new Error(`Unknown prompt: ${name}`);
      }
      return getDebugPrompt(args as { code: string });

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ==================== START SERVER ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout, which is used for MCP communication)
  console.error(`ReFormer MCP Server started${isDebugMode ? ' (DEBUG MODE)' : ''}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
