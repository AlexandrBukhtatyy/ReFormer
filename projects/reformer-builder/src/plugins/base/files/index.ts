/**
 * Публичная поверхность плагина файлов: то, что берёт композиция, и ничего больше.
 *
 * Панель проблем, операции над ресурсами, сбор диагностик, текстовый редактор —
 * внутреннее и меняется без согласования. Правило проверяется запретом импорта
 * из каталога чужого плагина глубже его корня.
 *
 * Состав продиктован фактическим потреблением, а не воображением: композиции нужны
 * фабрика плагина, его идентификатор (для пространства имён словаря и владельца команд),
 * словарь и тип порта, который она обязана реализовать в `shell/boot/ports/files.ts`.
 *
 * @module plugins/base/files/index
 */

import { createFilesPlugin, type FilesPluginOptions } from './plugin';
import type { FilesHost } from './host';

export { createFilesPlugin, FILES_PLUGIN_ID } from './plugin';
export type { FilesPluginOptions } from './plugin';
export { FILES_MESSAGES } from './messages';
export type { FilesDocument, FilesHost, Translate } from './host';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Плагину нужен порт дерева файлов и две точки расширения: панели и редакторы SDK наружу не
 * отдаёт, а импортировать оболочку плагину нельзя, поэтому точки приходят параметром.
 */
export default function builtin(ports: {
  readonly files: FilesHost;
  readonly panelPoint: FilesPluginOptions['panelPoint'];
  readonly editorPoint: FilesPluginOptions['editorPoint'];
}) {
  return createFilesPlugin({
    host: ports.files,
    panelPoint: ports.panelPoint,
    editorPoint: ports.editorPoint,
  });
}
