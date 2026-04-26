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

import {
  getFullDocs,
  getExamples,
  getTroubleshooting,
  listAvailablePackages,
  KNOWN_PACKAGES,
} from './utils/docs-parser.js';
import { listSymbols } from './utils/symbols-parser.js';

/**
 * Resolve `reformer://<category>/<pkg-short>` to its full package name.
 * `<pkg-short>` is the part after `@reformer/` ("cdk", "ui-kit", etc.).
 */
function resolvePackage(short: string): string | null {
  if (!short) return null;
  const full = `@reformer/${short}`;
  return listAvailablePackages().includes(full as never) ? full : null;
}

const RESOURCE_CATEGORIES = ['docs', 'api', 'examples', 'troubleshooting'] as const;
type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

function categoryHandler(category: ResourceCategory, pkg: string | null): string {
  const target = pkg ?? '*';
  switch (category) {
    case 'docs':
      return pkg ? getFullDocs(pkg) : getFullDocs();
    case 'api':
      // List of public symbols (kind + one-line description) extracted from JSDoc.
      // For aggregated view (no pkg), concat per-package listings.
      if (pkg) return listSymbols(pkg);
      return KNOWN_PACKAGES.filter((p) => listAvailablePackages().includes(p))
        .map((p) => listSymbols(p))
        .join('\n\n---\n\n');
    case 'examples':
      return getExamples(undefined, target);
    case 'troubleshooting':
      return getTroubleshooting(target);
  }
}

function categoryDisplayName(category: ResourceCategory): string {
  switch (category) {
    case 'docs':
      return 'Documentation';
    case 'api':
      return 'Public API Index';
    case 'examples':
      return 'Examples';
    case 'troubleshooting':
      return 'Troubleshooting';
  }
}

// Tools
import {
  debugToolDefinition,
  debugTool,
  reportIssueToolDefinition,
  reportIssueTool,
  getSymbolDocsToolDefinition,
  getSymbolDocsTool,
  findRecipeToolDefinition,
  findRecipeTool,
} from './tools/index.js';

// Prompts
import {
  debugPromptDefinition,
  getDebugPrompt,
  reviewPromptDefinition,
  getReviewPrompt,
  createFormPromptDefinition,
  getCreateFormPrompt,
  addValidationPromptDefinition,
  getAddValidationPrompt,
  addBehaviorPromptDefinition,
  getAddBehaviorPrompt,
  addFormArrayPromptDefinition,
  getAddFormArrayPrompt,
  addWizardPromptDefinition,
  getAddWizardPrompt,
  toRendererPromptDefinition,
  getToRendererPrompt,
  toRendererJsonPromptDefinition,
  getToRendererJsonPrompt,
} from './prompts/index.js';

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
  const tools: Array<
    | typeof reportIssueToolDefinition
    | typeof debugToolDefinition
    | typeof getSymbolDocsToolDefinition
    | typeof findRecipeToolDefinition
  > = [reportIssueToolDefinition, getSymbolDocsToolDefinition, findRecipeToolDefinition];
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

    case 'get_symbol_docs':
      return await getSymbolDocsTool(args as { symbol: string; package?: string });

    case 'find_recipe':
      return await findRecipeTool(args as { topic: string; package?: string });

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ==================== RESOURCES ====================

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [];

  // Aggregated resources (all packages)
  for (const category of RESOURCE_CATEGORIES) {
    resources.push({
      uri: `reformer://${category}`,
      name: `ReFormer ${categoryDisplayName(category)} (all packages)`,
      description: `${categoryDisplayName(category)} aggregated across all @reformer/* packages.`,
      mimeType: 'text/markdown',
    });
  }

  // Per-package resources
  const packages = listAvailablePackages();
  for (const pkg of packages) {
    const short = pkg.replace(/^@reformer\//, '');
    for (const category of RESOURCE_CATEGORIES) {
      resources.push({
        uri: `reformer://${category}/${short}`,
        name: `${pkg} ${categoryDisplayName(category)}`,
        description: `${categoryDisplayName(category)} for ${pkg}.`,
        mimeType: 'text/markdown',
      });
    }
  }

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

  if (uri === 'reformer://debug') {
    if (!isDebugMode) {
      throw new Error(`Unknown resource: ${uri}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `# Debug Info\n\nAvailable packages: ${listAvailablePackages().join(', ')}`,
        },
      ],
    };
  }

  // Parse reformer://<category>[/<short-package>]
  const match = uri.match(/^reformer:\/\/([^/]+)(?:\/(.+))?$/);
  if (!match) {
    throw new Error(`Unknown resource: ${uri}`);
  }
  const [, category, short] = match;

  if (!RESOURCE_CATEGORIES.includes(category as ResourceCategory)) {
    throw new Error(`Unknown resource category: ${category}`);
  }

  const pkg = short ? resolvePackage(short) : null;
  if (short && !pkg) {
    throw new Error(`Unknown package: @reformer/${short}`);
  }

  const text = categoryHandler(category as ResourceCategory, pkg);
  return {
    contents: [
      {
        uri,
        mimeType: 'text/markdown',
        text,
      },
    ],
  };
});

// ==================== PROMPTS ====================

type AnyPromptDefinition =
  | typeof reviewPromptDefinition
  | typeof debugPromptDefinition
  | typeof createFormPromptDefinition
  | typeof addValidationPromptDefinition
  | typeof addBehaviorPromptDefinition
  | typeof addFormArrayPromptDefinition
  | typeof addWizardPromptDefinition
  | typeof toRendererPromptDefinition
  | typeof toRendererJsonPromptDefinition;

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts: AnyPromptDefinition[] = [
    reviewPromptDefinition,
    createFormPromptDefinition,
    addValidationPromptDefinition,
    addBehaviorPromptDefinition,
    addFormArrayPromptDefinition,
    addWizardPromptDefinition,
    toRendererPromptDefinition,
    toRendererJsonPromptDefinition,
  ];
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

    case 'review':
      return getReviewPrompt(args as { code: string });

    case 'create-form':
      return getCreateFormPrompt(args as { description: string; target?: string });

    case 'add-validation':
      return getAddValidationPrompt(args as { code: string; requirements: string });

    case 'add-behavior':
      return getAddBehaviorPrompt(args as { code: string; requirements: string });

    case 'add-form-array':
      return getAddFormArrayPrompt(args as { code: string; requirements: string });

    case 'add-wizard':
      return getAddWizardPrompt(args as { code: string; steps: string });

    case 'to-renderer':
      return getToRendererPrompt(args as { code: string });

    case 'to-renderer-json':
      return getToRendererJsonPrompt(args as { code: string });

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
