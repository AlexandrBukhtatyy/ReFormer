import { describe, expect, it, vi } from 'vitest';
import {
  createToolRegistry,
  TOOL_TEXT_BUDGET,
  type RegistryOutcome,
  type RegistryTool,
} from './registry';

const done = (text: string): RegistryOutcome => ({ ok: true, text });

const echo: RegistryTool = {
  name: 'echo',
  description: 'Вернуть переданный текст',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
  readOnly: true,
  run: (params: { text: string }) => done(params.text),
};

const tool = (name: string, run: RegistryTool['run'], readOnly = true): RegistryTool => ({
  name,
  description: name,
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  readOnly,
  run,
});

describe('createToolRegistry', () => {
  it('повтор имени — ошибка сборки', () => {
    expect(() => createToolRegistry([echo, echo])).toThrow(/дважды/);
  });

  it('list фильтрует по readOnly', () => {
    const write = tool('write', () => done('записано'), false);
    const reg = createToolRegistry([echo, write]);
    expect(reg.list()).toHaveLength(2);
    expect(reg.list({ readOnly: true })).toEqual([echo]);
    expect(reg.list({ readOnly: false })).toEqual([write]);
  });
});

describe('invoke', () => {
  it('неизвестный инструмент → UNKNOWN_TOOL с похожими именами', async () => {
    const res = await createToolRegistry([echo]).invoke('ecko', {}, undefined);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('UNKNOWN_TOOL');
    expect(res.error?.suggestions).toContain('echo');
  });

  it('аргументы не по схеме → INVALID_PARAMS, инструмент не вызывается', async () => {
    const res = await createToolRegistry([echo]).invoke('echo', { text: 42 }, undefined);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_PARAMS');
  });

  it('лишний аргумент отклоняется — опечатка в имени параметра не пройдёт молча', async () => {
    const res = await createToolRegistry([echo]).invoke(
      'echo',
      { text: 'ок', txt: 'ой' },
      undefined
    );
    expect(res.error?.code).toBe('INVALID_PARAMS');
  });

  it('инструмент без обязательных полей вызывается без аргументов', async () => {
    const reg = createToolRegistry([tool('list', () => done('пусто'))]);
    expect((await reg.invoke('list', undefined, undefined)).ok).toBe(true);
  });

  it('контекст вызова доходит до инструмента', async () => {
    const run = vi.fn((_: never, ctx: { who: string }) => done(ctx.who));
    const reg = createToolRegistry<{ who: string }>([tool('who', run)]);
    expect((await reg.invoke('who', {}, { who: 'чат' })).text).toBe('чат');
  });

  it('исключение инструмента не роняет вызов → TOOL_FAILED', async () => {
    const boom = tool('boom', () => {
      throw new Error('внутри всё сломалось');
    });
    const res = await createToolRegistry([boom]).invoke('boom', {}, undefined);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('TOOL_FAILED');
    expect(res.text).toContain('внутри всё сломалось');
  });

  it('ответ обрезается до бюджета', async () => {
    const long = tool('long', () => done('x'.repeat(TOOL_TEXT_BUDGET * 2)));
    const res = await createToolRegistry([long]).invoke('long', {}, undefined);
    expect(res.text).toHaveLength(TOOL_TEXT_BUDGET);
    expect(res.text).toContain('truncated');
  });

  it('свой бюджет инструмента заменяет общий', async () => {
    const page = {
      ...tool('page', () => done('x'.repeat(TOOL_TEXT_BUDGET * 2))),
      textBudget: 3000,
    };
    const res = await createToolRegistry([page]).invoke('page', {}, undefined);
    expect(res.text).toHaveLength(3000);
  });

  it('ответ шире базового сохраняет свои поля', async () => {
    const wide = tool('wide', () => ({ ok: true, text: 'ок', extra: 7 }));
    const reg = createToolRegistry<unknown, { ok: boolean; text: string; extra?: number }>([wide]);
    expect((await reg.invoke('wide', {}, undefined)).extra).toBe(7);
  });
});

describe('движок проверки аргументов грузится по требованию', () => {
  it('prepare заказывает загрузку один раз — второй заказ и вызов берут ту же', async () => {
    const loadAjv = vi.fn(() => import('ajv'));
    const reg = createToolRegistry([echo], { loadAjv });

    await reg.prepare();
    await reg.prepare();
    expect((await reg.invoke('echo', { text: 'ок' }, undefined)).ok).toBe(true);
    expect(loadAjv).toHaveBeenCalledTimes(1);
  });

  it('до заказа вызов грузит движок сам — проверка не пропускается', async () => {
    const loadAjv = vi.fn(() => import('ajv'));
    const reg = createToolRegistry([echo], { loadAjv });

    const res = await reg.invoke('echo', { text: 42 }, undefined);
    expect(res.error?.code).toBe('INVALID_PARAMS');
    expect(loadAjv).toHaveBeenCalledTimes(1);
  });

  it('движок не загрузился → отказ, а не молча пропущенные аргументы', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const run = vi.fn(() => done('вызвали'));
    const reg = createToolRegistry([{ ...echo, run }], {
      loadAjv: () => Promise.reject(new Error('чанк не доехал')),
    });

    await reg.prepare(); // Заказ владельца не отвергается: активация не держит на себе сеть.
    const res = await reg.invoke('echo', { text: 'ок' }, undefined);

    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('TOOL_FAILED');
    expect(res.text).toContain('чанк не доехал');
    expect(run).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('отказ загрузки не запоминается: следующий вызов пробует снова и проходит', async () => {
    let attempt = 0;
    const loadAjv = vi.fn(() => {
      attempt += 1;
      return attempt === 1 ? Promise.reject(new Error('сеть')) : import('ajv');
    });
    const reg = createToolRegistry([echo], { loadAjv });

    expect((await reg.invoke('echo', { text: 'ок' }, undefined)).error?.code).toBe('TOOL_FAILED');
    expect((await reg.invoke('echo', { text: 'ок' }, undefined)).ok).toBe(true);
    expect(loadAjv).toHaveBeenCalledTimes(2);
  });
});
