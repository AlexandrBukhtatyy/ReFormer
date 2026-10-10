/**
 * Исключение разбора, не являющееся `Error`, — в `validateLocale` (`src/i18n/locale.ts`) и в
 * переводчике (`src/i18n/translator.ts`).
 *
 * Оба ловят любое исключение разбора и превращают его в текст — замечания словаря или диагностики
 * в консоли: у `Error` берут `message`, у всего остального — `String(error)`. Сам `parseMessage` на
 * строке бросает только `Error` (`MessageSyntaxError`, а на глубокой вложенности — `RangeError`),
 * поэтому вторая ветка достижима лишь при подмене разборщика. Здесь он подменён `vi.mock`: для
 * одного сообщения-метки бросает строку, остальные разбирает настоящий.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLocale } from '../../src/i18n/locale';
import { createI18n } from '../../src/i18n/translator';

const NON_ERROR = vi.hoisted(() => ({
  source: '⟨сообщение-метка⟩',
  thrown: 'разборщик бросил строку',
}));

vi.mock('../../src/i18n/message-format', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/i18n/message-format')>();
  return {
    ...real,
    parseMessage: (source: string) => {
      if (source === NON_ERROR.source) throw NON_ERROR.thrown;
      return real.parseMessage(source);
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('locale, translator — исключение разбора, не являющееся Error', () => {
  it('validateLocale записывает его строкой в замечание syntax', () => {
    expect(validateLocale({ ok: 'Готово', odd: NON_ERROR.source })).toEqual([
      { key: 'odd', kind: 'syntax', message: NON_ERROR.thrown },
    ]);
  });

  it('переводчик откатывается на defaultMessage и пишет его строкой в диагностику', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const i18n = createI18n({ code: 'ru', messages: { 'app.title': NON_ERROR.source } });

    expect(i18n.t('app.title', undefined, 'Application')).toBe('Application');
    expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringContaining(NON_ERROR.thrown));
  });
});
