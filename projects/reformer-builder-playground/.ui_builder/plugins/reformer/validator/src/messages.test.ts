/**
 * Словарь валидатора против его кодов.
 *
 * Код находки и её текст теперь живут в одном плагине, и связывает их только совпадение строк:
 * `errors.<код>` в словаре. Код без текста человек увидит самим кодом — в панели проблем,
 * на канвасе и в подчёркивании разом; текст без кода — след удалённой проверки, который будут
 * переводить и поддерживать впустую.
 */

import { describe, expect, it } from 'vitest';
import { CODES, QUICKFIX } from './codes';
import { SCHEMA_VALIDATOR_MESSAGES } from './messages';

const LOCALES = Object.keys(SCHEMA_VALIDATOR_MESSAGES);
const expected = [
  ...Object.values(CODES).map((code) => `errors.${code}`),
  ...Object.values(QUICKFIX),
].sort();

describe('словарь валидатора', () => {
  it('проверка не пуста: локали и коды найдены', () => {
    expect(LOCALES).toEqual(expect.arrayContaining(['ru', 'en']));
    expect(Object.values(CODES).length).toBeGreaterThanOrEqual(20);
    expect(Object.values(QUICKFIX).length).toBeGreaterThanOrEqual(1);
  });

  it.each(LOCALES)(
    'локаль «%s»: у каждого кода и исправления есть текст, и лишних нет',
    (locale) => {
      expect(Object.keys(SCHEMA_VALIDATOR_MESSAGES[locale]).sort()).toEqual(expected);
    }
  );
});
