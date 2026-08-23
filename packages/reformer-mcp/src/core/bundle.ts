/**
 * Формат корпуса знаний, упакованного в один артефакт для сред без файловой системы.
 *
 * Контракт общий у генератора (`scripts/build-knowledge-bundle.mjs`) и у браузерного
 * загрузчика (`platform/browser`). Держать его в ядре обязательно: разъезд формата — это
 * ошибка на этапе сборки потребителя, где отладочной информации меньше всего.
 *
 * **Почему артефактов ДВА, а не один.** Индекс питает `get_context`, `choose_api`,
 * `get_symbol_docs`, `list_symbols` и `validate_form`; `llms.txt` нужен только `search_docs` и
 * `find_recipe`. Это разные сценарии и разный вес: индекс шести пакетов — 1.28 МБ сырого JSON,
 * документация — ещё 1.27 МБ. Слитые в один файл, они парсились бы вместе даже когда нужен
 * один; разделённые — грузятся параллельно и независимо, и потребитель, которому хватает
 * решения по API, не платит за прозу.
 *
 * Версия схемы своя, отдельно от `INDEX_SCHEMA_VERSION`: тот описывает содержимое одного
 * `llms-index.json`, этот — упаковку набора. Меняются они по разным поводам.
 *
 * @module reformer-mcp/core/bundle
 */

import type { PackageIndex } from './index/types.js';

/** Версия упаковки. Ломающее изменение → +1, загрузчик обязан отбросить чужую мажорную. */
export const BUNDLE_SCHEMA_VERSION = 1;

/** Индексы пакетов: имя пакета → его `llms-index.json`. */
export interface IndexBundle {
  schemaVersion: number;
  /** Когда собран — попадает в ответы инструментов, чтобы возраст знаний был виден. */
  builtAt: string;
  packages: Record<string, PackageIndex>;
}

/** Документация пакетов: имя пакета → текст `llms.txt`. */
export interface DocsBundle {
  schemaVersion: number;
  builtAt: string;
  packages: Record<string, string>;
}

/** Артефакт чужой мажорной версии читать нельзя: поля могли поменять смысл. */
export function isSupportedBundle(value: unknown): boolean {
  const b = value as { schemaVersion?: unknown } | null;
  return !!b && typeof b === 'object' && b.schemaVersion === BUNDLE_SCHEMA_VERSION;
}
