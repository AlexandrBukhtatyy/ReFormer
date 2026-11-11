/**
 * Источник `llms-index.json` для CLI: диск, теми же местами, что и `llms.txt`.
 *
 * Порядок кандидатов совпадает с `docs-source.ts`: оба артефакта лежат рядом в одном пакете, и
 * расхождение означало бы, что индекс приехал из одной установки, а документация — из другой.
 * Слаги секций в индексе при этом перестали бы резолвиться.
 *
 * @module reformer-mcp/platform/cli/index-source
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { IndexSource } from '../../core/index/merge.js';
import { defaultPackageBases, locatePackages } from './package-locator.js';
import { reportKnowledgeProblem } from './problems.js';

const INDEX_FILE = 'llms-index.json';

/** Возможные пути к индексу пакета — по местам, где он установлен, в порядке приоритета. */
export function indexPaths(
  pkg: string,
  bases: readonly string[] = defaultPackageBases()
): string[] {
  return locatePackages(pkg, bases).map((location) => join(location.root, INDEX_FILE));
}

/**
 * Источник индексов с диска. Битый JSON — проблема в журнале и переход к следующей установке:
 * сломанный индекс одного места не прячет исправный у другого.
 */
export function createCliIndexSource(bases?: readonly string[]): IndexSource {
  return {
    read: (pkg) => {
      for (const p of indexPaths(pkg, bases)) {
        if (!existsSync(p)) continue;
        try {
          return JSON.parse(readFileSync(p, 'utf-8'));
        } catch (error) {
          reportKnowledgeProblem(`index:${pkg}`, `${p}: ${String(error)}`);
        }
      }
      return null;
    },
  };
}
