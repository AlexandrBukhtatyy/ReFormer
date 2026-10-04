import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addFormArrayPromptDefinition = {
  name: 'add-form-array',
  description:
    'Add an array of sub-forms: arrayOf(blank) in the model, a schema node { model, item }, applyEach in validation and behavior, FormArray UI. Slim+ prompt — full array recipes and FormArray compound API live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код формы.',
      required: true,
    },
    {
      name: 'requirements',
      description:
        'Что должно быть массивом. Пример: "properties — массив объектов { type, address, value }; до 5 штук; первое — обязательно".',
      required: true,
    },
  ],
};

export function getAddFormArrayPrompt(args: { code: string; requirements: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('add-form-array', {
    code: args.code,
    requirements: args.requirements,
  });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
