/**
 * Словарь плагина: локаль → ключ → сообщение.
 *
 * Словари везёт плагин: `panel.title` двух разных плагинов — два разных сообщения, и словарь
 * Host для них невыразим.
 *
 * @module plugins/templates/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const TEMPLATES_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
