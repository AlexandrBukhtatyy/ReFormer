/**
 * Справка по библиотеке как инструмент: что он просит у справки и что отдаёт модели.
 *
 * Справка ПОДСТАВЛЯЕТСЯ параметром — тем же путём, каким её подставляет плагин стека, —
 * поддельной службой контракта (`../reference`). Каскад MCP и приписка об источнике — забота
 * встроенной справки и проверяются у неё (`../knowledge/mcp-reference.test.ts`).
 *
 * @module plugins/reformer/ai/tools/reformer-docs.test
 */

import { describe, expect, it } from 'vitest';
import type { LibraryReferenceService } from '../reference';
import { TOOL_TEXT_BUDGET } from '../model/types';
import { createReformerDocsTool } from './reformer-docs';

/** Справка, которая запоминает запрос и отвечает заданным текстом. */
function fakeReference(text: string | null) {
  const requests: Array<{ question: string; maxChars: number; signal?: AbortSignal }> = [];
  const reference: LibraryReferenceService = {
    ask(question, request) {
      requests.push({ question, ...request });
      return Promise.resolve(text === null ? null : { text });
    },
  };
  return { reference, requests };
}

describe('ask_reformer', () => {
  it('просит у справки весь бюджет ответа и отдаёт её текст как есть', async () => {
    const { reference, requests } = fakeReference('Используйте `computeFrom`.');
    const tool = createReformerDocsTool(() => reference);

    const res = await tool.run({ question: 'как объявить вычисляемое поле' }, {} as never);

    expect(res.ok).toBe(true);
    expect(res.text).toBe('Используйте `computeFrom`.');
    expect(requests).toEqual([
      { question: 'как объявить вычисляемое поле', maxChars: TOOL_TEXT_BUDGET },
    ]);
  });

  it('передаёт справке сигнал остановки хода', async () => {
    // Удалённой справке незачем дожидаться ответа на вопрос остановленного хода.
    const { reference, requests } = fakeReference('ответ');
    const controller = new AbortController();
    const ctx = { turn: { signal: controller.signal } } as never;

    await createReformerDocsTool(() => reference).run({ question: 'что угодно' }, ctx);

    expect(requests[0]?.signal).toBe(controller.signal);
  });

  it('справка без ответа — инструмент говорит, что её нет, а не молчит', async () => {
    // Молчание агент прочитал бы как «библиотека такого не умеет» и пошёл выдумывать API.
    const { reference } = fakeReference(null);
    const res = await createReformerDocsTool(() => reference).run(
      { question: 'что угодно' },
      {} as never
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('unavailable');
  });

  it('справки нет вовсе — тот же ответ', async () => {
    const res = await createReformerDocsTool(() => undefined).run(
      { question: 'что угодно' },
      {} as never
    );
    expect(res.ok).toBe(true);
    expect(res.text).toContain('unavailable');
  });

  it('умолчание — справки нет: инструмент остаётся в наборе и не падает', async () => {
    // Состав набора не должен зависеть от того, собрана ли справка: иначе поверхность инструментов
    // менялась бы от состояния сборки, а храповик мерил бы разное в разных запусках.
    const res = await createReformerDocsTool().run({ question: 'что угодно' }, {} as never);
    expect(res.ok).toBe(true);
    expect(res.text).toContain('unavailable');
  });
});
