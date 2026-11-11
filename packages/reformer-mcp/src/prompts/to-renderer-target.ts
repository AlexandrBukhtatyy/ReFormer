/**
 * Промпт `to-renderer` — перенос формы на рендерер, целевой стек выбирается аргументом.
 *
 * С 7.0 перенос — это `target` в `form.intent.json` и пересборка `form_build`: контракт формы один на
 * все стеки, а модуль пишет сборка. Прежние шаблоны учили переписывать модуль руками (аудит
 * 2026-11, A1). Шаблон один на оба рендерера, различаются подписи.
 */

import { renderPromptTemplate } from '../utils/prompt-template-loader.js';
import { TARGET_NOTE, targetLabelFor } from './create-form.js';

export const toRendererPromptDefinition = {
  name: 'to-renderer',
  description:
    'Switch a form built with form_build to a renderer — FormRenderer over the TS schema (renderer-react) or the schema as a JSON document + registry (renderer-json) — by changing "target" in form.intent.json and building again.',
  arguments: [
    {
      name: 'code',
      description:
        'The current form.intent.json (optional: otherwise read it from the form folder).',
      required: false,
    },
    {
      name: 'target',
      description: 'renderer-react (default) | renderer-json',
      required: false,
    },
  ],
};

export async function getToRendererPrompt(args: {
  code?: string;
  target?: string;
}): Promise<{ messages: Array<{ role: 'user'; content: { type: 'text'; text: string } }> }> {
  const given = String(args.code ?? '').trim();
  const target = args.target === 'renderer-json' ? 'renderer-json' : 'renderer-react';
  const code = given
    ? `\`\`\`json\n${given}\n\`\`\``
    : 'Not given: read `<dir>/form.intent.json` yourself.';
  return message(
    renderPromptTemplate('to-renderer', {
      code,
      target,
      targetLabel: targetLabelFor(target),
      targetNote: TARGET_NOTE[target],
    })
  );
}

function message(text: string) {
  return { messages: [{ role: 'user' as const, content: { type: 'text' as const, text } }] };
}
