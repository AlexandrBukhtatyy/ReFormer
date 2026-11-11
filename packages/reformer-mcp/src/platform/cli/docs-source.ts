/**
 * Источник `llms.txt` для CLI: диск, пакеты находит {@link locatePackages}.
 *
 * Здесь сосредоточено всё, что знает про файловую систему, — ровно та часть прежнего
 * `utils/docs-parser.ts`, которую нельзя выполнить в браузере. Разбор и кэширование живут в
 * `core/docs/corpus.ts` и об этом файле не знают.
 *
 * @module reformer-mcp/platform/cli/docs-source
 */

import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { DocsSource } from '../../core/docs/corpus.js';
import { OWN_PACKAGE } from '../../core/docs/packages.js';
import { locatePackages } from './package-locator.js';
import { reportKnowledgeProblem } from './problems.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Возможные пути к `llms.txt` пакета, в порядке убывания надёжности.
 *
 * Тот же порядок у `llms-index.json` (`index-source.ts`): оба артефакта лежат рядом, и расхождение
 * путей означало бы, что индекс и документация приехали из разных установок.
 */
export function docsPaths(pkg: string): string[] {
  const paths: string[] = [];
  // Свой пакет — рядом с запущенным сервером, а не тот, что стоит в проекте: под npx у проекта
  // может быть своя версия MCP, и её справка описывала бы чужие инструменты.
  if (pkg === OWN_PACKAGE) {
    paths.push(resolve(__dirname, '../../..', 'llms.txt'), resolve(__dirname, '../..', 'llms.txt'));
  }
  for (const location of locatePackages(pkg)) paths.push(join(location.root, 'llms.txt'));
  return [...new Set(paths)];
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
        } catch (error) {
          reportKnowledgeProblem(`docs:${pkg}`, `${p}: ${String(error)}`);
        }
      }
      return null;
    },
  };
}
