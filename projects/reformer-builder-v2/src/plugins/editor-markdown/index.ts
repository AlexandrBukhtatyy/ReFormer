/**
 * Публичная поверхность плагина предпросмотра markdown.
 *
 * ## Что нужно от композиции
 *
 * ```ts
 * createMarkdownPlugin({
 *   host: markdownHost,                          // порт платформы, см. `./host`
 *   i18n: i18n.forPlugin(MARKDOWN_PLUGIN_ID),    // пока в PluginContext своего i18n нет
 * });
 * ```
 *
 * Порт (`app/markdown-host.ts`) обязан дать:
 *
 * - **документ и его текст** — `documentOf`, `activeDocument`: рендер идёт из буфера, а не
 *   из файла, поэтому предпросмотр обновляется по мере набора;
 * - **байты и адреса** — `readBytes`, `resourceAt`: картинки лежат в проекте, и путь из
 *   markdown превращается в адрес ресурса только платформой;
 * - **переход по ссылке** — `openResource`: ссылка на соседний файл открывает вкладку;
 * - **редактор кода** — `TextEditor`: режим «рядом» показывает исходник тем же редактором,
 *   которым правится обычная code-вкладка. Без него режима нет вовсе.
 *
 * @module plugins/editor-markdown/index
 */

export { createMarkdownPlugin, MARKDOWN_EDITOR_ID, MARKDOWN_PLUGIN_ID } from './plugin';
export type { MarkdownPluginOptions } from './plugin';
export type { MarkdownDocument, MarkdownHost } from './host';
export { isMarkdown, MARKDOWN_MEDIA_TYPE } from './markdown';
export { MARKDOWN_VIEW_SETTING, type MarkdownView } from './view';
