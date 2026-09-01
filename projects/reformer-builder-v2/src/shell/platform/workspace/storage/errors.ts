/**
 * Отказы слоя хранения — типизированные, потому что вызывающий обязан их различать.
 *
 * Различение несущее: «OPFS в этом окружении нет» означает «деградируй и работай в памяти»,
 * а «запись не прошла» — «скажи пользователю и не считай файл сохранённым». Обычный `Error`
 * заставил бы разбирать текст сообщения, и первая же локализация сломала бы разбор — поэтому
 * машиночитаем именно код, а сообщение остаётся человеку (см. решение 13 плана: ошибки несут
 * код и параметры, а не готовую строку).
 *
 * @module shell/platform/workspace/storage/errors
 */

/** Что именно пошло не так в хранилище. */
export type StorageErrorCode =
  /** Ни OPFS, ни его аналога нет: приватный режим, старый движок, отключённое хранилище. */
  | 'opfs-unavailable'
  /** IndexedDB нет или открытие заблокировано. */
  | 'idb-unavailable'
  /** Квота исчерпана и повторная попытка после освобождения места тоже не прошла. */
  | 'quota-exceeded'
  /** Обход дерева упёрся в потолок: молчаливо усечь его нельзя, см. `WORKSPACE_WALK_LIMIT`. */
  | 'walk-budget'
  /** Идентификатор рабочей области не укладывается в один сегмент пути. */
  | 'bad-workspace-id';

/** Отказ хранилища. Сообщение — человеку, {@link code} — коду. */
export class StorageError extends Error {
  readonly code: StorageErrorCode;
  /** Путь, на котором всё сломалось, если он был. */
  readonly path?: string;

  constructor(
    code: StorageErrorCode,
    message: string,
    options?: { path?: string; cause?: unknown }
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'StorageError';
    this.code = code;
    this.path = options?.path;
  }
}

/** Это отказ хранилища с таким кодом? */
export function isStorageError(err: unknown, code?: StorageErrorCode): err is StorageError {
  return err instanceof StorageError && (code === undefined || err.code === code);
}
