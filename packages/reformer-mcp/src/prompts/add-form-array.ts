import { getSection } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addFormArrayPromptDefinition = {
  name: 'add-form-array',
  description:
    'Превратить поле в массив: array(...) в FormSchema + FormArray UI из @reformer/cdk. Подгружает рецепты array-operations, array-cleanup и FormArray compound API.',
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
    arrays: getSection('Arrays', '@reformer/core'),
    arrayOps: getSection('Array Operations', '@reformer/core'),
    arrayCleanup: getSection('Array Cleanup', '@reformer/core'),
    formArray: getSection('FormArray', '@reformer/cdk'),
    cdkRecipes: getSection('Nested', '@reformer/cdk'),
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
