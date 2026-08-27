/**
 * Замер, оплачивающий повышение `TOOL_SURFACE_BUDGET`.
 *
 * Потолок поверхности — храповик: его снижают, а поднимают только под ИЗМЕРЕННУЮ выгоду, потому
 * что поверхность уходит в запрос целиком на каждом шаге каждого хода — включая ходы, где новый
 * инструмент не нужен вовсе. Поэтому меряются обе стороны размена: польза в целевых задачах и
 * цена в нецелевых.
 *
 * Тот же обряд, что у `set_form_rules` (отчёт — `docs/mcp-eval/builder-rules.md`).
 *
 * По умолчанию НЕ запускается: нужен живой локальный канал. Запуск —
 * `EVAL_MODEL=qwen3.8:27b npx vitest run src/agent/core/render-rules-eval.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { runAgentTurn } from './loop';
import { createEditorToolRegistry } from './index';
import { emptyRules } from '../../model/rules';
import { createByokProvider } from '../providers/byok';

const MODEL = process.env.EVAL_MODEL;
const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:11434/v1';

/** Форма с секцией и полями — на ней видно и целевые задачи, и нецелевые. */
function schema(): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$html(div)',
      children: [
        {
          component: '$component(Section)',
          componentProps: { title: 'Доставка' },
          selector: 'dostavka-section',
          children: [
            {
              value: '$model(address)',
              component: '$component(Input)',
              componentProps: { label: 'Адрес' },
            },
          ],
        },
        {
          value: '$model(pickup)',
          component: '$component(Checkbox)',
          componentProps: { label: 'Самовывоз' },
        },
        {
          value: '$model(email)',
          component: '$component(Input)',
          componentProps: { label: 'Email' },
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

interface Outcome {
  tools: string[];
  ok: boolean;
}

async function ask(prompt: string): Promise<Outcome> {
  const provider = createByokProvider({
    kind: 'openai-compatible',
    baseUrl: BASE_URL,
    model: MODEL!,
    apiKey: 'ollama',
  });
  const tools: string[] = [];
  let ok = false;
  for await (const ev of runAgentTurn({
    provider,
    registry: createEditorToolRegistry(),
    base: schema(),
    baseRules: emptyRules(),
    messages: [{ role: 'user', content: prompt }],
    maxSteps: 8,
  })) {
    if (ev.type === 'tool') tools.push(ev.name);
    if (ev.type === 'done') ok = ev.reason === 'complete';
  }
  return { tools, ok };
}

describe.skipIf(!MODEL)('замер: поверхность set_render_rules', () => {
  // ── Целевые: без инструмента ход завершается «успешно», а поведения UI нет ──

  it('целевая: «скрывай доставку при самовывозе» → set_render_rules', async () => {
    const { tools } = await ask(
      'Скрывай секцию доставки, когда отмечен самовывоз. Ничего больше не меняй.'
    );
    console.info('[eval] hide-section:', tools.join(' → '));
    expect(tools).toContain('set_render_rules');
  }, 600_000);

  it('целевая: «заблокируй адрес при самовывозе» → правило, а не правка пропа', async () => {
    const { tools } = await ask(
      'Сделай поле адреса заблокированным, когда отмечен самовывоз. Ничего больше не меняй.'
    );
    console.info('[eval] dynamic-prop:', tools.join(' → '));
    // Статический disabled через set_node_prop — ровно то ложное «готово», ради которого
    // инструмент и заводится: форма выглядит изменённой, а поведения нет.
    expect(tools.some((t) => t === 'set_render_rules' || t === 'set_form_rules')).toBe(true);
  }, 600_000);

  // ── Нецелевые: плата за поверхность не должна растекаться на соседние ходы ──

  it('нецелевая: «сделай email обязательным» → правила модели, не UI', async () => {
    const { tools } = await ask('Сделай email обязательным и проверь, что это email.');
    console.info('[eval] validation:', tools.join(' → '));
    expect(tools).toContain('set_form_rules');
    expect(tools).not.toContain('set_render_rules');
  }, 600_000);

  it('нецелевая: «добавь поле телефона» → обычная правка раскладки', async () => {
    const { tools } = await ask('Добавь поле для телефона.');
    console.info('[eval] layout:', tools.join(' → '));
    expect(tools).toContain('insert_node');
    expect(tools).not.toContain('set_render_rules');
  }, 600_000);
});
