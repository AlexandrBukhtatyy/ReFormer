/**
 * Тесты хранилища хэндлов — против подставной IndexedDB.
 *
 * Проверяется то, ради чего оно заведено: хэндл переживает «перезагрузку» (новое хранилище
 * над той же базой), ключей может быть много, а отсутствующий ключ — обычный ответ, а не отказ.
 *
 * @module shell/platform/source/fs-handles.test
 */

import { describe, expect, it } from 'vitest';

import type { FsDirectoryHandle } from './fs-access';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';
import { createDirectoryHandleStore } from './fs-handles';

/** Хэндл-пустышка: хранилищу важно только то, что объект доезжает обратно тем же. */
function handle(name: string): FsDirectoryHandle {
  return { kind: 'directory', name } as unknown as FsDirectoryHandle;
}

let seq = 0;

function harness() {
  const { factory } = createMemoryIndexedDb();
  seq += 1;
  const databaseName = `handles-${seq}`;
  return {
    factory,
    databaseName,
    open: () => createDirectoryHandleStore({ factory, databaseName, now: () => seq }),
  };
}

describe('хранилище хэндлов каталогов', () => {
  it('отдаёт положенный хэндл по ключу', async () => {
    const store = harness().open();

    await store.put('k1', handle('project'));

    expect(await store.open('k1')).toMatchObject({ name: 'project' });
  });

  it('неизвестный ключ — это `null`, а не отказ', async () => {
    const store = harness().open();

    await expect(store.open('нет такого')).resolves.toBeNull();
  });

  it('хэндл переживает пересоздание хранилища над той же базой', async () => {
    const { open } = harness();
    const first = open();
    await first.put('k1', handle('project'));
    first.dispose();

    const second = open();

    expect(await second.open('k1')).toMatchObject({ name: 'project' });
  });

  it('повторная запись по тому же ключу заменяет хэндл, а не добавляет второй', async () => {
    const store = harness().open();

    await store.put('k1', handle('старый'));
    await store.put('k1', handle('новый'));

    expect(await store.open('k1')).toMatchObject({ name: 'новый' });
    expect(await store.keys()).toEqual(['k1']);
  });

  it('ключи отдаются свежими первыми', async () => {
    const { factory, databaseName } = harness();
    let clock = 0;
    const store = createDirectoryHandleStore({ factory, databaseName, now: () => (clock += 10) });

    await store.put('старый', handle('a'));
    await store.put('свежий', handle('b'));

    expect(await store.keys()).toEqual(['свежий', 'старый']);
  });

  it('удаление убирает ключ', async () => {
    const store = harness().open();
    await store.put('k1', handle('project'));

    await store.remove('k1');

    expect(await store.open('k1')).toBeNull();
    expect(await store.keys()).toEqual([]);
  });

  it('без IndexedDB хранилище отвечает «ничего нет», а не падает', async () => {
    const store = createDirectoryHandleStore({ factory: undefined });

    await store.put('k1', handle('project'));

    expect(await store.open('k1')).toBeNull();
    expect(await store.keys()).toEqual([]);
  });
});
