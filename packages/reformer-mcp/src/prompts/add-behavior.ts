import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addBehaviorPromptDefinition = {
  name: 'add-behavior',
  description:
    'Add behaviors (computeFrom, enableWhen, watchField, copyFrom, syncFields, revalidateWhen, resetWhen, transformValue) to an existing @reformer/core form. Slim+ prompt — full cycle-prevention checklist and behavior recipes live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код формы (FormSchema, behavior callback если есть).',
      required: true,
    },
    {
      name: 'requirements',
      description:
        'Что должно происходить с формой. Пример: "при выборе страны — загружать список городов и сбрасывать city; total = price * quantity автоматически; mortgageInterest активен только если loanType === \'mortgage\'".',
      required: true,
    },
  ],
};

export function getAddBehaviorPrompt(args: { code: string; requirements: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('add-behavior', {
    code: args.code,
    requirements: args.requirements,
  });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
