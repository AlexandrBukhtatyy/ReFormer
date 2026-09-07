/**
 * Публичная поверхность плагина управления плагинами: то, что берёт композиция.
 *
 * Композиции нужны фабрика, идентификатор (пространство имён словаря), словарь и тип порта,
 * который она обязана удовлетворить каталогом плагинов (`shell/boot/plugins.ts`). Внутренности —
 * поставщик пунктов палитры — меняются без согласования.
 *
 * @module plugins/plugin-manager/index
 */

export { createPluginManagerPlugin, PLUGIN_MANAGER_PLUGIN_ID } from './plugin';
export type { PluginManagerPluginOptions } from './plugin';
export { PLUGIN_MANAGER_MESSAGES } from './messages';
export type { ManagedPlugin, PluginManagerHost, Translate } from './host';
