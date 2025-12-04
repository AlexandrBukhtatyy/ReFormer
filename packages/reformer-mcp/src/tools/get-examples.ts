import { getExamples } from '../utils/docs-parser.js';

export const getExamplesToolDefinition = {
  name: 'get_examples',
  description:
    'Get code examples from ReFormer documentation. Can retrieve examples for specific topics like validation, behaviors, arrays, or forms.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        description:
          'Optional: topic to get examples for. Supported topics: "validation", "behavior", "array", "form", "react", "hooks". If not provided, returns general examples.',
      },
    },
    required: [],
  },
};

export async function getExamplesTool(args: {
  topic?: string;
}): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const { topic } = args;

  const examples = getExamples(topic);

  const header = topic ? `Examples for "${topic}":\n\n` : 'ReFormer code examples:\n\n';

  return {
    content: [
      {
        type: 'text',
        text: header + examples,
      },
    ],
  };
}
