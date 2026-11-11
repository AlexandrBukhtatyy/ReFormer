/**
 * Каталог компонентов `@reformer/ui-kit` (`@reformer/ui-kit/catalog`) для генератора форм.
 *
 * Ищется там же, где справка и индексы ({@link locatePackages}): от рабочего каталога, затем от
 * `REFORMER_TYPECHECK_ROOT`, затем рядом с сервером. Так имена, подпути и props-схемы компонентов
 * совпадают с версией кита, которую соберёт компилятор потребителя. Кит — опциональный peer: не
 * нашёлся нигде — генератор работает без каталога, а статус (`reformer://status`) это показывает.
 *
 * Файл читается с диска при каждой сборке знания, а не через `require`: кэш модулей держал бы
 * старый JSON после пересборки кита посреди сессии.
 *
 * @module reformer-mcp/platform/cli/ui-kit-catalog
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { defaultPackageBases, locatePackages } from './package-locator.js';
import { reportKnowledgeProblem } from './problems.js';

const UI_KIT = '@reformer/ui-kit';
const CATALOG_EXPORT = './catalog';
const CATALOG_FILE = 'component-catalog.json';

/** Путь файла каталога в пакете кита: по `exports["./catalog"]`, иначе имя по умолчанию. */
function catalogPathIn(root: string): string {
  try {
    const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8')) as {
      exports?: Record<string, unknown>;
    };
    const target = manifest.exports?.[CATALOG_EXPORT];
    const relative =
      typeof target === 'string'
        ? target
        : (((target as Record<string, unknown> | undefined)?.import ??
            (target as Record<string, unknown> | undefined)?.default) as string | undefined);
    if (typeof relative === 'string') return join(root, relative);
  } catch {
    // нет манифеста — имя по умолчанию
  }
  return join(root, CATALOG_FILE);
}

/** Файлы каталога по местам установки кита, в порядке приоритета. */
export function uiKitCatalogPaths(bases: readonly string[] = defaultPackageBases()): string[] {
  return locatePackages(UI_KIT, bases).map((location) => catalogPathIn(location.root));
}

/** Каталог из первого места, где он читается; нигде — `undefined`. */
export function loadUiKitCatalog(paths: readonly string[] = uiKitCatalogPaths()): unknown {
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, 'utf-8')) as unknown;
    } catch (error) {
      reportKnowledgeProblem('ui-kit-catalog', `${path}: ${String(error)}`);
    }
  }
  return undefined;
}

/** Где лежит каталог, который прочитается, и сколько в нём компонентов — для статуса. */
export function uiKitCatalogSummary(): { path: string | null; components: number } {
  for (const path of uiKitCatalogPaths()) {
    if (!existsSync(path)) continue;
    try {
      const components = (JSON.parse(readFileSync(path, 'utf-8')) as { components?: unknown })
        .components;
      return { path, components: Array.isArray(components) ? components.length : 0 };
    } catch {
      // проблему запишет loadUiKitCatalog
    }
  }
  return { path: null, components: 0 };
}
