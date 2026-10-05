/**
 * Словарь плагина «Проект».
 *
 * Строки везёт и вносит сам плагин — `ctx.i18n.contribute` при активации: заголовки команд,
 * панели и запросов разрешаются словарём ВЛАДЕЛЬЦА, а владелец здесь он.
 *
 * Сами тексты лежат в `locales/{ru,en}.json`: словарь — данные, и держать его в JSON значит
 * уметь отдать файл переводчику, не показывая ему TypeScript.
 *
 * @module plugins/base/project/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const PROJECT_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
