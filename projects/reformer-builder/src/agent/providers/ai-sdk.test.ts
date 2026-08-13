import { describe, expect, it, vi } from 'vitest';
import type { LanguageModel } from 'ai';
import type { AiEvent, AiRequest } from './types';

/**
 * Части потока, которые отдаст подменённый `streamText`. Переменная поднята `vi.hoisted`: фабрика
 * мока исполняется до тела файла, и обычная `let` в ней ещё не существует.
 */
const stream = vi.hoisted(() => ({ parts: [] as unknown[] }));

vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return {
    ...actual,
    streamText: () => ({
      fullStream: (async function* () {
        yield* stream.parts;
      })(),
    }),
  };
});

const { streamViaAiSdk } = await import('./ai-sdk');

const REQUEST: AiRequest = {
  system: 's',
  messages: [{ role: 'user', content: 'добавь поле' }],
  tools: [],
  maxSteps: 4,
};

/** Проиграть заданный поток SDK и собрать наши события. */
async function play(parts: unknown[]): Promise<AiEvent[]> {
  stream.parts = parts;
  const events: AiEvent[] = [];
  for await (const e of streamViaAiSdk({} as LanguageModel, REQUEST)) events.push(e);
  return events;
}

describe('перевод потока AI SDK', () => {
  it('рассуждение доходит отдельным событием, а не теряется по дороге', async () => {
    // Ровно случай think-модели: `content` пуст, весь поток идёт частями reasoning.
    const events = await play([
      { type: 'reasoning-delta', id: 'r0', text: 'Сначала ' },
      { type: 'reasoning-delta', id: 'r0', text: 'посмотрю схему.' },
      { type: 'text-delta', id: 't0', text: 'Готово.' },
      { type: 'finish', finishReason: 'stop' },
    ]);

    expect(events).toEqual([
      { type: 'reasoning', text: 'Сначала ' },
      { type: 'reasoning', text: 'посмотрю схему.' },
      { type: 'delta', text: 'Готово.' },
      { type: 'done', reason: 'complete' },
    ]);
  });

  it('обрыв на пределе длины — ошибка, а не успешный ход', async () => {
    const events = await play([
      { type: 'reasoning-delta', id: 'r0', text: 'Думаю…' },
      { type: 'finish', finishReason: 'length' },
    ]);

    const error = events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ type: 'error', retryable: false });
    expect((error as { message: string }).message).toContain('пределе длины');
    // Главное: `done` не выдаёт обрыв за нормальное завершение.
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });

  it('фильтр содержимого тоже не выдаётся за успех', async () => {
    const events = await play([{ type: 'finish', finishReason: 'content-filter' }]);
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });

  it('остановка на пределе шагов не выдаётся за законченную работу', async () => {
    // 'tool-calls' в ИТОГОВОМ finish означает ровно одно: модель просила следующий инструмент, а
    // шаги кончились (`stopWhen: stepCountIs`). Раньше это считалось нормальным завершением — и в
    // живых прогонах локальной модели ход, упёршийся в предел на полпути, выглядел в панели как
    // доделанная работа: половина формы, никакого предупреждения. Набор изменений при этом цел и
    // остаётся применимым (`ChatPanel` рисует его по `pending`, независимо от статуса), поэтому
    // сообщение говорит и о применимости, и о том, что работа не закончена.
    const events = await play([{ type: 'finish', finishReason: 'tool-calls' }]);

    const error = events.find((e) => e.type === 'error');
    expect(error).toMatchObject({ type: 'error', retryable: false });
    expect((error as { message: string }).message).toContain('пределе шагов');
    expect(events.at(-1)).toEqual({ type: 'done', reason: 'error' });
  });

  it('неизвестная причина остановки не превращается в ошибку', async () => {
    // Локальные серверы часто не сообщают причину; считать это отказом — ложная тревога.
    const events = await play([{ type: 'finish', finishReason: 'unknown' }]);
    expect(events).toEqual([{ type: 'done', reason: 'complete' }]);
  });

  it('прерывание доходит как отмена', async () => {
    const events = await play([{ type: 'abort' }]);
    expect(events).toEqual([{ type: 'done', reason: 'aborted' }]);
  });
});
