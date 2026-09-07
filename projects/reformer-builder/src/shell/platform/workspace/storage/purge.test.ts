/**
 * Тесты очистки хранилищ.
 *
 * Проверяются ровно те свойства, ради которых модуль написан так, как написан: обход
 * не прерывается на первом отказе, `blocked` — это не отказ, а перечисление баз берётся
 * у движка, когда он умеет перечислять, и у списка, когда не умеет.
 *
 * @module shell/platform/workspace/storage/purge.test
 */

import { describe, expect, it } from 'vitest';

import {
  purgeOriginStorage,
  type PurgeCacheStorage,
  type PurgeIndexedDbFactory,
  type PurgeWebStorage,
} from './purge';
import { createMemoryOpfs } from './testing';

/**
 * Подставная фабрика IndexedDB.
 *
 * Своя, а не `createMemoryIndexedDb` из `testing.ts`: тому нужен только `open`, а здесь
 * важны исходы `deleteDatabase` — успех, отказ и `onblocked`, которых у него нет вовсе.
 */
function fakeIdb(options: {
  readonly names?: readonly string[] | null;
  readonly blocked?: readonly string[];
  readonly failing?: readonly string[];
}): { factory: PurgeIndexedDbFactory; deleted: string[] } {
  const deleted: string[] = [];
  const blocked = new Set(options.blocked ?? []);
  const failing = new Set(options.failing ?? []);

  const factory: PurgeIndexedDbFactory = {
    deleteDatabase(name: string) {
      deleted.push(name);
      const request = {
        error: failing.has(name) ? new Error(`отказ на ${name}`) : null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
      };
      queueMicrotask(() => {
        if (failing.has(name)) request.onerror?.();
        else if (blocked.has(name)) request.onblocked?.();
        else request.onsuccess?.();
      });
      return request as unknown as IDBOpenDBRequest;
    },
  };

  if (options.names !== null && options.names !== undefined) {
    const listed = options.names.map((name) => ({ name }));
    (factory as { databases?: () => Promise<readonly { name?: string }[]> }).databases = () =>
      Promise.resolve(listed);
  }
  return { factory, deleted };
}

describe('purgeOriginStorage', () => {
  it('сносит все записи корня OPFS', async () => {
    const opfs = createMemoryOpfs();
    const root = opfs.root;
    const ws = await root.getDirectoryHandle('ws', { create: true });
    const inner = await ws.getDirectoryHandle('w1', { create: true });
    await (
      await inner.getFileHandle('a.json', { create: true })
    ).createWritable!().then(async (w) => {
      await w.write('{}');
      await w.close();
    });
    await root.getDirectoryHandle('build', { create: true });

    const report = await purgeOriginStorage({ directory: opfs.directory });

    expect(report.failures).toEqual([]);
    expect(report.removed).toBe(2);
    expect(opfs.files()).toEqual({});
  });

  it('отказ на одной записи OPFS не отменяет остальных', async () => {
    const opfs = createMemoryOpfs();
    await opfs.root.getDirectoryHandle('ws', { create: true });
    await opfs.root.getDirectoryHandle('build', { create: true });

    const root = {
      ...opfs.root,
      removeEntry: async (name: string, opts?: { recursive?: boolean }) => {
        if (name === 'ws') throw new Error('занято');
        await opfs.root.removeEntry(name, opts);
      },
      values: () => opfs.root.values(),
    };

    const report = await purgeOriginStorage({ directory: () => Promise.resolve(root) });

    expect(report.removed).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatchObject({ area: 'opfs', name: 'ws' });
    expect(Object.keys(opfs.files())).toEqual([]);
  });

  it('берёт имена баз у движка, когда он умеет перечислять', async () => {
    const { factory, deleted } = fakeIdb({ names: ['a', 'b'] });

    const report = await purgeOriginStorage({
      indexedDb: factory,
      // Список известных НЕ добавляется к ответу движка — иначе «c» удалялась бы дважды.
      knownDatabases: ['c'],
    });

    expect(deleted).toEqual(['a', 'b']);
    expect(report.removed).toBe(2);
  });

  it('берёт имена из списка, когда перечисления в движке нет', async () => {
    const { factory, deleted } = fakeIdb({ names: null });

    await purgeOriginStorage({ indexedDb: factory, knownDatabases: ['a', 'b'] });

    expect(deleted).toEqual(['a', 'b']);
  });

  it('заблокированное удаление — не отказ, а отдельный исход', async () => {
    const { factory } = fakeIdb({ names: ['open', 'free'], blocked: ['open'] });

    const report = await purgeOriginStorage({ indexedDb: factory });

    expect(report.blocked).toEqual(['open']);
    expect(report.failures).toEqual([]);
    expect(report.removed).toBe(1);
  });

  it('отказ удаления базы попадает в отчёт и не прерывает обход', async () => {
    const { factory, deleted } = fakeIdb({ names: ['bad', 'good'], failing: ['bad'] });

    const report = await purgeOriginStorage({ indexedDb: factory });

    expect(deleted).toEqual(['bad', 'good']);
    expect(report.removed).toBe(1);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatchObject({ area: 'indexeddb', name: 'bad' });
  });

  it('чистит Cache Storage и оба веб-хранилища', async () => {
    const removedCaches: string[] = [];
    const caches: PurgeCacheStorage = {
      keys: () => Promise.resolve(['assets', 'modules']),
      delete: (key) => {
        removedCaches.push(key);
        return Promise.resolve(true);
      },
    };
    const cleared: string[] = [];
    const webStorage: readonly PurgeWebStorage[] = [
      {
        name: 'local',
        clear: () => {
          cleared.push('local');
        },
      },
      {
        name: 'session',
        clear: () => {
          cleared.push('session');
        },
      },
    ];

    const report = await purgeOriginStorage({ caches, webStorage });

    expect(removedCaches).toEqual(['assets', 'modules']);
    expect(cleared).toEqual(['local', 'session']);
    expect(report.removed).toBe(4);
    expect(report.failures).toEqual([]);
  });

  it('отсутствующая область не отказ: чего нет, то и очищено', async () => {
    const report = await purgeOriginStorage();

    expect(report).toMatchObject({ removed: 0, blocked: [], failures: [] });
  });

  it('нет OPFS в окружении — не отказ', async () => {
    const missing = (): Promise<never> => {
      const error = new Error('нет OPFS');
      error.name = 'NotFoundError';
      return Promise.reject(error);
    };

    const report = await purgeOriginStorage({ directory: missing });

    expect(report.failures).toEqual([]);
  });
});
