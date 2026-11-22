import { describe, expect, it } from 'vitest';
import {
  ASSISTANT_ATTACH_COMMAND_ID,
  AssistantResourcePoint,
  isAssistantResourceScheme,
  parseAssistantResourceUri,
} from './resources.js';

describe('isAssistantResourceScheme', () => {
  it('строчные буквы, цифры и + . - с буквы', () => {
    expect(isAssistantResourceScheme('source')).toBe(true);
    expect(isAssistantResourceScheme('kit-hexa.ui+v2')).toBe(true);
  });

  it('заглавные, ведущая цифра, пустое и слишком длинное — не схема', () => {
    expect(isAssistantResourceScheme('Source')).toBe(false);
    expect(isAssistantResourceScheme('1a')).toBe(false);
    expect(isAssistantResourceScheme('')).toBe(false);
    expect(isAssistantResourceScheme('a'.repeat(21))).toBe(false);
  });
});

describe('parseAssistantResourceUri', () => {
  it('делит по первому двоеточию: двоеточие в остатке — часть пути', () => {
    expect(parseAssistantResourceUri('source:forms/a.json')).toEqual({
      scheme: 'source',
      rest: 'forms/a.json',
    });
    expect(parseAssistantResourceUri('source:a:b')).toEqual({ scheme: 'source', rest: 'a:b' });
  });

  it('пустой остаток — корень', () => {
    expect(parseAssistantResourceUri('source:')).toEqual({ scheme: 'source', rest: '' });
  });

  it('без годной схемы — null', () => {
    expect(parseAssistantResourceUri('forms/a.json')).toBeNull();
    expect(parseAssistantResourceUri(':a')).toBeNull();
    expect(parseAssistantResourceUri('Source:x')).toBeNull();
    expect(parseAssistantResourceUri('1a:b')).toBeNull();
  });
});

describe('адреса контракта', () => {
  it('идентификатор точки и команды — часть контракта: по ним плагины находят друг друга', () => {
    expect(AssistantResourcePoint.id).toBe('reformer.assistant.resource');
    expect(ASSISTANT_ATTACH_COMMAND_ID).toBe('ai.attach');
  });
});
