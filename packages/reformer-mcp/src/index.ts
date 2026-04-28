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
  getSectionBySlug,
  listSections,
  listAvailablePackages,
} from './utils/docs-parser.js';

/**
 * Resolve `<pkg-short>` (e.g. "core", "cdk") to its full package name.
 * Returns null for unknown short names or packages without llms.txt.
 */
function resolvePackage(short: string): string | null {
  if (!short) return null;
  const full = `@reformer/${short}`;
  return listAvailablePackages().includes(full as never) ? full : null;
}

function packageShortName(pkg: string): string {
  return pkg.replace(/^@reformer\//, '');
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
  planFormPromptDefinition,
  getPlanFormPrompt,
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
  discoverContextPromptDefinition,
  getDiscoverContextPrompt,
} from './prompts/index.js';

// Check debug mode
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

// Server instance
const server = new Server(
  {
    name: 'reformer-mcp',
    version: '2.0.0-beta.1',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
      sampling: {},
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
//
// URI scheme:
//   reformer://docs/<pkg-short>             — full llms.txt of one package
//   reformer://docs/<pkg-short>/<section>   — single level-2 section, by slug
//
// Section slugs come from listSections() which parses llms.txt headers and
// applies slugify(). Slugs are stable as long as section titles don't change
// upstream. Use ListResources to discover all available URIs at runtime.

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [];

  for (const pkg of listAvailablePackages()) {
    const short = packageShortName(pkg);
    resources.push({
      uri: `reformer://docs/${short}`,
      name: `${pkg} (full docs)`,
      description: `Full llms.txt for ${pkg} — every section concatenated.`,
      mimeType: 'text/markdown',
    });
    for (const section of listSections(pkg)) {
      const description = section.preview
        ? section.preview
        : `Section "${section.title}" of ${pkg}.`;
      resources.push({
        uri: `reformer://docs/${short}/${section.slug}`,
        name: `${pkg}: ${section.title}`,
        description: description.slice(0, 200),
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

  // Parse reformer://docs/<pkg-short>[/<section-slug>]
  const match = uri.match(/^reformer:\/\/docs\/([^/]+)(?:\/(.+))?$/);
  if (!match) {
    throw new Error(
      `Unknown resource: ${uri}. Expected reformer://docs/<package>[/<section-slug>].`
    );
  }
  const [, short, slug] = match;
  const pkg = resolvePackage(short);
  if (!pkg) {
    const known = listAvailablePackages()
      .map((p) => packageShortName(p))
      .join(', ');
    throw new Error(`Unknown package "${short}". Available: ${known}.`);
  }

  if (!slug) {
    return {
      contents: [{ uri, mimeType: 'text/markdown', text: getFullDocs(pkg) }],
    };
  }

  const text = getSectionBySlug(pkg, slug);
  if (text === null) {
    const available = listSections(pkg)
      .map((s) => s.slug)
      .join(', ');
    throw new Error(`Unknown section "${slug}" in ${pkg}. Available: ${available}.`);
  }
  return {
    contents: [{ uri, mimeType: 'text/markdown', text }],
  };
});

// ==================== PROMPTS ====================

type AnyPromptDefinition =
  | typeof reviewPromptDefinition
  | typeof debugPromptDefinition
  | typeof planFormPromptDefinition
  | typeof createFormPromptDefinition
  | typeof addValidationPromptDefinition
  | typeof addBehaviorPromptDefinition
  | typeof addFormArrayPromptDefinition
  | typeof addWizardPromptDefinition
  | typeof toRendererPromptDefinition
  | typeof toRendererJsonPromptDefinition
  | typeof discoverContextPromptDefinition;

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts: AnyPromptDefinition[] = [
    discoverContextPromptDefinition,
    reviewPromptDefinition,
    planFormPromptDefinition,
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
      return await getDebugPrompt(args as { code: string });

    case 'review':
      return await getReviewPrompt(args as { code: string });

    case 'plan-form':
      return await getPlanFormPrompt(
        args as { specPath: string; target?: string; projectPath?: string },
        server
      );

    case 'create-form':
      return await getCreateFormPrompt(
        args as { description: string; target?: string; projectPath?: string },
        server
      );

    case 'discover-context':
      return await getDiscoverContextPrompt(
        args as { description: string; projectPath?: string },
        server
      );

    case 'add-validation':
      return await getAddValidationPrompt(args as { code: string; requirements: string });

    case 'add-behavior':
      return await getAddBehaviorPrompt(args as { code: string; requirements: string });

    case 'add-form-array':
      return await getAddFormArrayPrompt(args as { code: string; requirements: string });

    case 'add-wizard':
      return await getAddWizardPrompt(args as { code: string; steps: string });

    case 'to-renderer':
      return await getToRendererPrompt(args as { code: string });

    case 'to-renderer-json':
      return await getToRendererJsonPrompt(args as { code: string });

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
