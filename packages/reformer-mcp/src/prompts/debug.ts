import { getTroubleshooting, getSection } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const debugPromptDefinition = {
  name: 'debug',
  description:
    'Help debug issues with a ReFormer form. Analyzes code and provides solutions for common problems.',
  arguments: [
    {
      name: 'code',
      description: 'The form code that has issues (paste the relevant code)',
      required: true,
    },
  ],
};

export function getDebugPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('debug', {
    code: args.code,
    faq: getTroubleshooting(),
    reactIntegration: getSection('React Integration'),
    apiReference: getSection('API Reference'),
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
