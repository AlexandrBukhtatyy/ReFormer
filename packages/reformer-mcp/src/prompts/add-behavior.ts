import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addBehaviorPromptDefinition = {
  name: 'add-behavior',
  description:
    'Add behavior to an existing @reformer form — the ONE behavior of the form: links over the model (compute, enableWhen, copyFrom, syncFields, revalidateWhen, resetWhen, transformValue) and rules for schema nodes (hideWhen by selector) in one defineFormBehavior. Slim+ prompt — full cycle-prevention checklist and behavior recipes live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description:
        'Текущий код формы (схема `form.schema.ts`, поведение `form.behavior.ts`, если оно уже есть).',
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
