/**
 * Источник `llms.txt` для CLI: диск, с резолвом под npx, pnpm и монорепо.
 *
 * Здесь сосредоточено всё, что знает про файловую систему, — ровно та часть прежнего
 * `utils/docs-parser.ts`, которую нельзя выполнить в браузере. Разбор и кэширование живут в
 * `core/docs/corpus.ts` и об этом файле не знают.
 *
 * @module reformer-mcp/platform/cli/docs-source
 */

import { existsSync, readFileSync } from 'fs';
import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { DocsSource } from '../../core/docs/corpus.js';
import { OWN_PACKAGE, packageDirName } from '../../core/docs/packages.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const requireFromHere = createRequire(import.meta.url);

/**
 * Корень установленного пакета через резолв его `package.json`.
 *
 * Нужен потому, что канонический запуск — `npx -y @reformer/mcp`: сервер живёт в кэше npx,
 * а не в `node_modules` проекта, поэтому `process.cwd()`-пути до него не достают. Резолв
 * от `import.meta.url` работает и под npx, и при hoisting, и в pnpm с симлинками.
 */
export function packageRoot(pkg: string): string | null {
  try {
    return dirname(requireFromHere.resolve(`${pkg}/package.json`));
  } catch {
    return null;
  }
}

/**
 * Возможные пути к `llms.txt` пакета, в порядке убывания надёжности.
 *
 * Порядок повторяется в `index-source.ts` для `llms-index.json` — оба артефакта лежат рядом,
 * и расхождение путей означало бы, что индекс и документация приехали из разных установок.
 */
export function docsPaths(pkg: string): string[] {
  const dir = packageDirName(pkg);
  const paths: string[] = [];

  // Own package: llms.txt лежит в корне пакета рядом с dist/. Под `npx` это единственный
  // рабочий путь — сервер не является зависимостью проекта, и CWD-пути до него не достают.
  // Без этого `reformer://guide` всегда отдавал "documentation not found".
  if (pkg === OWN_PACKAGE) {
    paths.push(resolve(__dirname, '../../..', 'llms.txt'), resolve(__dirname, '../..', 'llms.txt'));
  }

  // Любой установленный пакет — через резолв его package.json (npx/pnpm/hoisting-safe).
  const root = packageRoot(pkg);
  if (root) paths.push(resolve(root, 'llms.txt'));

  paths.push(
    // In node_modules (when installed as dependency)
    resolve(process.cwd(), 'node_modules', pkg, 'llms.txt'),
    // In monorepo (during development) — relative to this file
    resolve(__dirname, '../../../../', dir, 'llms.txt'),
    // Relative to current working directory (cwd inside repo)
    resolve(process.cwd(), 'packages', dir, 'llms.txt')
  );

  return paths;
}

/** Источник документации с диска. */
export function createCliDocsSource(): DocsSource {
  return {
    has: (pkg) => docsPaths(pkg).some((p) => existsSync(p)),
    read: (pkg) => {
      for (const p of docsPaths(pkg)) {
        if (!existsSync(p)) continue;
        try {
          return readFileSync(p, 'utf-8');
        } catch {
          continue;
        }
      }
      return null;
    },
  };
}
