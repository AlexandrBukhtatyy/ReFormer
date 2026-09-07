/**
 * Тесты хранилища содержимого — против подставного дерева из `testing.ts`.
 *
 * OPFS в `node` нет, поэтому проверяется то, что от него не зависит: раскладка на диске
 * (утверждения делаются по снимку дерева, а не по собственному же чтению), выбор ветки записи,
 * политика промаха и поведение пары `files`/`base`.
 *
 * @module shell/platform/workspace/storage/opfs.test
 */

import { describe, expect, it, vi } from 'vitest';

import { isStorageError } from './errors';
import {
  WORKSPACE_WALK_LIMIT,
  createWorkspaceFileStore,
  listStoredWorkspaces,
  opfsSupported,
  type LockRunner,
} from './opfs';
import { createMemoryOpfs, type MemoryOpfs, type SyncAccessMode } from './testing';

function makeStore(syncAccess: SyncAccessMode = 'absent', workspaceId = 'w1') {
  const memory = createMemoryOpfs({ syncAccess });
  const store = createWorkspaceFileStore(workspaceId, { directory: memory.directory });
  return { memory, store };
}

describe('доступность', () => {
  it('в node OPFS нет, и это должно быть видно ДО первой операции', () => {
    // Вызывающий обязан деградировать, а не падать: ответ нужен ему заранее.
    expect(opfsSupported()).toBe(false);
  });

  it('без OPFS запись отказывает объяснимо', async () => {
    const store = createWorkspaceFileStore('w1');
    await expect(store.writeText('files', 'a.ts', 'x')).rejects.toSatisfy((err: unknown) =>
      isStorageError(err, 'opfs-unavailable')
    );
  });

  it('без OPFS чтение — промах, а не отказ', async () => {
    // Читатель уже умеет обрабатывать «этого тут нет»: он пойдёт в источник.
    const store = createWorkspaceFileStore('w1');
    await expect(store.readText('files', 'a.ts')).resolves.toBeNull();
  });
});

describe('раскладка на диске', () => {
  it('кладёт файл по зеркальному пути, а не в плоский каталог', async () => {
    const { memory, store } = makeStore();
    await store.writeText('files', 'src/forms/credit/schema.json', '{}');

    // Проверка идёт по дереву, а не через store.readText: иначе тест прошёл бы и на v1-раскладке.
    expect(Object.keys(memory.files())).toEqual(['ws/w1/files/src/forms/credit/schema.json']);
  });

  it('создаёт недостающие каталоги (mkdir -p) при записи', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'a/b/c/d.ts', 'x');
    expect(await store.entryKind('files', 'a/b/c')).toBe('directory');
    expect(await store.entryKind('files', 'a/b/c/d.ts')).toBe('file');
  });

  it('разводит слои: один и тот же путь — два файла', async () => {
    const { memory, store } = makeStore();
    await store.writeText('files', 'src/a.ts', 'рабочая копия');
    await store.writeText('base', 'src/a.ts', 'как отдал источник');

    expect(memory.files()).toEqual({
      'ws/w1/files/src/a.ts': 'рабочая копия',
      'ws/w1/base/src/a.ts': 'как отдал источник',
    });
    // BASE хранится СОДЕРЖИМЫМ: без исходного текста трёхстороннее слияние невозможно.
    expect(await store.readText('base', 'src/a.ts')).toBe('как отдал источник');
  });

  it('соседние рабочие области не пересекаются', async () => {
    const memory = createMemoryOpfs();
    const first = createWorkspaceFileStore('w1', { directory: memory.directory });
    const second = createWorkspaceFileStore('w2', { directory: memory.directory });
    await first.writeText('files', 'a.ts', 'первая');
    await second.writeText('files', 'a.ts', 'вторая');

    expect(await first.readText('files', 'a.ts')).toBe('первая');
    expect(await second.readText('files', 'a.ts')).toBe('вторая');
    expect(await listStoredWorkspaces({ directory: memory.directory })).toEqual(['w1', 'w2']);
  });
});

describe('чтение и запись', () => {
  it('текст переживает круг', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'a.md', 'строка с эмодзи 🙂');
    expect(await store.readText('files', 'a.md')).toBe('строка с эмодзи 🙂');
  });

  it('байты переживают круг и не портятся', async () => {
    const { store } = makeStore();
    const bytes = new Uint8Array([0, 255, 10, 13, 128]);
    await store.writeBytes('files', 'img.png', bytes);
    expect(await store.readBytes('files', 'img.png')).toEqual(bytes);
  });

  it('перезапись заменяет содержимое целиком, а не дописывает', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'a.ts', 'длинная первая версия');
    await store.writeText('files', 'a.ts', 'вторая');
    expect(await store.readText('files', 'a.ts')).toBe('вторая');
  });

  it('промах чтения — null, а не исключение', async () => {
    const { store } = makeStore();
    expect(await store.readText('files', 'нет-такого.ts')).toBeNull();
    expect(await store.readBytes('files', 'нет/такого.ts')).toBeNull();
    expect(await store.size('files', 'нет-такого.ts')).toBeNull();
    expect(await store.entryKind('files', 'нет-такого.ts')).toBeNull();
  });

  it('размер считается по содержимому в БАЙТАХ, а не в символах', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'a.txt', 'дом'); // 3 символа, 6 байт в UTF-8
    expect(await store.size('files', 'a.txt')).toBe(6);
  });
});

describe('ветки записи', () => {
  it('в Worker пишет синхронным хэндлом под замком', async () => {
    const memory = createMemoryOpfs({ syncAccess: 'available' });
    const locked: string[] = [];
    const lock: LockRunner = (name, body) => {
      locked.push(name);
      return body();
    };
    const store = createWorkspaceFileStore('w1', { directory: memory.directory, lock });

    await store.writeText('files', 'a.ts', 'x');

    expect(memory.writes).toEqual({ sync: 1, writable: 0 });
    // Синхронный хэндл атомарности не даёт — без сериализации две вкладки дали бы битую запись.
    expect(locked).toHaveLength(1);
    expect(locked[0]).toContain('ws/w1/files/a.ts');
  });

  it('на главном потоке падает на writable, когда синхронный хэндл бросает', async () => {
    const memory = createMemoryOpfs({ syncAccess: 'throws' });
    const store = createWorkspaceFileStore('w1', { directory: memory.directory });

    await store.writeText('files', 'a.ts', 'x');

    // Детект «по факту», а не по окружению: метод объявлен, но не работает.
    expect(memory.writes).toEqual({ sync: 0, writable: 1 });
    expect(await store.readText('files', 'a.ts')).toBe('x');
  });

  it('пишет writable там, где синхронного хэндла нет вовсе', async () => {
    const { memory, store } = makeStore('absent');
    await store.writeText('files', 'a.ts', 'x');
    expect(memory.writes).toEqual({ sync: 0, writable: 1 });
  });
});

describe('листинг', () => {
  it('различает «каталога нет» и «каталог пуст»', async () => {
    const { store } = makeStore();
    // Различение несущее: по первому Workspace пойдёт в источник, по второму — нет.
    expect(await store.list('files', 'src')).toBeNull();
    await store.mkdirp('files', 'src');
    expect(await store.list('files', 'src')).toEqual([]);
  });

  it('отдаёт один уровень путями ресурсов и в стабильном порядке', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'src/b.ts', 'b');
    await store.writeText('files', 'src/a.ts', 'a');
    await store.writeText('files', 'src/nested/c.ts', 'c');

    expect(await store.list('files', 'src')).toEqual([
      { name: 'a.ts', path: 'src/a.ts', kind: 'file' },
      { name: 'b.ts', path: 'src/b.ts', kind: 'file' },
      { name: 'nested', path: 'src/nested', kind: 'directory' },
    ]);
  });

  it('обходит поддерево целиком', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'src/a.ts', 'a');
    await store.writeText('files', 'src/deep/b.ts', 'b');
    await store.writeText('base', 'src/a.ts', 'база');

    expect(await store.listDeep('files', 'src')).toEqual(['src/a.ts', 'src/deep/b.ts']);
    expect(await store.listDeep('files', '')).toEqual(['src/a.ts', 'src/deep/b.ts']);
    expect(await store.listDeep('base', '')).toEqual(['src/a.ts']);
  });

  it('отсутствующий каталог обходится как пустой', async () => {
    const { store } = makeStore();
    expect(await store.listDeep('files', 'нет')).toEqual([]);
  });

  it('превышение потолка обхода — отказ, а не молчаливое усечение', async () => {
    const memory = createMemoryOpfs();
    const store = createWorkspaceFileStore('w1', { directory: memory.directory });
    // Наполняем дерево напрямую: через store это была бы проверка скорости, а не поведения.
    const root = await memory.directory();
    const ws = await root.getDirectoryHandle('ws', { create: true });
    const dir = await (
      await (
        await ws.getDirectoryHandle('w1', { create: true })
      ).getDirectoryHandle('files', {
        create: true,
      })
    ).getDirectoryHandle('big', { create: true });
    for (let i = 0; i <= WORKSPACE_WALK_LIMIT; i += 1) {
      await dir.getFileHandle(`f${i}.ts`, { create: true });
    }

    await expect(store.listDeep('files', 'big')).rejects.toSatisfy((err: unknown) =>
      isStorageError(err, 'walk-budget')
    );
  });
});

describe('удаление', () => {
  it('снимает файл, а отсутствие считает достигнутой целью', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'a.ts', 'x');
    await store.remove('files', 'a.ts');
    expect(await store.readText('files', 'a.ts')).toBeNull();
    await expect(store.remove('files', 'a.ts')).resolves.toBeUndefined();
  });

  it('снимает каталог рекурсивно', async () => {
    const { store } = makeStore();
    await store.writeText('files', 'src/deep/a.ts', 'x');
    await store.remove('files', 'src');
    expect(await store.list('files', 'src')).toBeNull();
  });

  it('вытесняет ресурс парой: без BASE слияние стало бы невозможным', async () => {
    const { memory, store } = makeStore();
    await store.writeText('files', 'src/a.ts', 'копия');
    await store.writeText('base', 'src/a.ts', 'база');
    await store.writeText('files', 'src/b.ts', 'сосед');

    await store.removePair('src/a.ts');

    expect(Object.keys(memory.files())).toEqual(['ws/w1/files/src/b.ts']);
  });

  it('очистка сносит свою область и не трогает соседнюю', async () => {
    const memory = createMemoryOpfs();
    const first = createWorkspaceFileStore('w1', { directory: memory.directory });
    const second = createWorkspaceFileStore('w2', { directory: memory.directory });
    await first.writeText('files', 'a.ts', '1');
    await first.writeText('base', 'a.ts', '1');
    await second.writeText('files', 'a.ts', '2');

    await first.clear();

    expect(memory.files()).toEqual({ 'ws/w2/files/a.ts': '2' });
    await expect(first.clear()).resolves.toBeUndefined();
  });
});

describe('корень хранилища', () => {
  it('резолвится один раз и переиспользуется', async () => {
    const memory = createMemoryOpfs();
    const directory = vi.fn(() => memory.directory());
    const store = createWorkspaceFileStore('w1', { directory });

    await store.writeText('files', 'a.ts', 'x');
    await store.readText('files', 'a.ts');
    await store.list('files', '');

    expect(directory).toHaveBeenCalledTimes(1);
  });

  it('неудачный резолв не кэшируется навсегда', async () => {
    const memory = createMemoryOpfs();
    let failed = false;
    const directory = vi.fn(async (): Promise<MemoryOpfs['root']> => {
      if (!failed) {
        failed = true;
        throw new Error('разрешение ещё не выдано');
      }
      return memory.directory();
    });
    const store = createWorkspaceFileStore('w1', { directory });

    await expect(store.writeText('files', 'a.ts', 'x')).rejects.toThrow(/разрешение/);
    await expect(store.writeText('files', 'a.ts', 'x')).resolves.toBeUndefined();
    expect(directory).toHaveBeenCalledTimes(2);
  });
});
