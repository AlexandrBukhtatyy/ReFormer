/**
 * Persist каталога-handle в IndexedDB (спека §7.1 Q29): на след. визите — «Переоткрыть <папка>»
 * без повторного пикера. FileSystemDirectoryHandle structured-cloneable, поэтому кладётся в IDB
 * как есть (разрешение всё равно надо будет подтвердить через `ensurePermission`).
 *
 * База и версионирование — общие для билдера ({@link ./idb}).
 *
 * @module reformer-builder/io/handle-store
 */

import { HANDLES_STORE, idbTx } from './idb';

const KEY = 'lastDir';

/** Сохранить handle последнего открытого каталога. */
export async function saveDirHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await idbTx(HANDLES_STORE, 'readwrite', (store) => store.put(handle, KEY));
}

/** Загрузить handle последнего каталога (или `null`). Разрешение подтверждать отдельно. */
export async function loadDirHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await idbTx<FileSystemDirectoryHandle | undefined>(
      HANDLES_STORE,
      'readonly',
      (store) => store.get(KEY)
    );
    return handle ?? null;
  } catch {
    return null;
  }
}

/** Забыть сохранённый каталог. */
export async function clearDirHandle(): Promise<void> {
  await idbTx(HANDLES_STORE, 'readwrite', (store) => store.delete(KEY));
}
