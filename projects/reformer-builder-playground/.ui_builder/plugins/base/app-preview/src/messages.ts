/**
 * Словарь плагина «Превью приложением».
 *
 * Строки плагин переводит в своём пространстве имён и вносит сам — `ctx.i18n.contribute` при
 * активации, как соседи. Тексты лежат в `locales/{ru,en}.json`: словарь — данные.
 *
 * @module plugins/base/app-preview/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const APP_PREVIEW_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
