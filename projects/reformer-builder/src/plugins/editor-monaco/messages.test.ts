/**
 * Тесты словаря плагина и того, куда он регистрируется.
 *
 * @module plugins/editor-monaco/messages.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { MessageSink } from './host';
import { contributeMessages, MONACO_MESSAGES, resolveMessageSink } from './messages';

function sink(): MessageSink & { calls: { locale: string; keys: string[] }[] } {
  const calls: { locale: string; keys: string[] }[] = [];
  return {
    calls,
    contribute(locale, messages) {
      calls.push({ locale, keys: Object.keys(messages) });
    },
  };
}

describe('MONACO_MESSAGES', () => {
  it('везёт обе локали', () => {
    expect(Object.keys(MONACO_MESSAGES).sort()).toEqual(['en', 'ru']);
  });

  it('ключи локалей совпадают: промах перевода не должен зависеть от языка', () => {
    expect(Object.keys(MONACO_MESSAGES.ru).sort()).toEqual(Object.keys(MONACO_MESSAGES.en).sort());
  });

  it('ни одно сообщение не пустое', () => {
    for (const messages of Object.values(MONACO_MESSAGES)) {
      for (const [key, value] of Object.entries(messages)) {
        expect(value.trim(), key).not.toBe('');
      }
    }
  });
});

describe('resolveMessageSink', () => {
  it('предпочитает штатный `ctx.i18n`, когда платформа его уже даёт', () => {
    const own = sink();
    const fallback = sink();
    expect(resolveMessageSink({ i18n: own }, fallback)).toBe(own);
  });

  it('берёт подставленный композицией, пока поля в контексте нет', () => {
    const fallback = sink();
    expect(resolveMessageSink({}, fallback)).toBe(fallback);
  });

  it('не принимает за приёмник что попало под тем же именем', () => {
    const fallback = sink();
    expect(resolveMessageSink({ i18n: 'ru' }, fallback)).toBe(fallback);
  });

  it('без обоих отвечает «регистрировать некуда», а не бросает', () => {
    expect(resolveMessageSink({})).toBeNull();
  });
});

describe('contributeMessages', () => {
  it('отдаёт словарь по одной локали', () => {
    const target = sink();
    contributeMessages(target);
    expect(target.calls.map((call) => call.locale).sort()).toEqual(['en', 'ru']);
    expect(target.calls[0].keys).toContain('editor.label');
  });

  it('отказ приёмника не глотается: словарь с ошибкой обязан быть заметен', () => {
    const failing: MessageSink = {
      contribute: vi.fn(() => {
        throw new Error('сообщение не разбирается');
      }),
    };
    expect(() => {
      contributeMessages(failing);
    }).toThrow('не разбирается');
  });
});
