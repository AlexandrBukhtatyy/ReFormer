/**
 * Словарь переключателя сочетаний.
 *
 * Строки везёт и вносит сам плагин — `ctx.i18n.contribute` при активации, как соседи. Тексты
 * лежат в `locales/{ru,en}.json`: словарь — данные, и его можно отдать переводчику, не показывая
 * TypeScript.
 *
 * Названий движков и китов здесь нет и быть не может: имя профиля приходит из конфига запуска,
 * имя кита — из его дескриптора, и оба переводу не подлежат.
 *
 * @module plugins/base/stack-switch/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const STACK_SWITCH_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
