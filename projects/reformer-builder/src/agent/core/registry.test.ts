import { describe, expect, it } from 'vitest';
import { sampleSchema } from '../../model/__fixtures__/sample-schema';
import { createToolRegistry } from './registry';
import { READ_ONLY_TOOLS } from './tools';
import {
  ok,
  TOOL_DESCRIPTION_BUDGET,
  TOOL_NAME_BUDGET,
  TOOL_TEXT_BUDGET,
  type AgentTool,
  type ToolContext,
} from './types';

const ctx = (): ToolContext => {
  const schema = sampleSchema();
  return { draft: schema, base: schema };
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
    const reg = createToolRegistry(READ_ONLY_TOOLS);
    expect(reg.list()).toHaveLength(READ_ONLY_TOOLS.length);
    expect(reg.list({ readOnly: true })).toHaveLength(READ_ONLY_TOOLS.length);
    expect(reg.list({ readOnly: false })).toHaveLength(0);
  });
});

describe('invoke', () => {
  it('неизвестный инструмент → UNKNOWN_TOOL с похожими именами', () => {
    const reg = createToolRegistry(READ_ONLY_TOOLS);
    const res = reg.invoke('get_form_outlines', {}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('UNKNOWN_TOOL');
    expect(res.error?.suggestions).toContain('get_form_outline');
  });

  it('аргументы не по схеме → INVALID_PARAMS, инструмент не вызывается', () => {
    const reg = createToolRegistry([echo]);
    const res = reg.invoke('echo', { text: 42 }, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INVALID_PARAMS');
  });

  it('лишний аргумент отклоняется — опечатка в имени параметра не пройдёт молча', () => {
    const reg = createToolRegistry([echo]);
    expect(reg.invoke('echo', { text: 'ок', txt: 'ой' }, ctx()).error?.code).toBe('INVALID_PARAMS');
  });

  it('инструмент без обязательных полей вызывается без аргументов', () => {
    const reg = createToolRegistry(READ_ONLY_TOOLS);
    expect(reg.invoke('get_form_outline', undefined, ctx()).ok).toBe(true);
  });

  it('исключение инструмента не роняет вызов → TOOL_FAILED', () => {
    const boom: AgentTool = {
      name: 'boom',
      description: 'Бросает',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      readOnly: true,
      run: () => {
        throw new Error('внутри всё сломалось');
      },
    };
    const res = createToolRegistry([boom]).invoke('boom', {}, ctx());
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('TOOL_FAILED');
    expect(res.text).toContain('внутри всё сломалось');
  });

  it('ответ обрезается до бюджета', () => {
    const long: AgentTool = {
      name: 'long',
      description: 'Длинный ответ',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      readOnly: true,
      run: () => ok('x'.repeat(TOOL_TEXT_BUDGET * 2)),
    };
    const res = createToolRegistry([long]).invoke('long', {}, ctx());
    expect(res.text).toHaveLength(TOOL_TEXT_BUDGET);
    expect(res.text).toContain('обрезан');
  });
});

describe('бюджеты поверхности', () => {
  it.each(READ_ONLY_TOOLS.map((t) => [t.name, t] as const))('%s укладывается', (_name, tool) => {
    expect(tool.name.length).toBeLessThanOrEqual(TOOL_NAME_BUDGET);
    expect(tool.description.length).toBeLessThanOrEqual(TOOL_DESCRIPTION_BUDGET);
    expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
  });
});
