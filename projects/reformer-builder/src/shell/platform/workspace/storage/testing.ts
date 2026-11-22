/**
 * Подставные реализации хранилищ: дерево в памяти вместо OPFS и база в памяти вместо IndexedDB.
 *
 * **Зачем.** Тесты идут в окружении `node`, где нет ни OPFS, ни IndexedDB, а зависимость
 * (`fake-indexeddb`) ставить нельзя. Чистые функции раскладки проверяются напрямую, всё
 * остальное — против этих двойников.
 *
 * **Что двойники обязаны воспроизводить, иначе они бесполезны.** Не «структуру данных», а те
 * свойства, из-за которых код и написан так, как написан:
 *
 * - у OPFS — отсутствие `createSyncAccessHandle` вне Worker (и его отказ там, где он есть,
 *   но не работает), атомарность `createWritable` только на `close()`, `NotFoundError`
 *   и `TypeMismatchError` как обычный ответ, а не как авария;
 * - у IndexedDB — коммит ПОЗЖЕ успеха запроса (иначе проверка «резолвим по `oncomplete`»
 *   ничего не проверяет), откат при `abort`, отказ по квоте, закрытие соединения извне.
 *
 * Файл лежит в `src`, а не рядом с одним тестом, потому что нужен всем последующим задачам Э2
 * (Workspace, материализация, вытеснение) — их тоже негде проверять, кроме как здесь.
 *
 * **Оговорка для тех, кто будет им пользоваться.** Коммит транзакции в двойнике IndexedDB
 * назначается через `setTimeout`, поэтому с `vi.useFakeTimers()` он не наступит сам —
 * такие тесты обязаны прокручивать таймеры (`vi.advanceTimersByTimeAsync`) или брать
 * настоящие. Причина выбора — в комментарии к `scheduleCommit`.
 *
 * @module shell/platform/workspace/storage/testing
 */

import type {
  OpfsDirectoryHandle,
  OpfsFile,
  OpfsFileHandle,
  OpfsSyncAccessHandle,
  OpfsWritable,
} from './opfs';

/*
 * ────────────────────────────────  OPFS  ────────────────────────────────
 */

interface MemoryFile {
  kind: 'file';
  name: string;
  data: Uint8Array;
}

interface MemoryDirectory {
  kind: 'directory';
  name: string;
  children: Map<string, MemoryNode>;
}

type MemoryNode = MemoryFile | MemoryDirectory;

/**
 * Ошибка файловой системы с настоящим `name`.
 *
 * Именно по `name` (`NotFoundError`, `TypeMismatchError`) код отличает промах от аварии —
 * двойник, бросающий обычный `Error`, проверял бы не то, что происходит в браузере.
 * `DOMException` здесь не нужен: сравнивается имя, а не класс.
 */
function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** Как двойнику вести себя с синхронным хэндлом записи. */
export type SyncAccessMode =
  /** Метода нет вовсе — главный поток в браузере без поддержки. */
  | 'absent'
  /** Метод есть и работает — Worker. */
  | 'available'
  /** Метод есть, но бросает — главный поток там, где метод объявлен. */
  | 'throws';

export interface MemoryOpfsOptions {
  readonly syncAccess?: SyncAccessMode;
}

/** Счётчики путей записи: доказывают, что живы обе ветки, а не одна. */
export interface OpfsWriteCounters {
  sync: number;
  writable: number;
}

export interface MemoryOpfs {
  /** Корень, который отдают вместо `navigator.storage.getDirectory()`. */
  readonly root: OpfsDirectoryHandle;
  /** Провайдер для `createWorkspaceFileStore({ directory })`. */
  directory(): Promise<OpfsDirectoryHandle>;
  /** Все файлы дерева: полный путь → текст. По нему проверяется РАСКЛАДКА, а не только чтение. */
  files(): Record<string, string>;
  /** Байты одного файла по полному пути. */
  bytes(path: string): Uint8Array | undefined;
  readonly writes: OpfsWriteCounters;
}

/** Дерево в памяти, отвечающее на те же вызовы, что и OPFS. */
export function createMemoryOpfs(options: MemoryOpfsOptions = {}): MemoryOpfs {
  const syncAccess = options.syncAccess ?? 'absent';
  const writes: OpfsWriteCounters = { sync: 0, writable: 0 };
  const rootNode: MemoryDirectory = { kind: 'directory', name: '', children: new Map() };

  const fileOf = (node: MemoryFile): OpfsFile => {
    // Снимок на момент вызова: `getFile()` в браузере тоже отдаёт состояние, а не живую ссылку.
    const data = node.data.slice();
    return {
      size: data.length,
      text: async () => new TextDecoder().decode(data),
      arrayBuffer: async () => {
        const copy = new Uint8Array(data);
        return copy.buffer;
      },
    };
  };

  const toBytes = (data: Uint8Array | string): Uint8Array =>
    typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);

  const fileHandleOf = (node: MemoryFile): OpfsFileHandle => {
    const handle: {
      kind: 'file';
      name: string;
      getFile(): Promise<OpfsFile>;
      createWritable(): Promise<OpfsWritable>;
      createSyncAccessHandle?(): Promise<OpfsSyncAccessHandle>;
    } = {
      kind: 'file',
      name: node.name,
      getFile: async () => fileOf(node),
      createWritable: async () => {
        const chunks: Uint8Array[] = [];
        return {
          write: async (data) => {
            chunks.push(toBytes(data));
          },
          close: async () => {
            // Коммит на `close()` — ровно та атомарность, которую обещает спецификация:
            // до него файл виден в прежнем состоянии.
            const size = chunks.reduce((sum, c) => sum + c.length, 0);
            const merged = new Uint8Array(size);
            let at = 0;
            for (const chunk of chunks) {
              merged.set(chunk, at);
              at += chunk.length;
            }
            node.data = merged;
            writes.writable += 1;
          },
        };
      },
    };

    if (syncAccess === 'available') {
      handle.createSyncAccessHandle = async () => {
        let buffer = node.data.slice();
        return {
          write: (data, opts) => {
            const bytes = toBytes(data);
            const at = opts?.at ?? 0;
            const next = new Uint8Array(Math.max(buffer.length, at + bytes.length));
            next.set(buffer, 0);
            next.set(bytes, at);
            buffer = next;
            return bytes.length;
          },
          truncate: (size) => {
            buffer = buffer.slice(0, size);
          },
          flush: () => {
            node.data = buffer.slice();
          },
          close: () => {
            node.data = buffer.slice();
            writes.sync += 1;
          },
        };
      };
    } else if (syncAccess === 'throws') {
      handle.createSyncAccessHandle = () =>
        Promise.reject(
          namedError('InvalidStateError', 'createSyncAccessHandle доступен только в Worker')
        );
    }

    return handle;
  };

  const directoryHandleOf = (node: MemoryDirectory): OpfsDirectoryHandle => ({
    kind: 'directory',
    name: node.name,

    async getFileHandle(name, opts) {
      const existing = node.children.get(name);
      if (existing === undefined) {
        if (opts?.create !== true) throw namedError('NotFoundError', `нет файла ${name}`);
        const created: MemoryFile = { kind: 'file', name, data: new Uint8Array() };
        node.children.set(name, created);
        return fileHandleOf(created);
      }
      if (existing.kind !== 'file') throw namedError('TypeMismatchError', `${name} — каталог`);
      return fileHandleOf(existing);
    },

    async getDirectoryHandle(name, opts) {
      const existing = node.children.get(name);
      if (existing === undefined) {
        if (opts?.create !== true) throw namedError('NotFoundError', `нет каталога ${name}`);
        const created: MemoryDirectory = { kind: 'directory', name, children: new Map() };
        node.children.set(name, created);
        return directoryHandleOf(created);
      }
      if (existing.kind !== 'directory') throw namedError('TypeMismatchError', `${name} — файл`);
      return directoryHandleOf(existing);
    },

    async removeEntry(name, opts) {
      const existing = node.children.get(name);
      if (existing === undefined) throw namedError('NotFoundError', `нет записи ${name}`);
      if (existing.kind === 'directory' && existing.children.size > 0 && opts?.recursive !== true) {
        throw namedError('InvalidModificationError', `каталог ${name} не пуст`);
      }
      node.children.delete(name);
    },

    values(): AsyncIterableIterator<OpfsFileHandle | OpfsDirectoryHandle> {
      // Порядок вставки, а не сортировка: спецификация порядка не обещает, и код, который
      // на него понадеялся, обязан падать здесь, а не в браузере.
      const snapshot = [...node.children.values()];
      async function* iterate(): AsyncGenerator<OpfsFileHandle | OpfsDirectoryHandle> {
        for (const child of snapshot) {
          yield child.kind === 'file' ? fileHandleOf(child) : directoryHandleOf(child);
        }
      }
      return iterate();
    },
  });

  const nodeAt = (path: string): MemoryNode | undefined => {
    let current: MemoryNode = rootNode;
    for (const segment of path.split('/').filter((s) => s !== '')) {
      if (current.kind !== 'directory') return undefined;
      const next: MemoryNode | undefined = current.children.get(segment);
      if (next === undefined) return undefined;
      current = next;
    }
    return current;
  };

  const collect = (dir: MemoryDirectory, prefix: string, out: Record<string, string>): void => {
    for (const child of dir.children.values()) {
      const path = prefix === '' ? child.name : `${prefix}/${child.name}`;
      if (child.kind === 'directory') collect(child, path, out);
      else out[path] = new TextDecoder().decode(child.data);
    }
  };

  const root = directoryHandleOf(rootNode);

  return {
    root,
    directory: async () => root,
    files() {
      const out: Record<string, string> = {};
      collect(rootNode, '', out);
      return out;
    },
    bytes(path) {
      const node = nodeAt(path);
      return node !== undefined && node.kind === 'file' ? node.data.slice() : undefined;
    },
    writes,
  };
}

/*
 * ────────────────────────────  IndexedDB  ────────────────────────────
 */

/** Значение записи. Хранилище не знает её формы — это задача типов в `idb.ts`. */
type StoredValue = Record<string, unknown>;

interface FakeIndexData {
  readonly name: string;
  readonly keyPath: string | readonly string[];
}

interface FakeStoreData {
  readonly name: string;
  readonly keyPath: string | readonly string[];
  /** Ключ сериализован в строку: `Map` сравнивает объекты по ссылке, а ключи у нас составные. */
  records: Map<string, { key: IDBValidKey; value: StoredValue }>;
  readonly indexes: Map<string, FakeIndexData>;
}

interface FakeDatabaseData {
  version: number;
  readonly stores: Map<string, FakeStoreData>;
}

/**
 * Порядок ключей IndexedDB — упрощённый: число < строка < массив (поэлементно).
 *
 * Полный порядок из спецификации включает `Date` и двоичные ключи; их у нас нет и не будет —
 * ключи собирает `layout.ts`, и состоят они из строк и чисел.
 */
function compareKeys(a: IDBValidKey, b: IDBValidKey): number {
  const rank = (key: IDBValidKey): number =>
    typeof key === 'number' ? 0 : typeof key === 'string' ? 1 : 2;
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return (a as number) - (b as number);
  if (ra === 1) return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  const arrayA = a as IDBValidKey[];
  const arrayB = b as IDBValidKey[];
  for (let i = 0; i < Math.min(arrayA.length, arrayB.length); i += 1) {
    const cmp = compareKeys(arrayA[i], arrayB[i]);
    if (cmp !== 0) return cmp;
  }
  return arrayA.length - arrayB.length;
}

const keyId = (key: IDBValidKey): string => JSON.stringify(key);

function extractKey(value: StoredValue, keyPath: string | readonly string[]): IDBValidKey {
  if (typeof keyPath === 'string') return value[keyPath] as IDBValidKey;
  return keyPath.map((part) => value[part] as IDBValidKey);
}

/** Управление двойником: то, ради чего он и написан. */
export interface MemoryIndexedDbControl {
  /** Сколько раз открывали соединение. Доказывает, что оно переиспользуется, а не открывается заново. */
  readonly opens: number;
  /** Сколько транзакций закоммитилось. */
  readonly commits: number;
  /** Сколько транзакций откатилось. */
  readonly aborts: number;
  /** Следующие `count` записей отказывают с этой ошибкой — так проверяется обработка квоты. */
  failNextWrites(count: number, errorName?: string): void;
  /** Закрыть соединения «снаружи»: очистка данных сайта (`close`) или версия из другой вкладки. */
  closeAll(reason: 'close' | 'versionchange'): void;
  /** Содержимое хранилища — для утверждений, не проходящих через проверяемый код. */
  dump(store: string): StoredValue[];
}

export interface MemoryIndexedDb {
  /** То, что подставляется в `createWorkspaceMetaStore({ factory })`. */
  readonly factory: IDBFactory;
  readonly control: MemoryIndexedDbControl;
}

/**
 * База в памяти, отвечающая на тот срез API IndexedDB, который использует `idb.ts`.
 *
 * Объекты собраны вручную и приводятся к типам DOM ОДНИМ приведением на границе. Структурная
 * типизация здесь не годится: обработчики событий в `lib.dom` объявлены свойствами-функциями,
 * и под `strictFunctionTypes` любое их ослабление (`Event` → `unknown`) ломает совместимость,
 * а `any` запрещён линтером. Приведение локализовано, а расхождение с настоящим API ловится
 * тем, что двойник и браузер прогоняют ОДИН И ТОТ ЖЕ код хранилища.
 */
export function createMemoryIndexedDb(): MemoryIndexedDb {
  const databases = new Map<string, FakeDatabaseData>();
  const live = new Set<{
    onclose: (() => void) | null;
    onversionchange: (() => void) | null;
    closed: boolean;
  }>();
  const counters = { opens: 0, commits: 0, aborts: 0 };
  let failWrites = 0;
  let failName = 'QuotaExceededError';

  // Настоящий `DOMException`, когда он есть: браузер бросает именно его, и двойник, бросающий
  // что-то другое, проверял бы не тот путь распознавания ошибки.
  const quotaError = (): Error =>
    typeof DOMException === 'function'
      ? new DOMException('квота IndexedDB исчерпана', failName)
      : namedError(failName, 'квота IndexedDB исчерпана');

  interface RequestLike {
    result: unknown;
    error: Error | null;
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
  }

  const makeTransaction = (data: FakeDatabaseData, names: string[], mode: string): unknown => {
    let state: 'active' | 'aborted' | 'done' = 'active';
    let pending = 0;
    const rollback = new Map<string, Map<string, { key: IDBValidKey; value: StoredValue }>>();
    for (const name of names) {
      const store = data.stores.get(name);
      if (store !== undefined) rollback.set(name, new Map(store.records));
    }

    const tx = {
      error: null as Error | null,
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,

      abort(): void {
        if (state !== 'active') return;
        state = 'aborted';
        counters.aborts += 1;
        for (const [name, records] of rollback) {
          const store = data.stores.get(name);
          if (store !== undefined) store.records = records;
        }
        tx.onabort?.();
      },

      objectStore(name: string): unknown {
        const store = data.stores.get(name);
        if (store === undefined) throw namedError('NotFoundError', `нет хранилища ${name}`);
        return makeStore(store);
      },
    };

    /** Коммит проверяется макрозадачей: так любая цепочка `await` внутри тела успеет доработать. */
    const scheduleCommit = (): void => {
      setTimeout(() => {
        if (state !== 'active' || pending > 0) return;
        state = 'done';
        counters.commits += 1;
        tx.oncomplete?.();
      }, 0);
    };

    const enqueue = <T>(exec: () => T): RequestLike => {
      if (state !== 'active')
        throw namedError('TransactionInactiveError', 'транзакция уже завершена');
      pending += 1;
      const request: RequestLike = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        if (state !== 'active') {
          // Прерванная транзакция не исполняет уже поставленные в очередь запросы — иначе
          // запись прошла бы ПОСЛЕ отката и пережила бы его.
          pending -= 1;
          return;
        }
        try {
          request.result = exec();
          request.onsuccess?.();
        } catch (err) {
          request.error = err instanceof Error ? err : new Error(String(err));
          request.onerror?.();
          // Необработанный отказ запроса прерывает транзакцию — как в спецификации.
          tx.error = request.error;
          tx.abort();
        } finally {
          pending -= 1;
          scheduleCommit();
        }
      });
      return request;
    };

    const readWrite = mode === 'readwrite';

    const makeStore = (store: FakeStoreData): unknown => {
      const sorted = (): { key: IDBValidKey; value: StoredValue }[] =>
        [...store.records.values()].sort((a, b) => compareKeys(a.key, b.key));

      const matching = (
        index: FakeIndexData,
        query: IDBValidKey
      ): { key: IDBValidKey; value: StoredValue }[] =>
        sorted().filter(
          (entry) => compareKeys(extractKey(entry.value, index.keyPath), query) === 0
        );

      return {
        get: (key: IDBValidKey) => enqueue(() => store.records.get(keyId(key))?.value),
        getAll: (query?: IDBValidKey) =>
          enqueue(() =>
            sorted()
              .filter((entry) => query === undefined || compareKeys(entry.key, query) === 0)
              .map((entry) => entry.value)
          ),
        getAllKeys: () => enqueue(() => sorted().map((entry) => entry.key)),
        count: () => enqueue(() => store.records.size),
        put: (value: StoredValue) =>
          enqueue(() => {
            if (!readWrite) throw namedError('ReadOnlyError', 'запись в readonly-транзакции');
            if (failWrites > 0) {
              failWrites -= 1;
              throw quotaError();
            }
            const key = extractKey(value, store.keyPath);
            store.records.set(keyId(key), { key, value });
            return key;
          }),
        delete: (key: IDBValidKey) =>
          enqueue(() => {
            if (!readWrite) throw namedError('ReadOnlyError', 'удаление в readonly-транзакции');
            store.records.delete(keyId(key));
            return undefined;
          }),
        clear: () =>
          enqueue(() => {
            store.records = new Map();
            return undefined;
          }),
        index: (name: string) => {
          const index = store.indexes.get(name);
          if (index === undefined) throw namedError('NotFoundError', `нет индекса ${name}`);
          return {
            getAll: (query: IDBValidKey) =>
              enqueue(() => matching(index, query).map((entry) => entry.value)),
            getAllKeys: (query: IDBValidKey) =>
              enqueue(() => matching(index, query).map((entry) => entry.key)),
          };
        },
      };
    };

    scheduleCommit(); // Пустая транзакция обязана закоммититься сама.
    return tx;
  };

  const makeDatabase = (name: string, data: FakeDatabaseData): unknown => {
    const connection = {
      onclose: null as (() => void) | null,
      onversionchange: null as (() => void) | null,
      closed: false,
    };
    live.add(connection);
    return {
      name,
      get version() {
        return data.version;
      },
      objectStoreNames: {
        contains: (store: string) => data.stores.has(store),
      },
      get onclose() {
        return connection.onclose;
      },
      set onclose(handler: (() => void) | null) {
        connection.onclose = handler;
      },
      get onversionchange() {
        return connection.onversionchange;
      },
      set onversionchange(handler: (() => void) | null) {
        connection.onversionchange = handler;
      },
      createObjectStore(store: string, opts: { keyPath: string | string[] }): unknown {
        const created: FakeStoreData = {
          name: store,
          keyPath: opts.keyPath,
          records: new Map(),
          indexes: new Map(),
        };
        data.stores.set(store, created);
        return {
          createIndex: (indexName: string, keyPath: string | string[]) => {
            created.indexes.set(indexName, { name: indexName, keyPath });
          },
        };
      },
      transaction(names: string | string[], mode: string): unknown {
        if (connection.closed) throw namedError('InvalidStateError', 'соединение закрыто');
        return makeTransaction(data, typeof names === 'string' ? [names] : names, mode);
      },
      close(): void {
        connection.closed = true;
        live.delete(connection);
      },
    };
  };

  const factory = {
    open(name: string, version: number): unknown {
      counters.opens += 1;
      const request = {
        result: undefined as unknown,
        error: null as Error | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };
      queueMicrotask(() => {
        let data = databases.get(name);
        const fresh = data === undefined;
        if (data === undefined) {
          data = { version: 0, stores: new Map() };
          databases.set(name, data);
        }
        const db = makeDatabase(name, data);
        request.result = db;
        if (fresh || data.version < version) {
          data.version = version;
          request.onupgradeneeded?.();
        }
        queueMicrotask(() => request.onsuccess?.());
      });
      return request;
    },
  };

  return {
    factory: factory as unknown as IDBFactory,
    control: {
      get opens() {
        return counters.opens;
      },
      get commits() {
        return counters.commits;
      },
      get aborts() {
        return counters.aborts;
      },
      failNextWrites(count, errorName = 'QuotaExceededError') {
        failWrites = count;
        failName = errorName;
      },
      closeAll(reason) {
        for (const connection of [...live]) {
          connection.closed = true;
          live.delete(connection);
          if (reason === 'close') connection.onclose?.();
          else connection.onversionchange?.();
        }
      },
      dump(store) {
        const values: StoredValue[] = [];
        for (const data of databases.values()) {
          const found = data.stores.get(store);
          if (found === undefined) continue;
          for (const entry of found.records.values()) values.push(entry.value);
        }
        return values;
      },
    },
  };
}
