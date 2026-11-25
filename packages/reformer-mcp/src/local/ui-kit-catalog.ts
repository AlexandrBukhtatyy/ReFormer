/**
 * Каталог кита для генератора форм — прежние имена.
 *
 * Каталог по умолчанию — кита приложения (./kit-catalog.ts): `@reformer/ui-kit`,
 * `@reformer/kit-vuetify`, `@reformer/kit-taiga` или сторонний кит со входом `./catalog`; кита у
 * приложения нет — `@reformer/ui-kit`, где его найдёт поиск пакетов. Имена модуля остались от
 * времени, когда кит был один: на них стоят сервер и статус.
 *
 * @module @reformer/mcp/local/ui-kit-catalog
 */

import { defaultPackageBases, locatePackages } from './package-locator.js';
import {
  catalogPathIn,
  kitCatalogPaths,
  kitCatalogSummary,
  loadKitCatalog,
} from './kit-catalog.js';

const UI_KIT = '@reformer/ui-kit';

/** Файлы каталога `@reformer/ui-kit` по местам его установки, в порядке приоритета. */
export function uiKitCatalogPaths(bases: readonly string[] = defaultPackageBases()): string[] {
  return locatePackages(UI_KIT, bases).map((location) => catalogPathIn(location.root));
}

/** Каталог из первого места, где он читается (по умолчанию — кита приложения); нигде — `undefined`. */
export function loadUiKitCatalog(paths: readonly string[] = kitCatalogPaths()): unknown {
  return loadKitCatalog(paths);
}

/** Где лежит каталог кита приложения, который прочитается, и сколько в нём компонентов. */
export function uiKitCatalogSummary(): { path: string | null; components: number } {
  const { path, components } = kitCatalogSummary();
  return { path, components };
}
