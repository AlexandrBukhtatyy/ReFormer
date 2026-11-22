/**
 * Тесты переноса старой раскладки OPFS.
 *
 * Проверяются свойства, ради которых перенос написан так, как написан: чужое по признакам
 * остаётся на месте, оборванная копия доделывается без перезаписи, отказ одной части
 * не отменяет остальных, а без `createWritable` старое остаётся, и пустышки после себя
 * перенос не оставляет.
 *
 * @module shell/platform/workspace/storage/legacy-layout.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { adoptLegacyLayout } from './legacy-layout';
import type { OpfsDirectoryHandle, OpfsFileHandle } from './opfs';
import { createMemoryOpfs, type MemoryOpfs } from './testing';

const TARGET = 'reformer-builder';

/** Каталог по сегментам, с созданием недостающих. */
async function dirAt(
  root: OpfsDirectoryHandle,
  ...segments: readonly string[]
): Promise<OpfsDirectoryHandle> {
  let dir = root;
  for (const segment of segments) dir = await dir.getDirectoryHandle(segment, { create: true });
  return dir;
}

async function write(dir: OpfsDirectoryHandle, name: string, text: string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable!();
  await writable.write(text);
  await writable.close();
}

/** Текст файла по сегментам без создания; `null` — чего-то на пути нет. */
async function read(root: OpfsDirectoryHandle, ...path: readonly string[]): Promise<string | null> {
  try {
    let dir = root;
    for (const segment of path.slice(0, -1)) dir = await dir.getDirectoryHandle(segment);
    const file = await dir.getFileHandle(path[path.length - 1]!);
    return await (await file.getFile()).text();
  } catch {
    return null;
  }
}

async function names(dir: OpfsDirectoryHandle): Promise<readonly string[]> {
  const list: string[] = [];
  for await (const entry of dir.values()) list.push(entry.name);
  return list.sort();
}

async function setup(): Promise<{ opfs: MemoryOpfs; target: OpfsDirectoryHandle }> {
  const opfs = createMemoryOpfs();
  const target = await opfs.root.getDirectoryHandle(TARGET, { create: true });
  return { opfs, target };
}

/** Полная старая раскладка: две рабочие области, установленный плагин, кэш сборки. */
async function seedLegacy(root: OpfsDirectoryHandle): Promise<void> {
  await write(await dirAt(root, 'ws', 'w1', 'files'), 'a.json', '{"a":1}');
  await write(await dirAt(root, 'ws', 'w1', 'base'), 'a.json', '{"a":0}');
  await write(await dirAt(root, 'ws', 'w2', 'files', 'src'), 'b.ts', 'b');
  await write(await dirAt(root, 'plugins'), 'installed.json', '[]');
  await write(await dirAt(root, 'plugins', 'acme', '1.0.0'), 'index.js', 'acme');
  await write(await dirAt(root, 'build', 'w1', 'v1', 'file', 'ab'), 'hash.js', 'js');
}

describe('adoptLegacyLayout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('рабочие копии и установленные переезжают, кэш сборки удаляется', async () => {
    const { opfs, target } = await setup();
    await seedLegacy(opfs.root);

    await adoptLegacyLayout(opfs.root, target);

    expect(await read(target, 'ws', 'w1', 'files', 'a.json')).toBe('{"a":1}');
    expect(await read(target, 'ws', 'w1', 'base', 'a.json')).toBe('{"a":0}');
    expect(await read(target, 'ws', 'w2', 'files', 'src', 'b.ts')).toBe('b');
    expect(await read(target, 'plugins', 'installed.json')).toBe('[]');
    expect(await read(target, 'plugins', 'acme', '1.0.0', 'index.js')).toBe('acme');
    expect(await names(target)).toEqual(['plugins', 'ws']);
    expect(await names(opfs.root)).toEqual([TARGET]);
  });

  it('повторный запуск ничего не меняет', async () => {
    const { opfs, target } = await setup();
    await seedLegacy(opfs.root);
    await adoptLegacyLayout(opfs.root, target);
    const before = opfs.files();

    await adoptLegacyLayout(opfs.root, target);

    expect(opfs.files()).toEqual(before);
  });

  it('оборванная копия доделывается: непустое не перезаписывается, пустое дописывается', async () => {
    const { opfs, target } = await setup();
    await write(await dirAt(opfs.root, 'ws', 'w1', 'files'), 'a.json', 'OLD');
    await write(await dirAt(opfs.root, 'ws', 'w1', 'files'), 'b.json', 'B');
    await write(await dirAt(target, 'ws', 'w1', 'files'), 'a.json', 'NEW');
    await write(await dirAt(target, 'ws', 'w1', 'files'), 'b.json', '');

    await adoptLegacyLayout(opfs.root, target);

    expect(await read(target, 'ws', 'w1', 'files', 'a.json')).toBe('NEW');
    expect(await read(target, 'ws', 'w1', 'files', 'b.json')).toBe('B');
    expect(await names(opfs.root)).toEqual([TARGET]);
  });

  it('чужое остаётся: область без слоёв, плагины без записи, кэш с не-версией', async () => {
    const { opfs, target } = await setup();
    await write(await dirAt(opfs.root, 'ws', 'foo'), 'readme.txt', 'чужое');
    await write(await dirAt(opfs.root, 'plugins', 'acme'), 'index.js', 'без installed.json');
    await write(await dirAt(opfs.root, 'build', 'w1', 'latest'), 'x', 'не версия');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adoptLegacyLayout(opfs.root, target);

    expect(await names(opfs.root)).toEqual(['build', 'plugins', TARGET, 'ws']);
    expect(await read(opfs.root, 'ws', 'foo', 'readme.txt')).toBe('чужое');
    expect(await names(target)).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('смешанный `ws/`: своё переезжает, чужое и сам каталог остаются', async () => {
    const { opfs, target } = await setup();
    await write(await dirAt(opfs.root, 'ws', 'w1', 'files'), 'a.json', '1');
    await write(await dirAt(opfs.root, 'ws', 'foo'), 'readme.txt', 'чужое');

    await adoptLegacyLayout(opfs.root, target);

    expect(await read(target, 'ws', 'w1', 'files', 'a.json')).toBe('1');
    expect(await names(await opfs.root.getDirectoryHandle('ws'))).toEqual(['foo']);
  });

  it('без `createWritable` старое остаётся на месте, пустышек в новом нет', async () => {
    const { opfs, target } = await setup();
    await write(await dirAt(opfs.root, 'ws', 'w1', 'files'), 'a.json', '1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adoptLegacyLayout(opfs.root, withoutWritable(target));

    expect(warn).toHaveBeenCalledTimes(1);
    expect(await read(opfs.root, 'ws', 'w1', 'files', 'a.json')).toBe('1');
    expect(await names(await dirAt(target, 'ws', 'w1', 'files'))).toEqual([]);
  });

  it('отказ одной части не отменяет остальных', async () => {
    const { opfs, target } = await setup();
    await seedLegacy(opfs.root);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const origin: OpfsDirectoryHandle = {
      ...opfs.root,
      getDirectoryHandle: (name, options) => {
        if (name === 'ws') return Promise.reject(new Error('занято'));
        return opfs.root.getDirectoryHandle(name, options);
      },
      removeEntry: (name, options) => opfs.root.removeEntry(name, options),
      values: () => opfs.root.values(),
    };

    await adoptLegacyLayout(origin, target);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('рабочие копии');
    expect(await read(target, 'plugins', 'installed.json')).toBe('[]');
    expect(await names(opfs.root)).toEqual([TARGET, 'ws']);
  });
});

/** Каталог, чьи файлы не умеют `createWritable` — главный поток движка без поддержки. */
function withoutWritable(dir: OpfsDirectoryHandle): OpfsDirectoryHandle {
  return {
    kind: 'directory',
    name: dir.name,
    getDirectoryHandle: async (name, options) =>
      withoutWritable(await dir.getDirectoryHandle(name, options)),
    getFileHandle: async (name, options) => {
      const handle = await dir.getFileHandle(name, options);
      const readOnly: OpfsFileHandle = {
        kind: 'file',
        name: handle.name,
        getFile: () => handle.getFile(),
      };
      return readOnly;
    },
    removeEntry: (name, options) => dir.removeEntry(name, options),
    values: () => dir.values(),
  };
}
