/**
 * Словарь плагина: локаль → ключ → сообщение.
 *
 * Словари везёт плагин: имя поверхности плагин переводит сам (`PreviewSurface.title`), а живой
 * вид редактора получает уже переведённое — чужой словарь ему не принадлежит. Здесь же строки
 * пустых состояний поверхностей и панели модели.
 *
 * Файлы JSON, а не литералы в `.ts`: словарь правит переводчик, а не автор кода, и формат,
 * в котором нельзя случайно написать выражение, для этого лучше.
 *
 * @module plugins/preview-runtime/messages
 */

import en from './locales/en.json';
import ru from './locales/ru.json';

/** Локаль → ключ (без пространства имён) → сообщение. */
export const PREVIEW_RUNTIME_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({ ru, en });
