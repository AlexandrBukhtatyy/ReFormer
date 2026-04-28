import { getSection, getFullDocs } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const toRendererPromptDefinition = {
  name: 'to-renderer',
  description:
    'Мигрировать форму с прямого React-рендеринга (@reformer/core + ручной JSX) на декларативный TS RenderSchema (@reformer/renderer-react). Подгружает quick-start, RenderSchema формат, behavior helpers и cookbook.',
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
  const rendererDocs = getFullDocs('@reformer/renderer-react');
  const cookbookIdx = rendererDocs.indexOf('Cookbook');
  const cookbookBlock = cookbookIdx >= 0 ? rendererDocs.slice(cookbookIdx, cookbookIdx + 4000) : '';

  const text = renderPromptTemplate('to-renderer', {
    code: args.code,
    quickStart: getSection('Quick Start', '@reformer/renderer-react'),
    renderSchema: getSection('Render Schema', '@reformer/renderer-react'),
    renderBehavior: getSection('Render Behavior', '@reformer/renderer-react'),
    cookbookBlock,
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
