import { getSection } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addWizardPromptDefinition = {
  name: 'add-wizard',
  description:
    'Превратить single-form в multi-step через FormWizard из @reformer/cdk. Подгружает multi-step стратегию из @reformer/core и FormWizard compound API + recipes.',
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
    multiStep: getSection('Multi', '@reformer/core'),
    formWizard: getSection('FormWizard', '@reformer/cdk'),
    cdkRecipes: getSection('wizard', '@reformer/cdk'),
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
