import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addValidationPromptDefinition = {
  name: 'add-validation',
  description:
    'Add validation (built-in or custom rules, sync/async, cross-field, sub-forms via apply, arrays via applyEach) to an existing @reformer form — a standalone schema, the same for every way of drawing the form. Slim+ prompt — points the model at MCP resources for full reference; only critical inline rules are kept in the message body.',
  arguments: [
    {
      name: 'code',
      description:
        'Текущий код формы (модель, схема `form.schema.ts`, сборка `createForm` и т.п.).',
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
  });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
