/**
 * Источники корпуса знаний и его хэш — общие для сборки корпуса и проверки его свежести.
 *
 * Хэш (`corpusHash`) считается по содержимому пакетов, а не по записанному файлу: в файле есть
 * `builtAt` из времени изменения источников, и переключение ветки меняло бы хэш без единой правки
 * текста. Одинаковые тексты дают одинаковый хэш — поэтому копии корпуса (воркер, справка
 * конструктора) сверяются по нему.
 *
 * @module reformer-mcp/scripts/lib/corpus
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Прочитать источники корпуса: `llms-index.json` и `llms.txt` каждого пакета.
 *
 * @returns Индексы и тексты по пакетам, время самого свежего источника и чего не нашлось.
 */
export function readCorpusSources({ repoRoot, packages, packageDirName, withDocs = true }) {
  const indexPackages = {};
  const docsPackages = {};
  const missing = [];
  let newest = 0;

  for (const pkg of packages) {
    const dir = path.join(repoRoot, 'packages', packageDirName(pkg));
    const indexFile = path.join(dir, 'llms-index.json');
    const docsFile = path.join(dir, 'llms.txt');

    if (existsSync(indexFile)) {
      indexPackages[pkg] = JSON.parse(readFileSync(indexFile, 'utf8'));
      newest = Math.max(newest, statSync(indexFile).mtimeMs);
    } else {
      missing.push(`${pkg}: llms-index.json`);
    }

    if (withDocs && existsSync(docsFile)) {
      docsPackages[pkg] = readFileSync(docsFile, 'utf8');
      newest = Math.max(newest, statSync(docsFile).mtimeMs);
    } else if (withDocs) {
      missing.push(`${pkg}: llms.txt`);
    }
  }
  return { indexPackages, docsPackages, newest, missing };
}

/** Хэш корпуса по содержимому пакетов: порядок пакетов — как в источниках. */
export function corpusHash({ indexPackages, docsPackages }) {
  const hash = createHash('sha256');
  for (const pkg of Object.keys(indexPackages)) {
    hash.update(`${pkg}\0${JSON.stringify(indexPackages[pkg])}\0`);
    hash.update(`${(docsPackages[pkg] ?? '').replace(/\r\n/g, '\n')}\0`);
  }
  return hash.digest('hex').slice(0, 16);
}
