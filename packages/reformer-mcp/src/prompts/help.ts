import { getFullDocs } from '../utils/docs-parser.js';

export const helpPromptDefinition = {
  name: 'reformer-help',
  description:
    'Get help with ReFormer library. Provides comprehensive context about ReFormer to answer questions about forms, validation, behaviors, and React integration.',
  arguments: [
    {
      name: 'question',
      description: 'Your question about ReFormer',
      required: true,
    },
  ],
};

export function getHelpPrompt(args: { question: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const { question } = args;
  const docs = getFullDocs();

  return {
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `You are an expert on ReFormer, a signals-based reactive form state management library for React.

Here is the complete ReFormer documentation:

${docs}

---

Please answer the following question about ReFormer:

${question}

Provide a clear, helpful answer with code examples where appropriate. Use the documentation above as your primary reference.`,
        },
      },
    ],
  };
}
