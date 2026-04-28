import { getSection } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addValidationPromptDefinition = {
  name: 'add-validation',
  description:
    'Добавить валидаторы (built-in или кастомные, sync/async, cross-field) к существующей форме @reformer/core. Подгружает справочник валидаторов, async-watchfield и common-mistakes.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код формы (FormSchema, createForm и т.п.).',
      required: true,
    },
    {
      name: 'requirements',
      description:
        'Какие правила нужно навесить. Пример: "email обязателен и формат email; password ≥ 8 символов с цифрой; confirmPassword == password; уникальность email через GET /api/check-email".',
      required: true,
    },
  ],
};

export function getAddValidationPrompt(args: { code: string; requirements: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('add-validation', {
    code: args.code,
    requirements: args.requirements,
    validators: getSection('Validation', '@reformer/core'),
    apiSignatures: getSection('API SIGNATURES', '@reformer/core'),
    asyncWatch: getSection('Async', '@reformer/core'),
    commonMistakes: getSection('Common Mistakes', '@reformer/core'),
    crossField: getSection('Cross', '@reformer/core'),
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
