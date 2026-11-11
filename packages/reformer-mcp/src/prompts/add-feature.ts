/**
 * Промпт `add-feature` — одна дверь к четырём стадиям доработки формы.
 *
 * Схлопывает `add-validation`, `add-behavior`, `add-form-array` и `add-wizard`: у них одна форма
 * аргументов (форма + текстовые требования), и четыре записи в `prompts/list` стоили ~570 токенов
 * у каждого клиента при подключении.
 *
 * С 7.0 стадия — это правка `form.intent.json` и пересборка `form_build`; шаблоны называют нужную
 * секцию грамматики. Прежние шаблоны учили писать модуль руками (аудит 2026-11, A1/A2). Текущую
 * форму агент читает сам, поэтому `code` необязателен.
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
    'Add one capability to a form built with form_build — validation rules, behavior, an array of rows or wizard steps — by editing form.intent.json and building again. Pick the stage with `feature`.',
  arguments: [
    {
      name: 'feature',
      description: 'validation | behavior | array | wizard',
      required: true,
    },
    {
      name: 'requirements',
      description: 'What to add. For `feature: wizard` — the steps and the fields of each.',
      required: true,
    },
    {
      name: 'code',
      description:
        'The current form.intent.json (optional: otherwise read it from the form folder).',
      required: false,
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
      `❌ **add-feature: unknown stage \`${args.feature ?? '(missing)'}\`**\n\n` +
        `Valid values of \`feature\`: ${Object.keys(FEATURES).join(', ')}.`
    );
  }

  const given = String(args.code ?? '').trim();
  const requirements = String(args.requirements ?? args.steps ?? '').trim();
  if (!requirements) {
    return message(
      `❌ **add-feature (${feature}): \`requirements\` is missing** — what should be added.`
    );
  }
  const code = given
    ? `\`\`\`json\n${given}\n\`\`\``
    : 'Not given: read `<dir>/form.intent.json` yourself.';

  // Шаблон wizard ждёт переменную `steps`, остальные — `requirements`. Передаём под тем
  // именем, которое шаблон объявляет, а не переименовываем шаблоны: они read-only по гейту.
  const vars = { code, [spec.requirementArg]: requirements } as Record<string, unknown>;
  return message(renderPromptTemplate(spec.template, vars));
}

function message(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}
