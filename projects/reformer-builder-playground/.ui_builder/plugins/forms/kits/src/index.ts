/**
 * Публичная поверхность плагина китов: то, что берут стенды состава, и ничего больше.
 *
 * Контракт кита — точка `reformer.kit.source`, служба и возможность `reformer.kit.catalog` —
 * живёт в SDK (`@reformer/builder-plugin-api`): другие плагины находят службу по возможности,
 * никогда не импортируя этот каталог.
 *
 * @module plugins/forms/kits/index
 */

export { createKitsPlugin, KITS_CELL_ID, KITS_PLUGIN_ID } from './plugin';
export type { KitsPluginOptions } from './plugin';
export { createKitsService, KIT_SETTINGS_KEY } from './service';
export type { ContributedKit, KitProblem, KitsServiceOptions, OwnedKitsService } from './service';
export { createKitFrame } from './frame';
export { BUILTIN_KIT, loadBuiltinCatalog } from './builtin';
export type { KitsSettings, Translate } from './host';
