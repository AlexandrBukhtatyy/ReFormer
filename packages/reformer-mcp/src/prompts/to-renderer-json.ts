import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const toRendererJsonPromptDefinition = {
  name: 'to-renderer-json',
  description:
    'Migrate TS RenderSchema (@reformer/renderer-react) into JSON schema + Registry for @reformer/renderer-json. Slim+ prompt — migration cookbook / JsonFormSchema format / registry rules live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код TS RenderSchema (RenderSchemaFn) и/или Form.',
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
