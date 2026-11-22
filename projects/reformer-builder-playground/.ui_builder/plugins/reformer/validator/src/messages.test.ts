/**
 * Словарь валидатора против его кодов.
 *
 * Код находки и её текст теперь живут в одном плагине, и связывает их только совпадение строк:
 * `errors.<код>` в словаре. Код без текста человек увидит самим кодом — в панели проблем,
 * на канвасе и в подчёркивании разом; текст без кода — след удалённой проверки, который будут
 * переводить и поддерживать впустую.
 *
 * Сюда же входят фразы находок внутри именованных частей документа (`errors.<код>.in-part`):
 * в файлах локалей их нет, словарь собирает их из начала фразы и фразы исходного кода.
 */

import { describe, expect, it } from 'vitest';
import { CODES, IN_PART_SUFFIX, inPart, PART_CODES, QUICKFIX } from './codes';
import { PART_PREFIX_KEY, SCHEMA_VALIDATOR_MESSAGES } from './messages';
import en from './locales/en.json';
import ru from './locales/ru.json';

const LOCALES = Object.keys(SCHEMA_VALIDATOR_MESSAGES);
const expected = [
  ...Object.values(CODES).map((code) => `errors.${code}`),
  ...PART_CODES.map((code) => `errors.${code}${IN_PART_SUFFIX}`),
  ...Object.values(QUICKFIX),
].sort();

describe('словарь валидатора', () => {
  it('проверка не пуста: локали и коды найдены', () => {
    expect(LOCALES).toEqual(expect.arrayContaining(['ru', 'en']));
    expect(Object.values(CODES).length).toBeGreaterThanOrEqual(20);
    expect(Object.values(QUICKFIX).length).toBeGreaterThanOrEqual(1);
    expect(PART_CODES.length).toBeGreaterThanOrEqual(20);
  });

  it.each(LOCALES)(
    'локаль «%s»: у каждого кода и исправления есть текст, и лишних нет',
    (locale) => {
      expect(Object.keys(SCHEMA_VALIDATOR_MESSAGES[locale]).sort()).toEqual(expected);
    }
  );
});

describe('фразы находок внутри части документа', () => {
  it('у кода, который бывает внутри части, свой вариант; у остальных его нет', () => {
    expect(inPart(CODES.UNKNOWN_COMPONENT)).toBe('schema.unknown-component.in-part');
    // О файле целиком, о двойниках идентификаторов и о правилах-сайдкаре часть не скажет.
    for (const code of [
      CODES.PARSE_FAILED,
      CODES.NOT_A_FORM,
      CODES.DUPLICATE_NODE_ID,
      CODES.RULE_VALIDATION_TARGET_MISSING,
      CODES.RULE_BEHAVIOR_TARGET_MISSING,
      CODES.RULE_RENDER_SELECTOR_MISSING,
    ]) {
      expect(inPart(code)).toBe(code);
    }
  });

  it.each([
    ['ru', ru as Record<string, string>],
    ['en', en as Record<string, string>],
  ])('локаль «%s»: фраза — начало с именем части и фраза исходного кода', (locale, source) => {
    const prefix = source[PART_PREFIX_KEY];
    expect(prefix).toContain('{part}');
    const messages = SCHEMA_VALIDATOR_MESSAGES[locale];
    for (const code of PART_CODES) {
      expect(messages[`errors.${code}${IN_PART_SUFFIX}`]).toBe(
        `${prefix}${source[`errors.${code}`]}`
      );
    }
    // Само начало фразы — строительный материал: оболочке оно не уходит.
    expect(messages[PART_PREFIX_KEY]).toBeUndefined();
  });
});
