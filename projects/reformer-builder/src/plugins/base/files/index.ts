/**
 * Публичная поверхность плагина файлов: то, что берёт композиция, и ничего больше.
 *
 * Панель проблем, операции над ресурсами, сбор диагностик, текстовый редактор —
 * внутреннее и меняется без согласования. Правило проверяется запретом импорта
 * из каталога чужого плагина глубже его корня.
 *
 * @module plugins/base/files/index
 */

import { createFilesPlugin } from './plugin';

export { createFilesPlugin, FILES_PLUGIN_ID } from './plugin';
export type { FilesPluginOptions } from './plugin';
export { FILES_MESSAGES } from './messages';
export type { FilesDocument, FilesHost, Translate } from './host';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins`. Портов плагину не нужно: всё берётся из контекста.
 */
export default function builtin() {
  return createFilesPlugin();
}
