import { getTroubleshooting, getSection } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const reviewPromptDefinition = {
  name: 'review',
  description:
    'Cross-package review of ReFormer code. Pulls anti-patterns and best-practices from all @reformer/* docs (core, cdk, ui-kit, renderer-react, renderer-json) and asks the model to audit the supplied code against them.',
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
  const text = renderPromptTemplate('review', {
    code: args.code,
    faqAll: getTroubleshooting('*'),
    antiPatternsAll: getSection('Anti-patterns', '*'),
    reactIntegration: getSection('React Integration', '@reformer/core'),
  });

  return {
    messages: [
      {
        role: 'user',
        content: { type: 'text', text },
      },
    ],
  };
}
