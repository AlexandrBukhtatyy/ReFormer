/**
 * Источник файлов `docs/llms` для CLI.
 *
 * Каталог резолвится теми же четырьмя путями, что `llms.txt` и индекс. Отдельная тонкость
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
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { RecipeSource } from '../../core/docs/recipes.js';
import { packageDirName } from '../../core/docs/packages.js';
import { packageRoot } from './docs-source.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Абсолютный путь к `docs/llms` пакета, если каталог доступен. */
function locateDocsDir(pkg: string): string | null {
  const dir = packageDirName(pkg);
  const root = packageRoot(pkg);
  const candidates = [
    // Резолв через package.json пакета — работает под npx/pnpm/hoisting, где плоского
    // `<cwd>/node_modules/<pkg>` может не быть.
    ...(root ? [resolve(root, 'docs', 'llms')] : []),
    resolve(process.cwd(), 'node_modules', pkg, 'docs', 'llms'),
    resolve(__dirname, '../../../../', dir, 'docs', 'llms'),
    resolve(process.cwd(), 'packages', dir, 'docs', 'llms'),
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
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
        } catch {
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
