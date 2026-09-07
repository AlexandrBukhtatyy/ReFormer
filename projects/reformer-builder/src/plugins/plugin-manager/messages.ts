/**
 * Словарь плагина управления плагинами.
 *
 * Строки везёт плагин, регистрирует их композиция — то же решение и по тем же причинам,
 * что у `plugins/kits/messages`: вклад в словарь не снимается вместе с плагином, значит
 * и частью его подписок быть не может, а тексты лежат в JSON, чтобы их можно было отдать
 * переводчику, не показывая TypeScript.
 *
 * @module plugins/plugin-manager/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const PLUGIN_MANAGER_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
