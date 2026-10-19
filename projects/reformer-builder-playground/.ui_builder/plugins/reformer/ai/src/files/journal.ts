/**
 * Журнал хода файлового режима: какие файлы ход записал, чем они были и чем стали.
 *
 * Один на ход, а не на попытку: ход со второй попыткой пишет двумя заходами, а отменяться обязан
 * целиком. Поэтому `before` запоминается при ПЕРВОМ касании файла и дальше не переписывается, а
 * `after` — при каждом. Из журнала мост собирает отмену хода, нормализацию схем в конце хода и
 * список файлов, созданных ходом.
 *
 * @module plugins/reformer/ai/files/journal
 */

import type { ResourceId } from '@reformer/builder-plugin-api';

/** Один записанный файл. */
export interface JournalEntry {
  /** Путь от корня модуля. */
  readonly rel: string;
  /** Текст до первой записи хода; `null` — файл ход создал. */
  readonly before: string | null;
  /** Текст после последней записи хода. */
  readonly after: string;
}

/** Журнал хода. */
export interface FileJournal {
  /** Учесть запись. `before` берётся только у первой записи файла. */
  record(id: ResourceId, rel: string, before: string | null, after: string): void;
  get(id: ResourceId): JournalEntry | undefined;
  /** Записанные файлы в порядке первого касания. */
  entries(): ReadonlyMap<ResourceId, JournalEntry>;
  readonly size: number;
}

export function createFileJournal(): FileJournal {
  const entries = new Map<ResourceId, JournalEntry>();
  return {
    record(id, rel, before, after) {
      const known = entries.get(id);
      entries.set(id, { rel, before: known ? known.before : before, after });
    },
    get: (id) => entries.get(id),
    entries: () => entries,
    get size() {
      return entries.size;
    },
  };
}
