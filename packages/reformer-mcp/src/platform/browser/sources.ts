/**
 * Источники знания для браузера: всё берётся из уже загруженного артефакта.
 *
 * Порты ядра синхронные (см. обоснование в `core/docs/corpus.ts`), поэтому асинхронность
 * живёт СНАРУЖИ: артефакт скачивается и разбирается до создания знания, а источники потом
 * только читают из памяти. Это же делает поведение предсказуемым — ни один вызов инструмента
 * не может внезапно уйти в сеть посреди хода агента.
 *
 * @module reformer-mcp/platform/browser/sources
 */

import { isSupportedBundle, type DocsBundle, type IndexBundle } from '../../core/bundle.js';
import type { DocsSource } from '../../core/docs/corpus.js';
import type { IndexSource } from '../../core/index/merge.js';
import type { SpecSource } from '../../core/spec/source.js';

/** Документация из артефакта. Отсутствующий пакет — просто отсутствующий, не ошибка. */
export function createBundleDocsSource(bundle: DocsBundle | null): DocsSource {
  const packages = bundle && isSupportedBundle(bundle) ? bundle.packages : {};
  return {
    has: (pkg) => typeof packages[pkg] === 'string',
    read: (pkg) => packages[pkg] ?? null,
  };
}

/** Индексы из артефакта. Проверку версии самого индекса делает ядро (`asPackageIndex`). */
export function createBundleIndexSource(bundle: IndexBundle | null): IndexSource {
  const packages = bundle && isSupportedBundle(bundle) ? bundle.packages : {};
  return {
    read: (pkg) => packages[pkg] ?? null,
  };
}

/**
 * Спеки, уже прочитанные хостом.
 *
 * В браузере файл приходит через drag&drop или файловый пикер, то есть его содержимое к
 * моменту вызова инструмента заведомо в памяти. Ключом служит имя файла — то же, что
 * пользователь видит в интерфейсе и что естественно передать в `specPath`.
 */
export function createMemorySpecSource(files: ReadonlyMap<string, string>): SpecSource {
  return {
    describe: () => 'загруженных файлов',
    read: (ref) => files.get(ref) ?? null,
  };
}
