import { describe, expect, it, vi } from 'vitest';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { emptyRules } from '@/lib/form-model/rules';
import { builtinEntries } from '@/lib/catalog/__fixtures__/builtin-catalog';
import { sampleSchema } from '@/lib/form-model/__fixtures__/sample-schema';
import { createToolRegistry } from './registry';
import { readOnlyTools } from '../tools';
import { ok, TOOL_TEXT_BUDGET, type AgentTool, type ToolContext } from '../model/types';

const ctx = (): ToolContext => {
  const schema = sampleSchema();
  return {
    draft: schema,
    base: schema,
    rules: emptyRules(),
    catalog: builtinEntries(),
    validateForm: validateFormSchema,
  };
};

const echo: AgentTool<{ text: string }> = {
  name: 'echo',
  description: 'Вернуть переданный текст',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
    additionalProperties: false,
  },
  readOnly: true,
  run: (params) => ok(params.text),
};

describe('createToolRegistry', () => {
  it('повтор имени — ошибка сборки', () => {
    expect(() => createToolRegistry([echo, echo])).toThrow(/дважды/);
  });

  it('list фильтрует по readOnly', () => {
    const reg = createToolRegistry(readOnlyTools());
    expect(reg.list()).toHaveLength(readOnlyTools().length);
    expect(reg.list({ readOnly: true })).toHaveLength(readOnlyTools().length);
    expect(reg.list({ readOnly: false })).toHaveLength(0);
  });
});

describe('invoke', () => {
  it('неизвестный инструмент → UNKNOWN_TOOL с похожими именами', async () => {
    const reg = createToolRegistry(readOnlyTools());
    const res = await reg.invoke('get_form_outlines', {}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('UNKNOWN_TOOL');
    expect(res.error?.suggestions).toContain('get_form_outline');
  });

  it('аргументы не по схеме → INVALID_PARAMS, инструмент не вызывается', async () => {
    const reg = createToolRegistry([echo]);
    const res = await reg.invoke('echo', { text: 42 }, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_PARAMS');
  });

  it('лишний аргумент отклоняется — опечатка в имени параметра не пройдёт молча', async () => {
    const reg = createToolRegistry([echo]);
    expect((await reg.invoke('echo', { text: 'ок', txt: 'ой' }, ctx())).error?.code).toBe(
      'INVALID_PARAMS'
    );
  });

  it('инструмент без обязательных полей вызывается без аргументов', async () => {
    const reg = createToolRegistry(readOnlyTools());
    expect((await reg.invoke('get_form_outline', undefined, ctx())).ok).toBe(true);
  });

  it('исключение инструмента не роняет вызов → TOOL_FAILED', async () => {
    const boom: AgentTool = {
      name: 'boom',
      description: 'Бросает',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      readOnly: true,
      run: () => {
        throw new Error('внутри всё сломалось');
      },
    };
    const res = await createToolRegistry([boom]).invoke('boom', {}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('TOOL_FAILED');
    expect(res.text).toContain('внутри всё сломалось');
  });

  it('ответ обрезается до бюджета', async () => {
    const long: AgentTool = {
      name: 'long',
      description: 'Длинный ответ',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      readOnly: true,
      run: () => ok('x'.repeat(TOOL_TEXT_BUDGET * 2)),
    };
    const res = await createToolRegistry([long]).invoke('long', {}, ctx());
    expect(res.text).toHaveLength(TOOL_TEXT_BUDGET);
    expect(res.text).toContain('truncated');
  });
});

describe('движок проверки аргументов грузится по требованию', () => {
  it('prepare заказывает загрузку один раз — второй заказ и вызов берут ту же', async () => {
    const loadAjv = vi.fn(() => import('ajv'));
    const reg = createToolRegistry([echo], { loadAjv });

    await reg.prepare();
    await reg.prepare();
    expect((await reg.invoke('echo', { text: 'ок' }, ctx())).ok).toBe(true);
    expect(loadAjv).toHaveBeenCalledTimes(1);
  });

  it('до заказа вызов грузит движок сам — проверка не пропускается', async () => {
    const loadAjv = vi.fn(() => import('ajv'));
    const reg = createToolRegistry([echo], { loadAjv });

    const res = await reg.invoke('echo', { text: 42 }, ctx());
    expect(res.error?.code).toBe('INVALID_PARAMS');
    expect(loadAjv).toHaveBeenCalledTimes(1);
  });

  it('движок не загрузился → отказ, а не молча пропущенные аргументы', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const run = vi.fn(() => ok('вызвали'));
    const tool: AgentTool<{ text: string }> = { ...echo, run };
    const reg = createToolRegistry([tool], {
      loadAjv: () => Promise.reject(new Error('чанк не доехал')),
    });

    await reg.prepare(); // Заказ владельца не отвергается: активация не держит на себе сеть.
    const res = await reg.invoke('echo', { text: 'ок' }, ctx());

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

    expect((await reg.invoke('echo', { text: 'ок' }, ctx())).error?.code).toBe('TOOL_FAILED');
    expect((await reg.invoke('echo', { text: 'ок' }, ctx())).ok).toBe(true);
    expect(loadAjv).toHaveBeenCalledTimes(2);
  });
});
