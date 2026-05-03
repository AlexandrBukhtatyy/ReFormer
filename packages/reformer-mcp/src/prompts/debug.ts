import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const debugPromptDefinition = {
  name: 'debug',
  description:
    'Help debug issues with a ReFormer form. Slim+ prompt — surfaces the most-common bug shortlist inline and points the model at MCP resources for the full troubleshooting/FAQ sections.',
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
  const text = renderPromptTemplate('debug', { code: args.code });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
