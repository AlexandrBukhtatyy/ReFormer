import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const reviewPromptDefinition = {
  name: 'review',
  description:
    'Cross-package review of ReFormer code. Slim+ prompt that points the model at MCP resources for full anti-pattern lists; only critical inline rules stay in the message body.',
  arguments: [
    {
      name: 'code',
      description: 'The code to review (paste the relevant snippet).',
      required: true,
    },
  ],
};

export function getReviewPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('review', { code: args.code });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
