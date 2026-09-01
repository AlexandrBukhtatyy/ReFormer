/**
 * Публичная поверхность плагина китов: то, что берёт композиция, и ничего больше.
 *
 * Здесь же лежит единственная вещь, которую у этого плагина спрашивают ДРУГИЕ плагины, —
 * `KitsServiceToken`. Это не нарушение правила «плагины не импортируют друг друга»:
 * токен берут порты в композиции (`shell/boot/ports/*`), а плагины получают службу
 * через реестр по имени, никогда не импортируя каталог соседа.
 *
 * @module plugins/kits/index
 */

export { createKitsPlugin, KITS_PLUGIN_ID } from './plugin';
export type { KitsPluginOptions } from './plugin';
export { createKitsService, KitsServiceToken, KIT_SETTINGS_KEY } from './service';
export type {
  KitsService,
  KitSource,
  KitSummary,
  OwnedKitsService,
  CatalogLoader,
} from './service';
export { BUILTIN_KIT, loadBuiltinCatalog } from './builtin';
export type { KitsSettings, Translate } from './host';
