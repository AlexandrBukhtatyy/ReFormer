/**
 * Общая обвязка IndexedDB билдера: одна база на приложение с тремя хранилищами — `handles`
 * (каталог проекта, {@link ./handle-store}), `templates` (локальные шаблоны форм,
 * {@link ./template-repo}) и `drafts` (локальные копии вкладок без файла, {@link ./draft-store}).
 * Схема поднимается миграциями в `onupgradeneeded`, поэтому уже сохранённый handle каталога
 * переживает добавление шаблонов и черновиков.
 *
 * @module reformer-builder/io/idb
 */

const DB_NAME = 'reformer-builder';

/** Версия схемы: 1 — только `handles`, 2 — добавлено `templates`, 3 — добавлено `drafts`. */
const DB_VERSION = 3;

/** Хранилище handle каталога проекта. */
export const HANDLES_STORE = 'handles';

/** Хранилище локальных шаблонов форм (ключ — slug шаблона). */
export const TEMPLATES_STORE = 'templates';

/** Хранилище черновиков — вкладок без файла на диске (ключ — id вкладки). */
export const DRAFTS_STORE = 'drafts';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLES_STORE)) db.createObjectStore(HANDLES_STORE);
      if (!db.objectStoreNames.contains(TEMPLATES_STORE)) db.createObjectStore(TEMPLATES_STORE);
      if (!db.objectStoreNames.contains(DRAFTS_STORE)) db.createObjectStore(DRAFTS_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Выполнить операцию над хранилищем и дождаться её результата. */
export function idbTx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}
