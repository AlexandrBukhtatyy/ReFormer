import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const toRendererPromptDefinition = {
  name: 'to-renderer',
  description:
    'Move a form from markup written by hand in JSX to markup drawn by FormRenderer (@reformer/renderer-react) from the same schema: containers are added to the one schema tree, JSX conditions become node rules of the one behavior; model, validation and the createForm call stay. Slim+ prompt — quick-start / cookbook live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description:
        'Текущий код формы — React-компонент с ручным рендерингом полей через useFormControl/FormField и схема формы (`form.schema.ts`, сборка `createForm`).',
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
