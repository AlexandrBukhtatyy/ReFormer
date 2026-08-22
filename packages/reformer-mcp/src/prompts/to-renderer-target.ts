/**
 * Промпт `to-renderer` — перенос формы на рендерер, целевой стек выбирается аргументом.
 *
 * Схлопывает `to-renderer` и `to-renderer-json`: у них одинаковый вход (`code`) и одна задача,
 * различается только целевой пакет. Две записи в `prompts/list` за это различие платить не
 * обязаны. Содержимое обоих шаблонов сохранено без изменений.
 */

import { renderPromptTemplate } from '../utils/prompt-template-loader.js';

const TEMPLATES = {
  'renderer-react': 'to-renderer',
  'renderer-json': 'to-renderer-json',
} as const;

export const toRendererPromptDefinition = {
  name: 'to-renderer',
  description:
    'Move an existing @reformer/core form onto a renderer: RenderSchema (renderer-react) or the JSON DSL (renderer-json).',
  arguments: [
    { name: 'code', description: 'Текущий код формы.', required: true },
    {
      name: 'target',
      description: 'renderer-react (по умолчанию) | renderer-json',
      required: false,
    },
  ],
};

export async function getToRendererPrompt(args: {
  code?: string;
  target?: string;
}): Promise<{ messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> }> {
  const code = String(args.code ?? '').trim();
  if (!code) {
    return message(
      '❌ **to-renderer: не передан `code`** — нужен текущий код формы, который переносим.'
    );
  }
  const target = args.target === 'renderer-json' ? 'renderer-json' : 'renderer-react';
  return message(renderPromptTemplate(TEMPLATES[target], { code }));
}

function message(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}
