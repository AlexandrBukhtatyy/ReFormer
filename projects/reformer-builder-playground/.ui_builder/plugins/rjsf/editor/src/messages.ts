/**
 * Словари редактора RJSF.
 *
 * @module plugins/rjsf/editor/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const RJSF_EDITOR_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
