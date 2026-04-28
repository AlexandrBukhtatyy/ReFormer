import { getSection } from '../utils/docs-parser.js';
import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

export const addBehaviorPromptDefinition = {
  name: 'add-behavior',
  description:
    'Подобрать и встроить behavior (computeFrom, enableWhen, watchField, copyFrom, syncFields, revalidateWhen, resetWhen, transformValue) к существующей форме @reformer/core. Подгружает все behavior-рецепты + cycle-detection.',
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
    computeVsWatch: getSection('Compute', '@reformer/core'),
    watchField: getSection('Async', '@reformer/core'),
    cycleDetection: getSection('Cycle', '@reformer/core'),
    copyFrom: getSection('copyFrom', '@reformer/core'),
    syncFields: getSection('syncFields', '@reformer/core'),
    resetWhen: getSection('resetWhen', '@reformer/core'),
    transformValue: getSection('transformValue', '@reformer/core'),
    revalidateWhen: getSection('revalidateWhen', '@reformer/core'),
    commonPatterns: getSection('Common Patterns', '@reformer/core'),
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
