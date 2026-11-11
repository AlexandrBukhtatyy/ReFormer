/**
 * Источник файлов `docs/llms` для CLI.
 *
 * Каталог ищется в тех же местах, что `llms.txt` и индекс ({@link locatePackages}). Отдельная тонкость
 * публикации: `docs/llms` входит в `files` у всех библиотек, но НЕ у самого `@reformer/mcp` —
 * его собственные рецепты у потребителя доступны только через секции `llms.txt`.
 *
 * Список каталога кэшируется: прежняя реализация делала `readdirSync` на КАЖДЫЙ вызов
 * `find_recipe`, а в ветке подсказки — ещё и по разу на каждый алиас, то есть O(алиасы × пакеты)
 * обращений к диску за один промах.
 *
 * @module reformer-mcp/platform/cli/recipe-source
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import type { RecipeSource } from '../../core/docs/recipes.js';
import { locatePackages } from './package-locator.js';
import { reportKnowledgeProblem } from './problems.js';

/** Абсолютный путь к `docs/llms` пакета, если каталог доступен. */
function locateDocsDir(pkg: string): string | null {
  for (const location of locatePackages(pkg)) {
    const dir = join(location.root, 'docs', 'llms');
    if (existsSync(dir)) return dir;
  }
  return null;
}

/** Источник рецептов с диска. */
export function createCliRecipeSource(): RecipeSource {
  const dirs = new Map<string, string | null>();
  const listings = new Map<string, string[]>();

  const dirOf = (pkg: string): string | null => {
    if (!dirs.has(pkg)) dirs.set(pkg, locateDocsDir(pkg));
    return dirs.get(pkg) ?? null;
  };

  return {
    list: (pkg) => {
      const cached = listings.get(pkg);
      if (cached) return cached;
      const dir = dirOf(pkg);
      let entries: string[] = [];
      if (dir) {
        try {
          entries = readdirSync(dir);
        } catch (error) {
          reportKnowledgeProblem(`recipes:${pkg}`, `${dir}: ${String(error)}`);
          entries = [];
        }
      }
      listings.set(pkg, entries);
      return entries;
    },
    read: (pkg, fileName) => {
      const dir = dirOf(pkg);
      if (!dir) return null;
      try {
        return readFileSync(resolve(dir, fileName), 'utf-8');
      } catch {
        return null;
      }
    },
  };
}
