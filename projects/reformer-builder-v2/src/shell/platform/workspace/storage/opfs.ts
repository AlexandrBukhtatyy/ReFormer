/**
 * Содержимое рабочей области в Origin Private File System: слои `files/` и `base/`.
 *
 * **Почему BASE хранится содержимым, а не хешем.** Для трёхстороннего слияния нужен исходный
 * текст. Хеша хватило бы только на обнаружение расхождения, а восстановить базу перезапросом
 * у источника нельзя: к моменту конфликта там уже другая версия — именно поэтому конфликт
 * и возник. Удвоение объёма допустимо и является прямым следствием working set: рабочий набор
 * мал по построению, поэтому решение, неприемлемое для зеркала всего проекта, здесь дёшево.
 *
 * **Что взято из `packages/reformer-form-registry/src/storage/opfs.ts`:**
 *
 * 1. **Два пути записи, выбираемые попыткой, а не проверкой окружения.** `createSyncAccessHandle()`
 *    доступен только в Worker и на главном потоке бросает, поэтому сначала пробуем его, при отказе
 *    падаем на `createWritable()`. Детект «по факту» переживает и Worker, и главный поток,
 *    и движки, где поддержка появилась позже самого OPFS.
 * 2. **Сериализация синхронного пути через `navigator.locks`.** `createWritable()` атомарен
 *    по спецификации (пишет в swap-файл, коммитит на `close()`), синхронный хэндл — нет:
 *    две вкладки, пишущие один файл, без замка дают битую запись.
 * 3. **Ошибка чтения = промах.** Отсутствие файла и битое тело для вызывающего одно и то же:
 *    «в рабочей области этого нет, спроси источник». Отличать их значило бы заставить Workspace
 *    обрабатывать случай, в котором он всё равно поступит одинаково.
 *
 * **Что сделано иначе, чем в v1 (`projects/reformer-builder/src/io/opfs.ts`):** плоский каталог
 * на вкладку заменён зеркалом структуры проекта (почему — см. `layout.ts`), а манифест живых
 * каталогов в `localStorage` не нужен вовсе: перечень рабочих областей лежит в IndexedDB,
 * и {@link listStoredWorkspaces} сверяется с ним, а не со вторым, рассинхронизирующимся списком.
 *
 * @module host/workspace/storage/opfs
 */

import { basename, dirname, normalizePath } from '@/shell/platform/primitives/resource';
import { StorageError } from './errors';
import {
  STORAGE_LAYERS,
  WORKSPACE_ROOT_DIR,
  assertWorkspaceId,
  storagePath,
  type StorageLayer,
} from './layout';

/*
 * Структурные типы OPFS.
 *
 * Объявлены локально по той же причине, что и в form-registry: в `lib.dom.d.ts` при
 * `lib: ["ES2022","DOM","DOM.Iterable"]` нет ни `values()` (он в `DOM.AsyncIterable`),
 * ни `createSyncAccessHandle()`. Опираться на глобальные типы значило бы либо тянуть лишний
 * lib, либо расставлять приведения по всему модулю. Побочная выгода: подставная реализация
 * из `testing.ts` реализует ровно эти интерфейсы — без приведений и без `any`.
 */

/** Файл, каким его отдаёт OPFS на чтение. */
export interface OpfsFile {
  readonly size: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

/**
 * Поток записи: пишет в swap-файл, коммитит на `close()`.
 *
 * Принимаемый тип сужен до `Uint8Array | string` против браузерного `BufferSource`
 * намеренно: писать чем-то ещё мы не собираемся, а `BufferSource` в TS 5.9 требует
 * `ArrayBuffer`-параметризованный вид и заставил бы протаскивать этот параметр через
 * весь публичный API ради буфера, которого не бывает.
 */
export interface OpfsWritable {
  write(data: Uint8Array | string): Promise<void>;
  close(): Promise<void>;
}

/** Синхронный хэндл: быстрее, но атомарности не даёт и существует только в Worker. */
export interface OpfsSyncAccessHandle {
  write(data: Uint8Array, options?: { at?: number }): number;
  truncate(size: number): void;
  flush(): void;
  close(): void;
}

/** Хэндл файла. Оба способа записи необязательны — их наличие и есть детект. */
export interface OpfsFileHandle {
  readonly kind: 'file';
  readonly name: string;
  getFile(): Promise<OpfsFile>;
  createWritable?(): Promise<OpfsWritable>;
  createSyncAccessHandle?(): Promise<OpfsSyncAccessHandle>;
}

/** Хэндл каталога. */
export interface OpfsDirectoryHandle {
  readonly kind: 'directory';
  readonly name: string;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<OpfsFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<OpfsDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  values(): AsyncIterableIterator<OpfsFileHandle | OpfsDirectoryHandle>;
}

/** Откуда берётся корень хранилища. Точка подмены для тестов и для Worker. */
export type OpfsDirectoryProvider = () => Promise<OpfsDirectoryHandle>;

/** Сериализатор записи. По умолчанию — `navigator.locks`, если он есть. */
export type LockRunner = <T>(name: string, body: () => Promise<T>) => Promise<T>;

/**
 * Потолок обхода дерева.
 *
 * Рабочий набор мал по построению (бюджет догрузки — 200 файлов), поэтому обход, ушедший
 * на порядок дальше, означает ошибку, а не большой проект. Превышение — отказ, а не усечение:
 * молчаливо усечённый листинг выглядит как «всё на месте», а потом файл «необъяснимо» не находится.
 */
export const WORKSPACE_WALK_LIMIT = 5000;

/** Запись в каталоге рабочей области. */
export interface StoredEntry {
  readonly name: string;
  /** Путь ресурса внутри источника — то, чем его адресует Workspace, а не путь внутри OPFS. */
  readonly path: string;
  readonly kind: 'file' | 'directory';
}

/**
 * Содержимое одной рабочей области.
 *
 * Все пути — пути РЕСУРСОВ (`src/forms/credit/schema.json`), раскладка добавляется внутри.
 * Вызывающий не должен знать про `ws/{id}/files`, иначе знание о раскладке расползётся
 * ровно так же, как в v1 расползлось знание о каталоге вкладки.
 */
export interface WorkspaceFileStore {
  readonly workspaceId: string;

  /** Текст или `null`, если ресурса в рабочей области нет (или он нечитаем — это тот же промах). */
  readText(layer: StorageLayer, path: string): Promise<string | null>;
  /** Байты или `null` — та же политика промаха. */
  readBytes(layer: StorageLayer, path: string): Promise<Uint8Array | null>;

  /** Пишет текст, доделывая недостающие каталоги. */
  writeText(layer: StorageLayer, path: string, text: string): Promise<void>;
  /** Пишет байты, доделывая недостающие каталоги. */
  writeBytes(layer: StorageLayer, path: string, bytes: Uint8Array): Promise<void>;

  /** Удаляет файл или каталог (рекурсивно). Отсутствие — уже достигнутая цель, не ошибка. */
  remove(layer: StorageLayer, path: string): Promise<void>;
  /** Удаляет ресурс в обоих слоях: вытеснение идёт парой, иначе теряется основание слияния. */
  removePair(path: string): Promise<void>;

  /**
   * `'file' | 'directory'` или `null`. Информативнее «существует ли», а стоит столько же.
   *
   * Для ОДНОГО ресурса — это правильный вопрос. Проверять так каждое имя подряд (как v1
   * проверяет уникальность имени — до тысячи проб) нельзя: перебор заменяется одним
   * {@link WorkspaceFileStore.list} и подсчётом в памяти.
   */
  entryKind(layer: StorageLayer, path: string): Promise<'file' | 'directory' | null>;
  /** Размер файла или `null` (нет файла либо это каталог). */
  size(layer: StorageLayer, path: string): Promise<number | null>;

  /** Один уровень каталога. `null` — каталога нет; пустой список — каталог есть и пуст. */
  list(layer: StorageLayer, dir: string): Promise<readonly StoredEntry[] | null>;
  /** Все файлы поддерева, путями ресурсов. Отсутствующий каталог — пустой список. */
  listDeep(layer: StorageLayer, dir: string): Promise<readonly string[]>;

  /** Создаёт каталог со всеми недостающими родителями. */
  mkdirp(layer: StorageLayer, dir: string): Promise<void>;

  /** Удаляет рабочую область целиком — оба слоя. */
  clear(): Promise<void>;
}

/** Настройки хранилища. Без них берётся настоящий OPFS и `navigator.locks`. */
export interface OpfsStoreOptions {
  readonly directory?: OpfsDirectoryProvider;
  readonly lock?: LockRunner;
}

/**
 * Есть ли OPFS в этом окружении.
 *
 * Вызывающий обязан деградировать, а не падать: в приватном режиме части движков и в старых
 * сборках `navigator.storage.getDirectory` нет вовсе, и это нормальный режим работы, в котором
 * рабочая область живёт только в памяти сессии.
 */
export function opfsSupported(): boolean {
  try {
    return (
      typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
    );
  } catch {
    // Обращение к `navigator.storage` в отдельных окружениях само бросает.
    return false;
  }
}

/**
 * Настоящий корень OPFS.
 *
 * Единственное приведение типа в модуле, и оно здесь неизбежно: глобальный
 * `FileSystemDirectoryHandle` не объявляет `values()` при нашем наборе lib (см. шапку).
 */
async function defaultDirectory(): Promise<OpfsDirectoryHandle> {
  if (!opfsSupported()) {
    throw new StorageError('opfs-unavailable', 'OPFS недоступен в этом окружении');
  }
  const root = await navigator.storage.getDirectory();
  return root as unknown as OpfsDirectoryHandle;
}

/** Замок через `navigator.locks`, а где его нет — прямой вызов. */
async function defaultLock<T>(name: string, body: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator?.locks;
  if (locks === undefined) return body();
  // Приведение — из-за объявления `LockManager.request` в lib.dom: оно оборачивает уже
  // асинхронный колбэк ещё раз, и без него тип выходит `Promise<Promise<T>>`.
  return (await locks.request(name, body)) as T;
}

/** Путь → сегменты. Пустой путь — корень. */
function segmentsOf(path: string): string[] {
  const normalized = normalizePath(path);
  return normalized === '' ? [] : normalized.split('/');
}

/** «Файла/каталога нет» — от любого движка приходит как `NotFoundError`. */
function isMissing(err: unknown): boolean {
  return err instanceof Error && (err.name === 'NotFoundError' || err.name === 'TypeMismatchError');
}

/**
 * Хранилище содержимого одной рабочей области.
 *
 * Фабрика синхронна и ничего не открывает: корень резолвится лениво и кэшируется, а неудача
 * кэш сбрасывает — иначе один отказ (например, до выдачи разрешения) навсегда сделал бы
 * рабочую область нечитаемой.
 *
 * При отсутствии OPFS фабрика НЕ бросает: отказ приходит на первой операции с кодом
 * `opfs-unavailable`. Так вызывающий решает про деградацию один раз ({@link opfsSupported}),
 * а не оборачивает конструктор в `try`.
 */
export function createWorkspaceFileStore(
  workspaceId: string,
  options: OpfsStoreOptions = {}
): WorkspaceFileStore {
  assertWorkspaceId(workspaceId);
  const provider = options.directory ?? defaultDirectory;
  const lock: LockRunner = options.lock ?? defaultLock;

  let rootPromise: Promise<OpfsDirectoryHandle> | undefined;
  const root = (): Promise<OpfsDirectoryHandle> => {
    if (rootPromise !== undefined) return rootPromise;
    rootPromise = provider().catch((err: unknown) => {
      rootPromise = undefined;
      throw err;
    });
    return rootPromise;
  };

  /** Каталог по сегментам. `create` доделывает недостающие — это и есть `mkdir -p`. */
  const resolveDir = async (
    segments: readonly string[],
    create: boolean
  ): Promise<OpfsDirectoryHandle> => {
    let dir = await root();
    for (const segment of segments) {
      dir = await dir.getDirectoryHandle(segment, create ? { create: true } : undefined);
    }
    return dir;
  };

  /** Родительский каталог и имя для полного пути хранилища. */
  const split = (full: string): { parent: string[]; name: string } => ({
    parent: segmentsOf(dirname(full)),
    name: basename(full),
  });

  const fileHandle = async (
    layer: StorageLayer,
    path: string,
    create: boolean
  ): Promise<OpfsFileHandle> => {
    const { parent, name } = split(storagePath(workspaceId, layer, path));
    const dir = await resolveDir(parent, create);
    return dir.getFileHandle(name, create ? { create: true } : undefined);
  };

  /**
   * Запись файла целиком.
   *
   * Текст и байты идут одним путём (текст кодируется заранее): две ветки различались бы
   * гарантиями атомарности в зависимости от типа содержимого, а это ровно тот вид разницы,
   * который потом невозможно удержать в голове.
   */
  const writeAll = async (layer: StorageLayer, path: string, bytes: Uint8Array): Promise<void> => {
    const full = storagePath(workspaceId, layer, path);
    const handle = await fileHandle(layer, path, true);

    // Путь 1 — синхронный хэндл (Worker). Атомарности не даёт, поэтому под замком.
    const openSync = handle.createSyncAccessHandle;
    if (typeof openSync === 'function') {
      try {
        await lock(`reformer-builder:ws:${full}`, async () => {
          const sync = await openSync.call(handle);
          try {
            sync.truncate(0);
            sync.write(bytes, { at: 0 });
            sync.flush();
          } finally {
            sync.close();
          }
        });
        return;
      } catch {
        // На главном потоке `createSyncAccessHandle` бросает — падаем на writable.
        // Частично записанный файл здесь не страшен: writable перепишет его целиком.
      }
    }

    // Путь 2 — writable-поток: по спецификации пишет в swap-файл и коммитит на `close()`.
    if (typeof handle.createWritable !== 'function') {
      throw new StorageError(
        'opfs-unavailable',
        'OPFS: ни createSyncAccessHandle, ни createWritable недоступны',
        { path: full }
      );
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(bytes);
    } finally {
      await writable.close();
    }
  };

  const removeAt = async (layer: StorageLayer, path: string): Promise<void> => {
    const full = storagePath(workspaceId, layer, path);
    const { parent, name } = split(full);
    try {
      const dir = await resolveDir(parent, false);
      await dir.removeEntry(name, { recursive: true });
    } catch (err) {
      if (isMissing(err)) return; // Цель достигнута: ресурса и так нет.
      throw err;
    }
  };

  return {
    workspaceId,

    async readText(layer, path) {
      try {
        const handle = await fileHandle(layer, path, false);
        return await (await handle.getFile()).text();
      } catch {
        return null;
      }
    },

    async readBytes(layer, path) {
      try {
        const handle = await fileHandle(layer, path, false);
        return new Uint8Array(await (await handle.getFile()).arrayBuffer());
      } catch {
        return null;
      }
    },

    async writeText(layer, path, text) {
      await writeAll(layer, path, new TextEncoder().encode(text));
    },

    async writeBytes(layer, path, bytes) {
      await writeAll(layer, path, bytes);
    },

    remove(layer, path) {
      return removeAt(layer, path);
    },

    async removePair(path) {
      for (const layer of STORAGE_LAYERS) await removeAt(layer, path);
    },

    async entryKind(layer, path) {
      const { parent, name } = split(storagePath(workspaceId, layer, path));
      let dir: OpfsDirectoryHandle;
      try {
        dir = await resolveDir(parent, false);
      } catch {
        return null;
      }
      try {
        await dir.getFileHandle(name);
        return 'file';
      } catch {
        /* не файл — пробуем каталог */
      }
      try {
        await dir.getDirectoryHandle(name);
        return 'directory';
      } catch {
        return null;
      }
    },

    async size(layer, path) {
      try {
        const handle = await fileHandle(layer, path, false);
        return (await handle.getFile()).size;
      } catch {
        return null;
      }
    },

    async list(layer, dir) {
      const base = normalizePath(dir);
      let handle: OpfsDirectoryHandle;
      try {
        handle = await resolveDir(segmentsOf(storagePath(workspaceId, layer, base)), false);
      } catch (err) {
        // «нет каталога» ≠ «каталог пуст»: по первому Workspace пойдёт в источник.
        if (isMissing(err)) return null;
        throw err;
      }
      const entries: StoredEntry[] = [];
      for await (const entry of handle.values()) {
        entries.push({
          name: entry.name,
          path: base === '' ? entry.name : `${base}/${entry.name}`,
          kind: entry.kind,
        });
      }
      // Порядок обхода OPFS спецификацией не задан, а дерево ресурсов обязано быть стабильным.
      return entries.sort((a, b) => a.name.localeCompare(b.name));
    },

    async listDeep(layer, dir) {
      const base = normalizePath(dir);
      let handle: OpfsDirectoryHandle;
      try {
        handle = await resolveDir(segmentsOf(storagePath(workspaceId, layer, base)), false);
      } catch {
        // Для обхода «нет каталога» и «пусто» — одно и то же: обходить нечего.
        return [];
      }
      const out: string[] = [];
      const walk = async (current: OpfsDirectoryHandle, prefix: string): Promise<void> => {
        for await (const entry of current.values()) {
          const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
          if (entry.kind === 'directory') {
            await walk(entry, path);
            continue;
          }
          if (out.length >= WORKSPACE_WALK_LIMIT) {
            throw new StorageError(
              'walk-budget',
              `обход рабочей области превысил ${WORKSPACE_WALK_LIMIT} файлов — остановлен на ${path}`,
              { path }
            );
          }
          out.push(path);
        }
      };
      await walk(handle, base);
      return out.sort((a, b) => a.localeCompare(b));
    },

    async mkdirp(layer, dir) {
      await resolveDir(segmentsOf(storagePath(workspaceId, layer, dir)), true);
    },

    async clear() {
      try {
        const parent = await resolveDir([WORKSPACE_ROOT_DIR], false);
        await parent.removeEntry(workspaceId, { recursive: true });
      } catch (err) {
        if (isMissing(err)) return;
        throw err;
      }
    },
  };
}

/**
 * Какие рабочие области лежат в OPFS.
 *
 * Нужно уборке: каталоги OPFS живут, пока их не удалить, и в v1 за месяц работы там копились
 * сотни брошенных копий. Отдаёт то, что РЕАЛЬНО лежит на диске, — сверять это с реестром
 * `workspaces` в IndexedDB будет вызывающий. Третьего списка (манифеста в `localStorage`,
 * как в v1) не заводим: он расходится с реальностью ровно тогда, когда сессия падает,
 * то есть именно в том случае, ради которого он и был нужен.
 */
export async function listStoredWorkspaces(
  options: OpfsStoreOptions = {}
): Promise<readonly string[]> {
  const provider = options.directory ?? defaultDirectory;
  let parent: OpfsDirectoryHandle;
  try {
    parent = await (await provider()).getDirectoryHandle(WORKSPACE_ROOT_DIR);
  } catch {
    return [];
  }
  const ids: string[] = [];
  for await (const entry of parent.values()) {
    if (entry.kind === 'directory') ids.push(entry.name);
  }
  return ids.sort((a, b) => a.localeCompare(b));
}
