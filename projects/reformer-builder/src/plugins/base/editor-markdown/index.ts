/**
 * Публичная поверхность плагина предпросмотра markdown.
 *
 * Портов от композиции плагину не нужно: вкладки, документы, байты картинок и адреса он
 * берёт из контекста службами SDK (`./host-from-context`), а редактор кода для режима «рядом» —
 * возможностью соседа (`reformer.editor`). Без неё режима нет вовсе.
 *
 * @module plugins/base/editor-markdown/index
 */

import { createMarkdownPlugin } from './plugin';

export {
  createMarkdownPlugin,
  MARKDOWN_EDITOR_ID,
  MARKDOWN_PLUGIN_ID,
  TextEditorCapability,
} from './plugin';
export type { MarkdownPluginOptions } from './plugin';
export type { MarkdownDocument, MarkdownHost } from './host';
export { isMarkdown, MARKDOWN_MEDIA_TYPE } from './render/markdown';
export { MARKDOWN_VIEW_SETTING, type MarkdownView } from './state/view';
export { MARKDOWN_MESSAGES } from './messages';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins`. Портов плагину не нужно: вкладки, документы,
 * байты картинок и адреса он берёт из контекста сам.
 */
export default function builtin() {
  return createMarkdownPlugin();
}
