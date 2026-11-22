/**
 * Хранилище на Origin Private File System — основная стратегия.
 *
 * Четыре свойства OPFS, определившие реализацию:
 *
 * 1. **Синхронные хэндлы доступны только в Worker.** `createSyncAccessHandle()` на главном потоке
 *    бросает, поэтому путь записи выбирается попыткой, а не проверкой окружения: сначала пробуем
 *    синхронный хэндл, при отказе — `createWritable()`. Детект «по факту» переживает и Worker,
 *    и главный поток, и движки, где поддержка появилась позже самого OPFS (Safari).
 * 2. **Запись через `createWritable()` атомарна по спецификации** — поток пишет в swap-файл и
 *    коммитит его при `close()`. Синхронный путь атомарности не даёт, поэтому он сериализуется
 *    через `navigator.locks`: две вкладки, пишущие один файл, иначе дают битую запись.
 * 3. **Хранилище общее на origin.** Ключ включает владельца (см. `cacheKey`), иначе два
 *    микрофронта с одинаковым `id` формы затрут записи друг друга.
 * 4. **Имя файла не может содержать `/`,** а ключ вида `owner/id@version` его содержит — имена
 *    кодируются `encodeURIComponent`.
 *
 * Кэш выбрасываемый: `navigator.storage.persist()` НЕ запрашивается. Просить у пользователя
 * постоянное хранилище ради кэша, который в любой момент можно перекачать, несоразмерно; флаг
 * оставлен под будущий офлайн-режим и по умолчанию выключен.
 *
 * @module reformer/form-registry/storage/opfs
 */

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_NAMESPACE,
  selectEvictions,
  type StorageOptions,
  type StorageStrategy,
  type StoredRecord,
} from './types';

/**
 * Минимальные структурные типы OPFS.
 *
 * Объявлены локально, потому что в разных версиях `lib.dom.d.ts` набор методов отличается
 * (`entries()` и `createSyncAccessHandle()` появились позже) — опираться на глобальные типы
 * значило бы ломать сборку у потребителей со «старым» TypeScript.
 */
interface OpfsWritable {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface OpfsSyncHandle {
  write(buf: Uint8Array, opts?: { at?: number }): number;
  truncate(n: number): void;
  flush(): void;
  close(): void;
}
interface OpfsFileHandle {
  getFile(): Promise<{ text(): Promise<string>; size: number }>;
  createWritable?(): Promise<OpfsWritable>;
  createSyncAccessHandle?(): Promise<OpfsSyncHandle>;
}
interface OpfsDirHandle {
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<OpfsFileHandle>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<OpfsDirHandle>;
  removeEntry(name: string, opts?: { recursive?: boolean }): Promise<void>;
  keys(): AsyncIterableIterator<string>;
}

export interface OpfsOptions extends StorageOptions {
  /**
   * Запрашивать постоянное хранилище (`navigator.storage.persist()`).
   *
   * По умолчанию `false`: кэш форм восстановим из сети, а запрос повышает шанс промпта у
   * пользователя. Включать имеет смысл только под реальный офлайн-сценарий.
   */
  persist?: boolean;
}

/** OPFS доступен в этом окружении. */
export function isOpfsAvailable(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
    );
  } catch {
    return false;
  }
}

/** Ключ → безопасное имя файла (в OPFS запрещены `/` и ряд других символов). */
const fileNameOf = (key: string): string => encodeURIComponent(key);
const keyOfFileName = (name: string): string => decodeURIComponent(name);

/** Сериализация выполняется через `navigator.locks`, когда он есть. */
async function withLock<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const locks = (navigator as { locks?: { request(n: string, f: () => Promise<T>): Promise<T> } })
    .locks;
  if (!locks) return fn();
  return locks.request(name, fn);
}

export function createOpfsStorage(opts: OpfsOptions = {}): StorageStrategy {
  const namespace = opts.namespace ?? DEFAULT_NAMESPACE;
  const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const segments = namespace.split('/').filter(Boolean);

  let dirPromise: Promise<OpfsDirHandle> | undefined;

  const dir = (): Promise<OpfsDirHandle> => {
    if (dirPromise) return dirPromise;
    dirPromise = (async () => {
      if (opts.persist && typeof navigator.storage?.persist === 'function') {
        // Результат намеренно игнорируется: отказ пользователя не повод ронять кэш.
        await navigator.storage.persist().catch(() => false);
      }
      let d = (await navigator.storage.getDirectory()) as unknown as OpfsDirHandle;
      for (const seg of segments) d = await d.getDirectoryHandle(seg, { create: true });
      return d;
    })().catch((e: unknown) => {
      dirPromise = undefined;
      throw e;
    });
    return dirPromise;
  };

  const readRecord = async (name: string): Promise<StoredRecord | undefined> => {
    try {
      const d = await dir();
      const fh = await d.getFileHandle(name);
      const text = await (await fh.getFile()).text();
      return JSON.parse(text) as StoredRecord;
    } catch {
      // NotFoundError либо битое тело: и то и другое означает «в кэше этого нет».
      return undefined;
    }
  };

  const writeRecord = async (name: string, rec: StoredRecord): Promise<void> => {
    const d = await dir();
    const fh = await d.getFileHandle(name, { create: true });
    const payload = JSON.stringify(rec);

    // Путь 1 — синхронный хэндл (Worker). Атомарности не даёт, поэтому под замком.
    if (typeof fh.createSyncAccessHandle === 'function') {
      try {
        return await withLock(`reformer-forms:${name}`, async () => {
          const h = await fh.createSyncAccessHandle!();
          try {
            h.truncate(0);
            h.write(new TextEncoder().encode(payload), { at: 0 });
            h.flush();
          } finally {
            h.close();
          }
        });
      } catch {
        // На главном потоке createSyncAccessHandle бросает — падаем на writable.
      }
    }

    // Путь 2 — writable-поток: по спецификации пишет в swap-файл и коммитит на close().
    if (typeof fh.createWritable !== 'function') {
      throw new Error('OPFS: ни createSyncAccessHandle, ни createWritable недоступны');
    }
    const w = await fh.createWritable();
    try {
      await w.write(payload);
    } finally {
      await w.close();
    }
  };

  const listRecords = async (): Promise<StoredRecord[]> => {
    const d = await dir();
    const out: StoredRecord[] = [];
    for await (const name of d.keys()) {
      const rec = await readRecord(name);
      if (rec) out.push(rec);
    }
    return out;
  };

  const evict = async (incoming: number): Promise<void> => {
    const records = await listRecords();
    const usage = records.reduce((sum, r) => sum + r.size, 0) + incoming;
    const victims = selectEvictions(records, usage, max);
    if (!victims.length) return;
    const d = await dir();
    for (const key of victims) {
      await d.removeEntry(fileNameOf(key)).catch(() => undefined);
    }
  };

  return {
    name: 'opfs',

    async get(key) {
      const name = fileNameOf(key);
      const rec = await readRecord(name);
      if (!rec) return undefined;
      const touched = { ...rec, lastUsedAt: Date.now() };
      // Обновление возраста вспомогательно: его отказ не должен ронять чтение.
      await writeRecord(name, touched).catch(() => undefined);
      return touched;
    },

    async set(rec) {
      await evict(rec.size);
      await writeRecord(fileNameOf(rec.key), rec);
    },

    async delete(key) {
      const d = await dir();
      await d.removeEntry(fileNameOf(key)).catch(() => undefined);
    },

    async keys() {
      const d = await dir();
      const out: string[] = [];
      for await (const name of d.keys()) out.push(keyOfFileName(name));
      return out;
    },

    async clear() {
      const d = await dir();
      const names: string[] = [];
      for await (const name of d.keys()) names.push(name);
      for (const name of names)
        await d.removeEntry(name, { recursive: true }).catch(() => undefined);
    },

    async estimate() {
      const records = await listRecords();
      const usage = records.reduce((sum, r) => sum + r.size, 0);
      return { usage, quota: max };
    },
  };
}
