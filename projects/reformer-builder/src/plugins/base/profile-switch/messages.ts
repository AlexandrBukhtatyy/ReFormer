/**
 * Словарь выбора профиля.
 *
 * Строки везёт и вносит сам плагин — `ctx.i18n.contribute` при активации, как соседи. Тексты
 * лежат в `locales/{ru,en}.json`: словарь — данные, и его можно отдать переводчику, не показывая
 * TypeScript.
 *
 * Названий профилей здесь нет и быть не может: имя профиля приходит из конфига запуска
 * и переводу не подлежит.
 *
 * @module plugins/base/profile-switch/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const PROFILE_SWITCH_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
