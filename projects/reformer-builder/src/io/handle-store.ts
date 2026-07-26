/**
 * Persist каталога-handle в IndexedDB (спека §7.1 Q29): на след. визите — «Переоткрыть <папка>»
 * без повторного пикера. FileSystemDirectoryHandle structured-cloneable, поэтому кладётся в IDB
 * как есть (разрешение всё равно надо будет подтвердить через `ensurePermission`).
 *
 * @module reformer-builder/io/handle-store
 */

const DB_NAME = 'reformer-builder';
const STORE = 'handles';
const KEY = 'lastDir';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

/** Сохранить handle последнего открытого каталога. */
export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await tx('readwrite', (store) => store.put(handle, KEY));
}

/** Загрузить handle последнего каталога (или `null`). Разрешение подтверждать отдельно. */
export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await tx<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
      store.get(KEY)
    );
    return handle ?? null;
  } catch {
    return null;
  }
}

/** Забыть сохранённый каталог. */
export async function clearDirHandle(): Promise<void> {
  await tx('readwrite', (store) => store.delete(KEY));
}
