/**
 * Хранилище на IndexedDB — запасной путь там, где нет OPFS.
 *
 * Существующий в репозитории `projects/reformer-builder/src/io/handle-store.ts` за образец НЕ взят:
 * он открывает соединение на каждую операцию и не закрывает его, резолвит промис по
 * `request.onsuccess` (для `readwrite` это резолв ДО коммита транзакции — читатель следом может
 * не увидеть запись) и не обрабатывает ни `onabort`, ни исчерпание квоты. Здесь всё наоборот:
 * одно кэшированное соединение, резолв записи по `transaction.oncomplete`, отдельная ветка на
 * `QuotaExceededError` — вытеснение и один повтор.
 *
 * @module reformer/form-registry/storage/indexeddb
 */

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_NAMESPACE,
  selectEvictions,
  type StorageOptions,
  type StorageStrategy,
  type StoredRecord,
} from './types';

const STORE = 'records';

/** IndexedDB доступен и не заблокирован (private mode в части движков глушит открытие). */
export function isIndexedDbAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB request failed'));
  });

export function createIndexedDbStorage(opts: StorageOptions = {}): StorageStrategy {
  const dbName = (opts.namespace ?? DEFAULT_NAMESPACE).replace(/\//g, '_');
  const max = opts.maxBytes ?? DEFAULT_MAX_BYTES;

  // Одно соединение на всё время жизни стратегии. Открытие БД — не бесплатная операция,
  // а `handle-store` платил её на каждый get/set.
  let dbPromise: Promise<IDBDatabase> | undefined;

  const open = (): Promise<IDBDatabase> => {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(dbName, 1);
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' });
      };
      r.onsuccess = () => {
        const db = r.result;
        // Соединение может быть закрыто извне (очистка данных сайта, версия из другой вкладки) —
        // сбрасываем кэш, чтобы следующая операция переоткрыла БД, а не падала навсегда.
        db.onclose = () => {
          dbPromise = undefined;
        };
        db.onversionchange = () => {
          db.close();
          dbPromise = undefined;
        };
        resolve(db);
      };
      r.onerror = () => reject(r.error ?? new Error('IndexedDB open failed'));
      r.onblocked = () => reject(new Error('IndexedDB open blocked by another connection'));
    }).catch((e) => {
      dbPromise = undefined; // не кэшируем неудачу навсегда
      throw e;
    });
    return dbPromise;
  };

  /**
   * Выполняет операции в одной транзакции.
   *
   * Для `readwrite` промис резолвится по `oncomplete` — то есть после КОММИТА. Резолв по
   * `request.onsuccess` (как в `handle-store`) означает «запрос принят», а не «данные на диске»:
   * транзакция ещё может быть прервана, и вызывающий уже уйдёт дальше с ложным успехом.
   */
  const tx = async <T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => Promise<T> | T
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      let result: T;
      let failed = false;
      t.oncomplete = () => {
        if (!failed) resolve(result);
      };
      t.onabort = () => {
        failed = true;
        reject(t.error ?? new Error('IndexedDB transaction aborted'));
      };
      t.onerror = () => {
        failed = true;
        reject(t.error ?? new Error('IndexedDB transaction failed'));
      };
      Promise.resolve(body(t.objectStore(STORE)))
        .then((r) => {
          result = r;
          // Для readonly ждать коммита незачем — данные уже прочитаны.
          if (mode === 'readonly' && !failed) resolve(r);
        })
        .catch((e: unknown) => {
          failed = true;
          try {
            t.abort();
          } catch {
            /* транзакция уже завершена */
          }
          reject(e);
        });
    });
  };

  const isQuotaError = (e: unknown): boolean =>
    e instanceof DOMException
      ? e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      : e instanceof Error && /quota/i.test(e.message);

  const allRecords = (): Promise<StoredRecord[]> =>
    tx('readonly', (s) => req(s.getAll() as IDBRequest<StoredRecord[]>));

  const evict = async (incoming: number): Promise<void> => {
    const records = await allRecords();
    const usage = records.reduce((sum, r) => sum + r.size, 0) + incoming;
    const victims = selectEvictions(records, usage, max);
    if (!victims.length) return;
    await tx('readwrite', (s) => {
      for (const key of victims) s.delete(key);
    });
  };

  return {
    name: 'indexeddb',

    async get(key) {
      const rec = await tx('readonly', (s) =>
        req(s.get(key) as IDBRequest<StoredRecord | undefined>)
      );
      if (!rec) return undefined;
      const touched = { ...rec, lastUsedAt: Date.now() };
      // Обновление возраста — вспомогательная операция: её падение не должно ронять чтение.
      try {
        await tx('readwrite', (s) => {
          s.put(touched);
        });
      } catch {
        /* возраст не обновился — LRU просто чуть менее точен */
      }
      return touched;
    },

    async set(rec) {
      await evict(rec.size);
      try {
        await tx('readwrite', (s) => {
          s.put(rec);
        });
      } catch (e) {
        if (!isQuotaError(e)) throw e;
        // Квота исчерпана несмотря на наш счётчик (место могли занять другие origin-потребители):
        // вытесняем агрессивнее и пробуем ещё раз ОДИН раз — бесконечный цикл здесь опаснее отказа.
        await evict(max);
        await tx('readwrite', (s) => {
          s.put(rec);
        });
      }
    },

    async delete(key) {
      await tx('readwrite', (s) => {
        s.delete(key);
      });
    },

    async keys() {
      return tx('readonly', (s) => req(s.getAllKeys() as IDBRequest<string[]>));
    },

    async clear() {
      await tx('readwrite', (s) => {
        s.clear();
      });
    },

    async estimate() {
      const records = await allRecords();
      const usage = records.reduce((sum, r) => sum + r.size, 0);
      // navigator.storage.estimate даёт квоту origin'а целиком; наш потолок жёстче и важнее.
      return { usage, quota: max };
    },
  };
}
