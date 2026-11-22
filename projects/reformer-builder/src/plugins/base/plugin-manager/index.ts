/**
 * Публичная поверхность плагина управления плагинами: то, что берёт композиция.
 *
 * Композиции нужны фабрика, идентификатор (пространство имён словаря), словарь и тип порта,
 * который она обязана удовлетворить каталогом плагинов (`application/composer/builtin-plugins.ts`).
 * Внутренности —
 * поставщик пунктов палитры — меняются без согласования.
 *
 * @module plugins/base/plugin-manager/index
 */

import { createPluginManagerPlugin } from './plugin';

export { createPluginManagerPlugin, PLUGIN_MANAGER_PLUGIN_ID } from './plugin';
export type { PluginManagerPluginOptions } from './plugin';
export { PLUGIN_MANAGER_MESSAGES } from './messages';
export type { Translate } from './host';

/**
 * Фабрика состава: так плагин создаётся при сборке приложения. Её находит по папке
 * `application/composer/builtin-plugins` и зовёт с набором портов оболочки.
 * Портов оболочки плагину не нужно: всё он берёт возможностями в `activate`.
 */
export default function builtin() {
  return createPluginManagerPlugin();
}
