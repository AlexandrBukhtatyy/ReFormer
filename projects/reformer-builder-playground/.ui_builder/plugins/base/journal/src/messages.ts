/**
 * Словарь плагина журнала.
 *
 * Здесь только строки самой панели: заголовок, переключатель видов, пустые состояния. Тексты
 * находок и записей лежат в словарях тех, кто их завёл, — журнал их только показывает и просит
 * перевод у словаря оболочки (`reformer.host.messages`), который найдёт владельца по ключу.
 *
 * Строки везёт и вносит сам плагин — `ctx.i18n.contribute` при активации. Тексты лежат
 * в `locales/{ru,en}.json`: словарь — данные, и его можно отдать переводчику без TypeScript.
 *
 * @module plugins/base/journal/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const JOURNAL_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
