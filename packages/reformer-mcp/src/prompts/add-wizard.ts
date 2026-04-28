import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addWizardPromptDefinition = {
  name: 'add-wizard',
  description:
    'Convert a single-form into a multi-step wizard via @reformer/cdk `FormWizard`. Slim+ prompt — full FormWizard compound API and step-machine recipes live in MCP resources.',
  arguments: [
    {
      name: 'code',
      description: 'Текущий код single-page формы.',
      required: true,
    },
    {
      name: 'steps',
      description:
        'Описание шагов. Пример: "Шаг 1 «Личные данные» (firstName, lastName, email); Шаг 2 «Адрес» (country, city, street); Шаг 3 «Подтверждение» (review + submit)".',
      required: true,
    },
  ],
};

export function getAddWizardPrompt(args: { code: string; steps: string }): {
  messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }>;
} {
  const text = renderPromptTemplate('add-wizard', {
    code: args.code,
    steps: args.steps,
  });
  return {
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
