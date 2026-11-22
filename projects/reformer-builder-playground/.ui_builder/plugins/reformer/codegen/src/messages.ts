/**
 * Словарь стека генерации: подписи целей и подраздела меню, отказы и заметки стека.
 *
 * Свой, а не хозяина: ключ пункта меню резолвится словарём внёсшего плагина, а отказы и заметки
 * стека хозяин переводит через `CodegenStack.translate` — то есть тем же словарём.
 *
 * @module plugins/reformer/codegen/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const CODEGEN_STACK_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
