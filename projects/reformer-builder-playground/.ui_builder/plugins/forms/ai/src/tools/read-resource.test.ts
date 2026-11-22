import { describe, expect, it } from 'vitest';
import { readResourceTool } from './read-resource';
import type {
  FormResourceReadResult as ResourceReadResult,
  FormToolContext as ToolContext,
  FormTurnScope as TurnScope,
} from '@reformer/builder-plugin-api';

/** Контекст с ходом, который читает ресурс ответом `result`. */
function ctxReading(result: ResourceReadResult): ToolContext {
  const turn: TurnScope = {
    signal: new AbortController().signal,
    write: () => Promise.reject(new Error('не нужно')),
    readResource: () => Promise.resolve(result),
  };
  return { turn } as unknown as ToolContext;
}

const lines = (count: number): string =>
  Array.from({ length: count }, (_, i) => `line ${String(i + 1)} ${'x'.repeat(60)}`).join('\n');

describe('read_resource', () => {
  it('отдаёт страницу с заголовком и номерами строк', async () => {
    const outcome = await readResourceTool.run(
      { uri: 'source:readme.md' },
      ctxReading({ ok: true, text: '# hi\ntext', mediaType: 'text/markdown' })
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.text).toContain('source:readme.md — 2 lines (text/markdown)');
    expect(outcome.text).toContain('     1\t# hi');
  });

  it('длинный ресурс листается: хвост называет следующий offset', async () => {
    const ctx = ctxReading({ ok: true, text: lines(500), mediaType: 'text/plain' });
    const first = await readResourceTool.run({ uri: 'source:big.txt' }, ctx);
    const match = /Continue: read_resource offset=(\d+)/.exec(first.text);
    expect(match).not.toBeNull();

    const next = await readResourceTool.run(
      { uri: 'source:big.txt', offset: Number(match?.[1]) },
      ctx
    );
    expect(next.text).toContain(`line ${match?.[1] ?? ''} `);
  });

  it('ошибка провайдера доходит до модели с кодом и подсказками', async () => {
    const outcome = await readResourceTool.run(
      { uri: 'source:nope' },
      ctxReading({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'No source:nope.', suggestions: ['source:note.md'] },
      })
    );
    expect(outcome.error?.code).toBe('NOT_FOUND');
    expect(outcome.text).toContain('source:note.md');
  });

  it('вне хода — UNAVAILABLE', async () => {
    const outcome = await readResourceTool.run({ uri: 'source:a' }, {} as unknown as ToolContext);
    expect(outcome.error?.code).toBe('UNAVAILABLE');
  });
});
