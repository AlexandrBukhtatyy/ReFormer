/**
 * Общая обвязка IndexedDB билдера: одна база на приложение с двумя хранилищами — `handles`
 * (каталог проекта, {@link ./handle-store}) и `templates` (локальные шаблоны форм,
 * {@link ./template-repo}). Схема поднимается миграциями в `onupgradeneeded`, поэтому уже
 * сохранённый handle каталога переживает добавление шаблонов.
 *
 * @module reformer-builder/io/idb
 */

const DB_NAME = 'reformer-builder';

/** Версия схемы: 1 — только `handles`, 2 — добавлено `templates`. */
const DB_VERSION = 2;

/** Хранилище handle каталога проекта. */
export const HANDLES_STORE = 'handles';

/** Хранилище локальных шаблонов форм (ключ — slug шаблона). */
export const TEMPLATES_STORE = 'templates';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HANDLES_STORE)) db.createObjectStore(HANDLES_STORE);
      if (!db.objectStoreNames.contains(TEMPLATES_STORE)) db.createObjectStore(TEMPLATES_STORE);
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
