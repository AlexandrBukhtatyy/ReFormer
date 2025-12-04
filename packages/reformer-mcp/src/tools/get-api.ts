import { getApiMethod, getSection } from '../utils/docs-parser.js';

export const getApiToolDefinition = {
  name: 'get_api_reference',
  description:
    'Get API reference for ReFormer. Can retrieve the full API reference or documentation for a specific method/type.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      method: {
        type: 'string',
        description:
          'Optional: specific method or type name to look up (e.g., "createForm", "FieldNode", "useFormControl"). If not provided, returns full API reference.',
      },
    },
    required: [],
  },
};

export async function getApiTool(args: {
  method?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { method } = args;

  if (method) {
    const apiDocs = getApiMethod(method);
    return {
      content: [
        {
          type: 'text',
          text: apiDocs,
        },
      ],
    };
  }

  // Return full API reference
  const apiSection = getSection('API Reference');
  return {
    content: [
      {
        type: 'text',
        text: apiSection,
      },
    ],
  };
}
