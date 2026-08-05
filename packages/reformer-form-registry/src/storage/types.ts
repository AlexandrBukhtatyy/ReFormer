/**
 * Персистентное хранилище кэша форм: контракт и общие типы.
 *
 * Модуль намеренно НЕ знает ничего про формы — ни про `FormEntry`, ни про `JsonFormSchema`. Он
 * оперирует парами «ключ → сериализованное тело». Это позволяет вынести его в отдельный пакет,
 * не переписывая, и делает контракт проверяемым одним набором тестов против всех реализаций.
 *
 * Оформлено в идиоме проекта — интерфейс с обязательным минимумом, опциональные методы, фабрики
 * `createXxx()` и экспортируемый `defaultStorage`, — а не классами Strategy: классических
 * Strategy-классов в репозитории нет ни одного, образец взят с `LocaleService`.
 *
 * @module reformer/form-registry/storage/types
 */

/** Запись кэша. Тело всегда строка: хранилища не должны знать о форме данных. */
export interface StoredRecord {
  key: string;
  /** Сериализованное тело (обычно JSON-строка схемы). */
  body: string;
  /** ETag ответа — для условной ревалидации (`If-None-Match`). */
  etag?: string;
  /** Длина тела в байтах (UTF-8). Считается при записи, чтобы LRU не парсил тела. */
  size: number;
  /** Когда положили. */
  storedAt: number;
  /** Когда последний раз читали — ключ вытеснения LRU. */
  lastUsedAt: number;
}

/**
 * Стратегия хранения. Обязательный минимум — CRUD по ключу; `estimate` опционален, потому что
 * доступен не везде (в памяти квоты нет, `navigator.storage.estimate` есть не во всех движках).
 */
export interface StorageStrategy {
  /** Имя для диагностики: `'memory'`, `'indexeddb'`, `'opfs'`. */
  readonly name: string;
  get(key: string): Promise<StoredRecord | undefined>;
  set(rec: StoredRecord): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
  /** Занято/доступно в байтах. Отсутствует — значит вытеснение работает только по своему счётчику. */
  estimate?(): Promise<{ usage: number; quota: number }>;
}

export type StorageKind = 'opfs' | 'indexeddb' | 'memory';

/** Общие настройки любой стратегии. */
export interface StorageOptions {
  /**
   * Префикс пространства имён. Разные версии формата кэша не должны видеть записи друг друга:
   * при смене формата достаточно поднять префикс, и старые записи станут невидимы (и будут
   * вытеснены LRU), вместо того чтобы читаться как битые.
   */
  namespace?: string;
  /** Потолок в байтах, после которого включается вытеснение по LRU. */
  maxBytes?: number;
}

export const DEFAULT_NAMESPACE = 'reformer-forms/v1';
export const DEFAULT_MAX_BYTES = 32 * 1024 * 1024;

/**
 * Ключ записи кэша.
 *
 * `owner` в ключе ОБЯЗАТЕЛЕН: хранилище общее на origin, и два микрофронта, назвавшие форму
 * одинаково (`checkout`), затёрли бы записи друг друга.
 */
export const cacheKey = (owner: string, id: string, version: string): string =>
  `${owner}/${id}@${version}`;

/** Длина строки в байтах UTF-8 — без `Buffer`, который в браузере отсутствует. */
export function byteLength(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  // Запасной путь для сред без TextEncoder: считаем по кодовым точкам.
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.codePointAt(i)!;
    if (c > 0xffff) {
      i++;
      n += 4;
    } else if (c > 0x7ff) n += 3;
    else if (c > 0x7f) n += 2;
    else n += 1;
  }
  return n;
}

/**
 * Отбирает записи под вытеснение, пока `usage` не опустится до `limit`.
 *
 * Вынесено отдельной чистой функцией: политика вытеснения одна на все стратегии, а тестировать
 * её на живом IndexedDB — медленно и хрупко.
 *
 * @returns Ключи в порядке вытеснения (самые давно не использованные первыми).
 */
export function selectEvictions(
  records: readonly Pick<StoredRecord, 'key' | 'size' | 'lastUsedAt'>[],
  usage: number,
  limit: number
): string[] {
  if (usage <= limit) return [];
  const byAge = [...records].sort((a, b) => a.lastUsedAt - b.lastUsedAt);
  const victims: string[] = [];
  let freed = 0;
  for (const r of byAge) {
    if (usage - freed <= limit) break;
    victims.push(r.key);
    freed += r.size;
  }
  return victims;
}
