import { searchDocs } from '../utils/docs-parser.js';

export const searchDocsToolDefinition = {
  name: 'search_docs',
  description:
    'Search ReFormer documentation for specific topics, methods, or concepts. Returns relevant sections containing the search query.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'The search query to find in the documentation',
      },
    },
    required: ['query'],
  },
};

export async function searchDocsTool(args: {
  query: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { query } = args;

  if (!query || query.trim().length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'Please provide a search query.',
        },
      ],
    };
  }

  const results = searchDocs(query);

  if (results.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: `No results found for "${query}". Try a different search term.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: `Found ${results.length} section(s) matching "${query}":\n\n${results.join('\n\n---\n\n')}`,
      },
    ],
  };
}
