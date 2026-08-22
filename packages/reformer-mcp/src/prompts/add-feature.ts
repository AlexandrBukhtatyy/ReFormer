/**
 * Промпт `add-feature` — одна дверь к четырём стадиям доработки формы.
 *
 * Схлопывает `add-validation`, `add-behavior`, `add-form-array` и `add-wizard`. Схлопывается
 * именно эта четвёрка, потому что у них ОДНА форма аргументов (`code` + текстовые требования):
 * слияние не создаёт путаницы «какой аргумент для какой стадии». `create-form` и `plan-form`
 * остались отдельными — у них другой вход (описание/путь к спеке), и объединение сделало бы
 * схему шире, а вызов — более ошибочным.
 *
 * Содержимое шаблонов не тронуто: это самая выверенная документация в репозитории (118 KB,
 * защищена гейтом scripts/check-mcp-prompts.mjs). Схлопывается ПЕРЕЧИСЛЕНИЕ — четыре записи
 * в `prompts/list` вместо одной стоили ~570 токенов у каждого клиента при подключении.
 */

import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

/** Стадия → шаблон и имя аргумента с требованиями. */
const FEATURES = {
  validation: { template: 'add-validation', requirementArg: 'requirements' },
  behavior: { template: 'add-behavior', requirementArg: 'requirements' },
  array: { template: 'add-form-array', requirementArg: 'requirements' },
  wizard: { template: 'add-wizard', requirementArg: 'steps' },
} as const;

export type FormFeature = keyof typeof FEATURES;

export const addFeaturePromptDefinition = {
  name: 'add-feature',
  description:
    'Add one capability to an existing @reformer/core form: validation rules, reactive behaviour, a form array, or wizard steps. Pick the stage with `feature`.',
  arguments: [
    {
      name: 'feature',
      description: 'validation | behavior | array | wizard',
      required: true,
    },
    { name: 'code', description: 'Текущий код формы.', required: true },
    {
      name: 'requirements',
      description: 'Что нужно добавить. Для `feature: wizard` — перечень шагов и полей на каждом.',
      required: true,
    },
  ],
};

export async function getAddFeaturePrompt(args: {
  feature?: string;
  code?: string;
  requirements?: string;
  /** Историческое имя аргумента у wizard-стадии — принимаем оба. */
  steps?: string;
}): Promise<{ messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> }> {
  const feature = String(args.feature ?? '').trim() as FormFeature;
  const spec = FEATURES[feature];
  if (!spec) {
    return message(
      `❌ **add-feature: неизвестная стадия \`${args.feature ?? '(не передана)'}\`**\n\n` +
        `Допустимые значения \`feature\`: ${Object.keys(FEATURES).join(', ')}.`
    );
  }

  const code = String(args.code ?? '').trim();
  const requirements = String(args.requirements ?? args.steps ?? '').trim();
  if (!code || !requirements) {
    return message(
      `❌ **add-feature (${feature}): не хватает аргументов**\n\n` +
        'Нужны `code` (текущий код формы) и `requirements` (что добавить).'
    );
  }

  // Шаблон wizard ждёт переменную `steps`, остальные — `requirements`. Передаём под тем
  // именем, которое шаблон объявляет, а не переименовываем шаблоны: они read-only по гейту.
  const vars = { code, [spec.requirementArg]: requirements } as Record<string, unknown>;
  return message(renderPromptTemplate(spec.template, vars));
}

function message(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}
