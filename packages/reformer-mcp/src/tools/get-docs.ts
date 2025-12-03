import { getFullDocs } from '../utils/docs-parser.js';

export const getDocsToolDefinition = {
  name: 'get_reformer_docs',
  description:
    'Get the complete ReFormer documentation. Use this when you need comprehensive information about the ReFormer form library.',
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: [],
  },
};

export async function getDocsTool(): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const docs = getFullDocs();

  return {
    content: [
      {
        type: 'text',
        text: docs,
      },
    ],
  };
}
