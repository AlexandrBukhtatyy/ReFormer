/**
 * Словарь оболочки не знает предметной области.
 *
 * Оболочка — база для разных приложений, и конструктор форм — одно из них. Пока в её словаре
 * лежали тексты ошибок схемы формы, подписи исправлений и «Редактор форм ReFormer», любое другое
 * приложение на этой оболочке показывало бы их как свои. Тексты уехали к владельцам: находки
 * формы — к валидатору, ошибки сборки — к превью-хосту, имя приложения — в слой приложения.
 *
 * Храповик стережёт обратное движение. Вернуть сюда «ещё одну строку про формы» проще всего
 * на свете — словарь оболочки всегда под рукой.
 */

import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import ru from './locales/ru.json';

const DICTIONARIES: ReadonlyArray<readonly [string, Readonly<Record<string, string>>]> = [
  ['ru', ru],
  ['en', en],
];

/** Семейства ключей, которые принадлежат плагинам-владельцам, а не оболочке. */
const FOREIGN_KEYS = [
  /^errors\.schema\./,
  /^errors\.rules\./,
  /^errors\.structure\./,
  /^errors\.build\./,
  /^quickfix\./,
];

/**
 * Слова предметной области в ТЕКСТАХ. «Формат» — не «форма», «информация» — тоже, поэтому
 * корень берётся от начала слова и без «ат» следом. «Схема» намеренно не в списке: у оболочки
 * есть своя — схема настроек плагина.
 */
const SUBJECT: Readonly<Record<string, RegExp>> = {
  ru: /reformer|(?<![а-яё])форм(?!ат)|(?<![а-яё])кит(?![а-яё])|(?<![а-яё])кит[аеуы](?![а-яё])|превью/i,
  en: /reformer|\bforms?\b|\bkits?\b|\bpreview\b/i,
};

describe('словарь оболочки', () => {
  it('проверка не пуста: словари найдены и не малы', () => {
    for (const [, dictionary] of DICTIONARIES) {
      expect(Object.keys(dictionary).length).toBeGreaterThan(100);
    }
  });

  it.each(DICTIONARIES)('локаль «%s»: ключей плагинов-владельцев нет', (_locale, dictionary) => {
    const foreign = Object.keys(dictionary).filter((key) =>
      FOREIGN_KEYS.some((pattern) => pattern.test(key))
    );

    expect(foreign).toEqual([]);
  });

  it.each(DICTIONARIES)(
    'локаль «%s»: в текстах нет ни форм, ни имени приложения',
    (locale, dictionary) => {
      const subject = Object.entries(dictionary)
        .filter(([, text]) => SUBJECT[locale].test(text))
        .map(([key]) => key);

      expect(subject).toEqual([]);
    }
  );
});
