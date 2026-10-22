import { describe, expect, it } from 'vitest';
import { ASSISTANT_TOOL_NAME_MAX, AssistantToolPoint, isAssistantToolName } from './tools.js';

describe('isAssistantToolName — имя, по которому модель зовёт инструмент', () => {
  it('snake_case с буквы', () => {
    expect(isAssistantToolName('list_source')).toBe(true);
    expect(isAssistantToolName('read2')).toBe(true);
  });

  it('заглавные, дефисы, точки и ведущая цифра — не имя', () => {
    expect(isAssistantToolName('ListSource')).toBe(false);
    expect(isAssistantToolName('list-source')).toBe(false);
    expect(isAssistantToolName('files.list')).toBe(false);
    expect(isAssistantToolName('2list')).toBe(false);
    expect(isAssistantToolName('_list')).toBe(false);
    expect(isAssistantToolName('')).toBe(false);
  });

  it('предел длины включительно', () => {
    expect(isAssistantToolName('a'.repeat(ASSISTANT_TOOL_NAME_MAX))).toBe(true);
    expect(isAssistantToolName('a'.repeat(ASSISTANT_TOOL_NAME_MAX + 1))).toBe(false);
  });
});

describe('точка инструментов', () => {
  it('идентификатор точки — часть контракта: по нему плагин вносит инструмент', () => {
    expect(AssistantToolPoint.id).toBe('reformer.assistant.tool');
  });
});
