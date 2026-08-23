/**
 * Источник `llms-index.json` для CLI: диск, теми же путями, что и `llms.txt`.
 *
 * Порядок кандидатов обязан совпадать с `docs-source.ts`: оба артефакта лежат рядом в одном
 * пакете, и расхождение означало бы, что индекс приехал из одной установки, а документация —
 * из другой. Слаги секций в индексе при этом перестали бы резолвиться.
 *
 * @module reformer-mcp/platform/cli/index-source
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { IndexSource } from '../../core/index/merge.js';
import { packageDirName } from '../../core/docs/packages.js';
import { packageRoot } from './docs-source.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INDEX_FILE = 'llms-index.json';

/**
 * Возможные пути к индексу пакета — тот же порядок, что у `docsPaths`: резолв через
 * `package.json` (работает под npx/pnpm/hoisting), затем плоский node_modules, затем монорепо
 * и CWD.
 */
export function indexPaths(pkg: string): string[] {
  const dir = packageDirName(pkg);
  const paths: string[] = [];
  const root = packageRoot(pkg);
  if (root) paths.push(resolve(root, INDEX_FILE));
  paths.push(
    resolve(process.cwd(), 'node_modules', pkg, INDEX_FILE),
    // Монорепо: этот файл лежит в `<pkg>/{src,dist}/platform/cli/`, поэтому до `packages/` —
    // четыре уровня вверх. Путь не декоративный: у `@reformer/core` и `@reformer/cdk` в
    // `exports` нет `./package.json`, поэтому `packageRoot()` для них возвращает null, и резолв
    // держится именно на этой ветке.
    resolve(__dirname, '../../../../', dir, INDEX_FILE),
    resolve(process.cwd(), 'packages', dir, INDEX_FILE)
  );
  return paths;
}

/** Источник индексов с диска. Битый JSON трактуется как отсутствие индекса. */
export function createCliIndexSource(): IndexSource {
  return {
    read: (pkg) => {
      for (const p of indexPaths(pkg)) {
        if (!existsSync(p)) continue;
        try {
          return JSON.parse(readFileSync(p, 'utf-8'));
        } catch {
          return null;
        }
      }
      return null;
    },
  };
}
