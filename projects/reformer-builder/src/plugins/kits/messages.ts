/**
 * Словарь плагина китов.
 *
 * **Почему он здесь, а не в `host/services/i18n/locales`.** Плагин переводит свои строки
 * в СВОЁМ пространстве имён (`i18n.forPlugin('kits')`), и `palette.switch` двух разных
 * плагинов — два разных сообщения. Словарь Host такого различия не выражает.
 *
 * Строки везёт плагин, но регистрирует их композиция: сервиса локализации в `PluginContext`
 * нет, и это не упущение — вклад в словарь не снимается вместе с плагином, а значит и не может
 * быть частью его подписок (то же решение, что у `plugins/files/messages`).
 *
 * Сами тексты лежат в `locales/{ru,en}.json`, а не в этом модуле: словарь — данные, и держать
 * его в JSON значит уметь отдать файл переводчику, не показывая ему TypeScript.
 *
 * @module plugins/kits/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const KITS_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
