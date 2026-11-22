/**
 * Журнал хода файлового режима: какие файлы ход записал, чем они были и чем стали.
 *
 * Один на ход, а не на попытку: ход со второй попыткой пишет двумя заходами, а отменяться обязан
 * целиком. Поэтому `before` запоминается при ПЕРВОМ касании файла и дальше не переписывается, а
 * `after` — при каждом. Из журнала ассистент собирает отмену хода и список файлов, созданных
 * ходом, а стек — нормализацию схем в конце хода. Ведут его обе стороны: ассистент заводит, стек
 * пишет попыткой хода.
 *
 * Адрес ресурса здесь — строка, как `ResourceId` SDK: toolkit от контракта плагинов не зависит.
 *
 * @module @reformer/builder-toolkit/assistant/journal
 */

type ResourceId = string;

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
