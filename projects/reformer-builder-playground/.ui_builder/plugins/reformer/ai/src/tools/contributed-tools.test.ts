import { describe, expect, it, vi } from 'vitest';
import { contributedTool, contributedToolProblem, type ContributedTool } from './contributed-tools';
import type { ToolContext, TurnScope } from '../model/types';

const tool = (overrides: Partial<ContributedTool> = {}): ContributedTool => ({
  name: 'list_source',
  description: 'List a directory.',
  inputSchema: { type: 'object', properties: {} },
  readOnly: true,
  run: () => 'ok',
  ...overrides,
});

/** Ход для вызова: запись отвечает успехом с операцией. */
function turnOf(overrides: Partial<TurnScope> = {}): TurnScope {
  return {
    signal: new AbortController().signal,
    write: vi.fn().mockResolvedValue({
      ok: true,
      op: { kind: 'add', ref: 'notes.md', summary: 'notes.md (+1 −0)' },
    }),
    readResource: () => Promise.reject(new Error('не нужно')),
    ...overrides,
  };
}

/** Контекст вызова: инструментам плагинов из него нужен только ход. */
const ctxOf = (turn?: TurnScope): ToolContext =>
  (turn === undefined ? {} : { turn }) as unknown as ToolContext;

describe('contributedToolProblem — что не становится инструментом', () => {
  it('годный вклад', () => {
    expect(contributedToolProblem(tool())).toBeNull();
  });

  it('по одному коду на каждую ошибку автора', () => {
    expect(contributedToolProblem(tool({ name: 'List' }))).toBe('name-invalid');
    expect(contributedToolProblem(tool({ name: 'a'.repeat(31) }))).toBe('name-too-long');
    expect(contributedToolProblem(tool({ description: 'x'.repeat(501) }))).toBe(
      'description-too-long'
    );
    expect(contributedToolProblem(tool({ inputSchema: { type: 'string' } }))).toBe(
      'schema-invalid'
    );
  });
});

describe('contributedTool — вызов', () => {
  it('строка ответа — успех', async () => {
    const value = tool({ run: () => 'three files' });
    const outcome = await contributedTool(value, () => value).run({} as never, ctxOf(turnOf()));
    expect(outcome).toEqual({ ok: true, text: 'three files' });
  });

  it('ошибка плагина сохраняет код и подсказки; FAILED — это TOOL_FAILED', async () => {
    const notFound = tool({
      run: () => ({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'No such dir.', suggestions: ['src'] },
      }),
    });
    const outcome = await contributedTool(notFound, () => notFound).run(
      {} as never,
      ctxOf(turnOf())
    );
    expect(outcome.error).toEqual({
      code: 'NOT_FOUND',
      message: 'No such dir.',
      suggestions: ['src'],
    });

    const failed = tool({ run: () => ({ ok: false, error: { code: 'FAILED', message: 'boom' } }) });
    const second = await contributedTool(failed, () => failed).run({} as never, ctxOf(turnOf()));
    expect(second.error?.code).toBe('TOOL_FAILED');
  });

  it('ответ неизвестной формы — отказ, а не молчаливый успех', async () => {
    const odd = tool({ run: () => 42 as never });
    const outcome = await contributedTool(odd, () => odd).run({} as never, ctxOf(turnOf()));
    expect(outcome.ok).toBe(false);
    expect(outcome.error?.code).toBe('TOOL_FAILED');
  });

  it('выключенный плагин и вызов вне хода — UNAVAILABLE, код плагина не исполняется', async () => {
    const run = vi.fn().mockReturnValue('ok');
    const value = tool({ run });
    const gone = await contributedTool(value, () => undefined).run({} as never, ctxOf(turnOf()));
    const outside = await contributedTool(value, () => value).run({} as never, ctxOf());
    expect(gone.error?.code).toBe('UNAVAILABLE');
    expect(outside.error?.code).toBe('UNAVAILABLE');
    expect(run).not.toHaveBeenCalled();
  });

  it('запись идёт дверью хода с признаком readOnly и становится строкой журнала', async () => {
    const turn = turnOf();
    const writer = tool({
      readOnly: false,
      run: async (_params, ctx) => {
        const written = await ctx.write('notes.md', '# note');
        return written.ok ? 'written' : written.message;
      },
    });
    const outcome = await contributedTool(writer, () => writer).run({} as never, ctxOf(turn));
    expect(turn.write).toHaveBeenCalledWith('notes.md', '# note', { readOnly: false });
    expect(outcome).toMatchObject({ ok: true, text: 'written' });
    expect(outcome.ops).toEqual([{ kind: 'add', ref: 'notes.md', summary: 'notes.md (+1 −0)' }]);
  });

  it('отказ двери доходит до плагина как значение', async () => {
    const turn = turnOf({
      write: vi.fn().mockResolvedValue({ ok: false, code: 'read-only', message: 'nope' }),
    });
    const reader = tool({
      run: async (_params, ctx) => {
        const written = await ctx.write('notes.md', 'x');
        return written.ok ? 'written' : `refused: ${written.code}`;
      },
    });
    const outcome = await contributedTool(reader, () => reader).run({} as never, ctxOf(turn));
    expect(outcome).toEqual({ ok: true, text: 'refused: read-only' });
  });
});
