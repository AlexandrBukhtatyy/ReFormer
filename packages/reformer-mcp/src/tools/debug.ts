import { getFullDocs } from '../utils/docs-parser.js';

export const debugToolDefinition = {
  name: 'debug',
  description: 'Debug tool for MCP server development. Returns full documentation for testing.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      section: {
        type: 'string',
        description: 'Optional section to return (default: all)',
      },
    },
  },
};

export async function debugTool(args: { section?: string }): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  const docs = getFullDocs();

  return {
    content: [
      {
        type: 'text',
        text: `# Debug Info\n\nSection: ${args.section || 'all'}\n\nDocs length: ${docs.length} chars\n\n${docs.slice(0, 1000)}...`,
      },
    ],
  };
}
