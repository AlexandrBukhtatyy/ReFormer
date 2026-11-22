/**
 * Словарь плагина: локаль → ключ → сообщение.
 *
 * Заголовок панели и команды разрешаются в пространстве имён ВНЁСШЕГО плагина. Файлы JSON, а не
 * литералы в `.ts`: словарь правит переводчик, а не автор кода.
 *
 * @module plugins/forms/mcp/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const MCP_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
