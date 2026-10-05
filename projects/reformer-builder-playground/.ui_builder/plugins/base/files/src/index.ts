/**
 * Публичная поверхность плагина файлов: то, что берут стенды состава, и ничего больше.
 *
 * Панель проблем, операции над ресурсами, сбор диагностик, текстовый редактор —
 * внутреннее и меняется без согласования.
 *
 * @module plugins/base/files/index
 */

export { createFilesPlugin, FILES_PLUGIN_ID } from './plugin';
export type { FilesPluginOptions } from './plugin';
export { FILES_MESSAGES } from './messages';
export type { FilesDocument, FilesHost, Translate } from './host';
