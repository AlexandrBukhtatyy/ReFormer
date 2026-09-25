/**
 * Публичная поверхность плагина китов: то, что берёт композиция, и ничего больше.
 *
 * Контракт кита — точка `reformer.kit.source`, служба и возможность `reformer.kit.catalog` —
 * живёт в SDK (`@reformer/builder-plugin-api`): другие плагины находят службу по возможности,
 * никогда не импортируя этот каталог.
 *
 * @module plugins/kits/registry/index
 */

export { createKitsPlugin, KITS_PLUGIN_ID } from './plugin';
export type { KitsPluginOptions } from './plugin';
export { createKitsService, KIT_SETTINGS_KEY } from './service';
export type { ContributedKit, KitProblem, KitsServiceOptions, OwnedKitsService } from './service';
export { createKitFrame } from './frame';
export { BUILTIN_KIT, loadBuiltinCatalog } from './builtin';
export type { KitsSettings, Translate } from './host';
