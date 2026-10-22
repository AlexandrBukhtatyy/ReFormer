import { describe, expect, it } from 'vitest';
import { HEXA_DEFAULT_LOCALE, hexaLocaleOf } from './locale';

describe('hexaLocaleOf — язык HexaUI по локали ReFormer', () => {
  it.each([
    ['ru', 'ru-ru'],
    ['en', 'en-us'],
    ['pt-BR', 'pt-br'],
    ['es', 'es-es'],
    ['es-MX', 'es-mx'],
    ['zh', 'zh-hans'],
    ['zh-Hant', 'zh-hant'],
    ['ru_RU', 'ru-ru'],
  ])('%s → %s', (code, expected) => {
    expect(hexaLocaleOf(code)).toBe(expected);
  });

  it('языка, которого у HexaUI нет, — английский: её язык по умолчанию', () => {
    expect(hexaLocaleOf('uk')).toBe(HEXA_DEFAULT_LOCALE);
    expect(hexaLocaleOf('')).toBe(HEXA_DEFAULT_LOCALE);
  });
});
