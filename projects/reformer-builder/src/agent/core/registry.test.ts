import { describe, expect, it } from 'vitest';
import { emptyRules } from '../../model/rules';
import { sampleSchema } from '../../model/__fixtures__/sample-schema';
import { systemPrompt } from './prompt';
import { createToolRegistry } from './registry';
import { ALL_TOOLS, READ_ONLY_TOOLS } from './tools';
import {
  ok,
  PROMPT_BUDGET,
  TOOL_DESCRIPTION_BUDGET,
  TOOL_NAME_BUDGET,
  TOOL_SURFACE_BUDGET,
  TOOL_TEXT_BUDGET,
  type AgentTool,
  type ToolContext,
} from './types';

const ctx = (): ToolContext => {
  const schema = sampleSchema();
  return { draft: schema, base: schema, rules: emptyRules() };
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
  it('неизвестный инструмент → UNKNOWN_TOOL с похожими именами', async () => {
    const reg = createToolRegistry(READ_ONLY_TOOLS);
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
    const reg = createToolRegistry(READ_ONLY_TOOLS);
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

describe('бюджеты поверхности', () => {
  // Проверяются ВСЕ инструменты, а не только read-only: write-инструменты крупнее вдвое (у них
  // схемы аргументов), и именно они оставались вне проверки.
  it.each(ALL_TOOLS.map((t) => [t.name, t] as const))('%s укладывается', (_name, tool) => {
    expect(tool.name.length).toBeLessThanOrEqual(TOOL_NAME_BUDGET);
    expect(tool.description.length).toBeLessThanOrEqual(TOOL_DESCRIPTION_BUDGET);
    expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  /** То, что уходит в запрос: ровно поля, которые провайдер кладёт в определение инструмента. */
  const surface = () =>
    JSON.stringify(
      ALL_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }))
    ).length;

  it('вся поверхность вместе укладывается в бюджет', () => {
    // Падение здесь — не «подними константу», а «сожми схемы»: каждый лишний символ отправляется
    // заново на каждом из десятков шагов хода.
    expect(surface()).toBeLessThanOrEqual(TOOL_SURFACE_BUDGET);
  });

  it('системный промпт укладывается в бюджет', () => {
    expect(systemPrompt().length).toBeLessThanOrEqual(PROMPT_BUDGET);
  });
});
