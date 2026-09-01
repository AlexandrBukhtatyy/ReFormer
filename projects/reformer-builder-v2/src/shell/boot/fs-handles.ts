/**
 * Хранилище хэндлов каталогов File System Access — то, чем переоткрывается проект.
 *
 * **Почему это отдельная база, а не поле рядом с дескриптором.** Дескриптор сериализуем
 * всегда и живёт в метаданных рабочей области (`workspaces.descriptor`), а хэндл каталога
 * не сериализуем вовсе: он переживает СТРУКТУРНОЕ клонирование, но не `JSON.stringify`.
 * Хранилище метаданных (Э2) объявляет свои записи «только тем, по чему фабрика умеет
 * восстановить источник» — положить туда живой объект значило бы нарушить это обещание
 * ради экономии одной базы. Поэтому здесь ровно то, что обещает `FsSourceDescriptor`:
 * «сам хэндл — в IndexedDB по ключу».
 *
 * **Почему запись с `keyPath`, а не ключ снаружи.** Ключ в записи делает её самодостаточной:
 * дамп базы читается без обращения к индексу, а подставная IndexedDB из
 * `workspace/storage/testing` умеет только `keyPath` — и это не её ограничение, а следствие
 * того, что все остальные хранилища проекта устроены так же.
 *
 * **Чего здесь нет.** Пула соединений и обработки квоты: записей тут единицы (по одной
 * на открытый когда-либо каталог), они крошечные, и повторять ради них машинерию `idb.ts`
 * значило бы завести вторую её копию, расходящуюся с первой.
 *
 * @module app/fs-handles
 */

import type { FsDirectoryHandle, FsHandleStore } from '@/shell/platform/source/fs-access';

/** Имя базы. Отдельно от `reformer-builder.workspace`: другая схема и другой срок жизни. */
export const HANDLES_DB_NAME = 'reformer-builder.handles';

/** Версия схемы. Растёт вместе с составом хранилищ, а не с содержимым записей. */
export const HANDLES_DB_VERSION = 1;

/** Единственное хранилище: ключ → хэндл каталога. */
export const HANDLES_STORE = 'handles';

/** Запись хранилища. Ключ лежит внутри — см. шапку про `keyPath`. */
interface HandleRecord {
  readonly key: string;
  /** Живой хэндл: IndexedDB клонирует его структурно, а не через JSON. */
  readonly handle: FsDirectoryHandle;
  /** Когда положили. Нужно уборке брошенных ключей, когда она появится. */
  readonly savedAt: number;
}

/**
 * Хранилище хэндлов: то, что подставляется в `createFsSourceFactory`, плюс запись.
 *
 * `FsHandleStore` (только чтение) — ровно то, что нужно фабрике источника; запись нужна
 * тому, кто каталог выбрал, и разведение делает это видимым в типах.
 */
export interface DirectoryHandleStore extends FsHandleStore {
  put(handleKey: string, handle: FsDirectoryHandle): Promise<void>;
  remove(handleKey: string): Promise<void>;
  /** Все известные ключи, свежие первыми. Нужен поиску уже открывавшегося каталога. */
  keys(): Promise<readonly string[]>;
  /** Закрывает соединение. Повторный вызов безвреден. */
  dispose(): void;
}

export interface DirectoryHandleStoreOptions {
  /** Подмена IndexedDB — для тестов и для нестандартных окружений. */
  readonly factory?: IDBFactory;
  readonly databaseName?: string;
  readonly now?: () => number;
}

/** Есть ли IndexedDB в этом окружении. Тот же вопрос, что у хранилища метаданных. */
function indexedDbOrNull(): IDBFactory | undefined {
  try {
    return typeof indexedDB === 'undefined' || indexedDB === null ? undefined : indexedDB;
  } catch {
    return undefined;
  }
}

/**
 * Хранилище, которое отвечает «ничего нет» и молча теряет записи.
 *
 * Отсутствие IndexedDB (приватный режим части движков) означает, что проект не переоткроется
 * сам, — но открыть его руками по-прежнему можно, и ронять из-за этого запуск нельзя.
 */
function unavailableHandleStore(): DirectoryHandleStore {
  return {
    open: () => Promise.resolve(null),
    put: () => Promise.resolve(),
    remove: () => Promise.resolve(),
    keys: () => Promise.resolve([]),
    dispose: () => undefined,
  };
}

export function createDirectoryHandleStore(
  options: DirectoryHandleStoreOptions = {}
): DirectoryHandleStore {
  const factory = options.factory ?? indexedDbOrNull();
  if (factory === undefined) return unavailableHandleStore();

  const dbName = options.databaseName ?? HANDLES_DB_NAME;
  const now = options.now ?? ((): number => Date.now());

  let connection: Promise<IDBDatabase> | undefined;
  let disposed = false;

  const open = (): Promise<IDBDatabase> => {
    const cached = connection;
    if (cached !== undefined) return cached;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(dbName, HANDLES_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(HANDLES_STORE)) {
          db.createObjectStore(HANDLES_STORE, { keyPath: 'key' });
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        // Соединение закрывают снаружи: очистка данных сайта, версия из другой вкладки.
        // Сбрасываем кэш, чтобы следующая операция переоткрыла базу, а не падала навсегда.
        db.onclose = () => {
          connection = undefined;
        };
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB не открылась'));
    }).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
    connection = opening;
    return opening;
  };

  /** Транзакция, разрешающаяся по КОММИТУ, а не по успеху запроса, — как в `idb.ts`. */
  const run = async <T>(
    mode: IDBTransactionMode,
    body: (store: IDBObjectStore) => IDBRequest | null
  ): Promise<T | undefined> => {
    const db = await open();
    return new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction([HANDLES_STORE], mode);
      let result: T | undefined;
      const request = body(tx.objectStore(HANDLES_STORE));
      if (request !== null) {
        request.onsuccess = () => {
          result = request.result as T | undefined;
        };
      }
      tx.oncomplete = () => {
        resolve(result);
      };
      tx.onerror = () => reject(tx.error ?? new Error('транзакция хэндлов отказала'));
      tx.onabort = () => reject(tx.error ?? new Error('транзакция хэндлов откачена'));
    });
  };

  return {
    async open(handleKey) {
      const record = await run<HandleRecord>('readonly', (store) => store.get(handleKey));
      return record?.handle ?? null;
    },

    async put(handleKey, handle) {
      const record: HandleRecord = { key: handleKey, handle, savedAt: now() };
      await run('readwrite', (store) => store.put(record));
    },

    async remove(handleKey) {
      await run('readwrite', (store) => store.delete(handleKey));
    },

    async keys() {
      const records = await run<readonly HandleRecord[]>('readonly', (store) => store.getAll());
      return [...(records ?? [])].sort((a, b) => b.savedAt - a.savedAt).map((record) => record.key);
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      const pending = connection;
      connection = undefined;
      void pending?.then((db) => {
        db.close();
      });
    },
  };
}
