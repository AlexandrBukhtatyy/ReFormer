/**
 * Замер хода: время запросов к модели по событиям потока и сводка хода с фазами обвязки.
 *
 * @module plugins/forms/ai/session/telemetry.test
 */

import { describe, expect, it } from 'vitest';
import { streamTurn, type StreamEnd } from '../loop/drive';
import type { AiEvent, AiProvider, AiRequest } from '../providers/types';
import { createTurnClock, formatTurn } from './telemetry';

/** Часы, которые идут, только когда их двигает тест. */
function manualClock() {
  let now = 0;
  return {
    clock: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

/** Провайдер из готовых событий: между событиями часы двигаются на заданное время. */
function scriptedProvider(
  script: readonly (AiEvent | { readonly wait: number })[],
  advance: (ms: number) => void
): AiProvider {
  return {
    id: 'scripted',
    stream: async function* () {
      for (const item of script) {
        if ('wait' in item) advance(item.wait);
        else yield item;
      }
    },
  } as unknown as AiProvider;
}

const REQUEST = { system: '', messages: [], tools: [] } as unknown as AiRequest;

async function endOf(provider: AiProvider, clock: () => number): Promise<StreamEnd> {
  let end: StreamEnd | undefined;
  for await (const event of streamTurn(provider, REQUEST, undefined, clock)) {
    if (event.type === 'end') end = event;
  }
  if (end === undefined) throw new Error('нет конца потока');
  return end;
}

describe('замер запросов к модели', () => {
  it('время запроса, до первого куска, рассуждение и токены — по событиям шага', async () => {
    const { clock, advance } = manualClock();
    const provider = scriptedProvider(
      [
        // Сервер читает контекст: отметка шага приходит с первым куском ответа.
        { wait: 4000 },
        { type: 'step_start' },
        { wait: 2000 },
        { type: 'reasoning', text: 'думаю…' },
        { wait: 4000 },
        { type: 'tool_call', id: 'c1', name: 'insert_node', args: {} },
        {
          type: 'step_usage',
          usage: {
            inputTokens: 5000,
            cachedInputTokens: 4000,
            outputTokens: 300,
            reasoningTokens: 200,
          },
        },
        { wait: 1000 },
        { type: 'step_start' },
        { type: 'delta', text: 'Готово.' },
        { type: 'step_usage', usage: { inputTokens: 5200, outputTokens: 20 } },
        { type: 'done', reason: 'complete' },
      ],
      advance
    );

    const { stats } = await endOf(provider, clock);

    expect(stats.requests).toEqual([
      {
        ms: 10000,
        firstChunkMs: 4000,
        inputTokens: 5000,
        cachedInputTokens: 4000,
        outputTokens: 300,
        reasoningTokens: 200,
        reasoningChars: 6,
      },
      { ms: 1000, firstChunkMs: 1000, inputTokens: 5200, outputTokens: 20, reasoningChars: 0 },
    ]);
    expect(stats.reasoningTokens).toBe(200);
  });

  it('запрос, оборванный остановкой попытки, тоже учтён — с пометкой', async () => {
    // Так кончается попытка создания формы: `create_form` останавливает её посреди шага.
    const { clock, advance } = manualClock();
    const provider = scriptedProvider(
      [
        { wait: 3000 },
        { type: 'step_start' },
        { type: 'tool_call', id: 'c1', name: 'create_form', args: {} },
        { wait: 500 },
        { type: 'done', reason: 'aborted' },
      ],
      advance
    );

    const { stats } = await endOf(provider, clock);

    expect(stats.steps).toBe(0);
    expect(stats.requests).toEqual([
      { ms: 3500, firstChunkMs: 3000, reasoningChars: 0, cut: true },
    ]);
  });

  it('канал без отметки начала шага: запрос меряется от начала потока', async () => {
    const { clock, advance } = manualClock();
    const provider = scriptedProvider(
      [
        { wait: 2000 },
        { type: 'delta', text: 'Ответ' },
        { type: 'step_usage', usage: {} },
        { type: 'done', reason: 'complete' },
      ],
      advance
    );

    const { stats } = await endOf(provider, clock);

    expect(stats.requests).toEqual([{ ms: 2000, firstChunkMs: 2000, reasoningChars: 0 }]);
  });
});

describe('сводка хода', () => {
  it('складывает попытки и фазы, строка называет, куда ушло время', async () => {
    const { clock, advance } = manualClock();
    const turn = createTurnClock(clock, false);

    await turn.time('create', async () => advance(800));
    const land = turn.span('land');
    advance(300);
    land();
    land();
    turn.attempt({
      steps: 1,
      inputTokens: 1600,
      cachedInputTokens: 0,
      outputTokens: 40,
      peakStepInputTokens: 1600,
      reasoningTokens: 0,
      requests: [{ ms: 20000, firstChunkMs: 5000, reasoningChars: 400, cut: true }],
    });
    turn.attempt({
      steps: 2,
      inputTokens: 10000,
      cachedInputTokens: 8000,
      outputTokens: 500,
      peakStepInputTokens: 5000,
      reasoningTokens: 300,
      requests: [
        {
          ms: 30000,
          firstChunkMs: 9000,
          inputTokens: 5000,
          outputTokens: 300,
          reasoningTokens: 300,
          reasoningChars: 0,
        },
        { ms: 10000, firstChunkMs: 1000, inputTokens: 5000, outputTokens: 200, reasoningChars: 0 },
      ],
    });
    advance(60000);

    const summary = turn.finish();

    expect(summary.requests).toHaveLength(3);
    expect(summary.modelMs).toBe(60000);
    expect(summary.phases).toEqual({
      create: { ms: 800, count: 1 },
      land: { ms: 300, count: 1 },
    });
    expect(summary.reasoningTokens).toBe(300);
    const line = formatTurn(summary);
    expect(line).toContain('запросов 3 (оборвано 1)');
    expect(line).toContain('модель 60.0 с');
    expect(line).toContain('create 0.8 с');
    expect(line).toContain('рассуждение 300 ток.');
  });
});
