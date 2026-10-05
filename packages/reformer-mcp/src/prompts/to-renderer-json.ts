import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const toRendererJsonPromptDefinition = {
  name: 'to-renderer-json',
  description:
    'Move a form schema from a TS builder to a JSON document of format 2 + Registry (@reformer/renderer-json): the same tree as data, parts via $part, the same createForm with `registry`; behavior and validation stay in TS. Slim+ prompt — JsonFormSchema format / registry rules live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description:
        'Текущий код схемы формы на TS (`form.schema.ts`, билдер `(model) => узел`) и сборка.',
      required: true,
    },
  ],
};

export function getToRendererJsonPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('to-renderer-json', { code: args.code });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
