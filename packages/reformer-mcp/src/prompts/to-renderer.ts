import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const toRendererPromptDefinition = {
  name: 'to-renderer',
  description:
    'Migrate a form from direct React rendering (@reformer/core + manual JSX) to declarative TS RenderSchema (@reformer/renderer-react). Slim+ prompt — quick-start / RenderSchema reference / cookbook live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description:
        'Текущий код формы — React-компонент с ручным рендерингом полей через useFormControl/FormField и/или сама FormSchema (createForm).',
      required: true,
    },
  ],
};

export function getToRendererPrompt(args: { code: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('to-renderer', { code: args.code });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
