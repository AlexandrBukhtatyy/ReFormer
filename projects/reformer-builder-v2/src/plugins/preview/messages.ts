/**
 * Словарь плагина: локаль → ключ → сообщение.
 *
 * Словари везёт плагин: заголовок панели и заголовок команды разрешаются в пространстве имён
 * ВНЁСШЕГО плагина, поэтому `panel.title` двух разных плагинов — два разных сообщения,
 * и словарь Host для них невыразим.
 *
 * Файлы JSON, а не литералы в `.ts`: словарь правит переводчик, а не автор кода, и формат,
 * в котором нельзя случайно написать выражение, для этого лучше.
 *
 * @module plugins/preview/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const PREVIEW_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
