/**
 * Тесты пространства имён: корень по умолчанию — `reformer-builder/`, а не корень источника,
 * корень резолвится один раз, а область видимости очистки отвечает по соглашению, не по списку.
 *
 * @module shell/platform/workspace/storage/namespace.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  OPFS_ROOT_DIR,
  STORAGE_NAME_PREFIX,
  builderStorageScope,
  createBuilderDirectoryProvider,
  opfsSupported,
} from './namespace';
import type { OpfsDirectoryHandle } from './opfs';
import { createMemoryOpfs } from './testing';

async function write(dir: OpfsDirectoryHandle, name: string, text: string): Promise<void> {
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable!();
  await writable.write(text);
  await writable.close();
}

describe('builderStorageScope', () => {
  it('в OPFS наш — корневой каталог пространства имён, старая раскладка в корне — нет', () => {
    expect(builderStorageScope('opfs', OPFS_ROOT_DIR)).toBe(true);
    expect(builderStorageScope('opfs', 'ws')).toBe(false);
    expect(builderStorageScope('opfs', 'reformer-forms')).toBe(false);
  });

  it('правило одно на все области: имя целиком либо с префиксом, похожее — чужое', () => {
    for (const area of ['indexeddb', 'cache', 'web-storage'] as const) {
      expect(builderStorageScope(area, `${STORAGE_NAME_PREFIX}workspace`)).toBe(true);
      expect(builderStorageScope(area, 'reformer-builder')).toBe(true);
      expect(builderStorageScope(area, 'reformer-forms_v1')).toBe(false);
      expect(builderStorageScope(area, 'reformer-builder-host')).toBe(false);
    }
  });
});

describe('createBuilderDirectoryProvider', () => {
  it('отдаёт каталог пространства имён внутри корня источника', async () => {
    const opfs = createMemoryOpfs();

    const root = await createBuilderDirectoryProvider(opfs.directory)();
    await write(root, 'a.txt', 'a');

    expect(root.name).toBe(OPFS_ROOT_DIR);
    const own = await opfs.root.getDirectoryHandle(OPFS_ROOT_DIR);
    await expect(own.getFileHandle('a.txt')).resolves.toMatchObject({ name: 'a.txt' });
  });

  it('корень резолвится один раз: все хранилища ждут один промис', async () => {
    const opfs = createMemoryOpfs();
    let calls = 0;
    const provider = createBuilderDirectoryProvider(() => {
      calls += 1;
      return Promise.resolve(opfs.root);
    });

    const [first, second] = await Promise.all([provider(), provider()]);
    await provider();

    expect(calls).toBe(1);
    expect(first).toBe(second);
  });

  it('отказ сбрасывает мемо: следующая попытка идёт заново', async () => {
    const opfs = createMemoryOpfs();
    let attempts = 0;
    const provider = createBuilderDirectoryProvider(() => {
      attempts += 1;
      return attempts === 1
        ? Promise.reject(new Error('нет разрешения'))
        : Promise.resolve(opfs.root);
    });

    await expect(provider()).rejects.toThrow('нет разрешения');
    await expect(provider()).resolves.toMatchObject({ name: OPFS_ROOT_DIR });
    expect(attempts).toBe(2);
  });

  it('старая раскладка переезжает до первого ответа', async () => {
    const opfs = createMemoryOpfs();
    const legacy = await opfs.root.getDirectoryHandle('ws', { create: true });
    const workspace = await legacy.getDirectoryHandle('w1', { create: true });
    await write(await workspace.getDirectoryHandle('files', { create: true }), 'a.json', '{}');

    const root = await createBuilderDirectoryProvider(opfs.directory)();

    const moved = await root
      .getDirectoryHandle('ws')
      .then((dir) => dir.getDirectoryHandle('w1'))
      .then((dir) => dir.getDirectoryHandle('files'))
      .then((dir) => dir.getFileHandle('a.json'));
    expect(await (await moved.getFile()).text()).toBe('{}');
    await expect(opfs.root.getDirectoryHandle('ws')).rejects.toMatchObject({
      name: 'NotFoundError',
    });
  });
});

describe('opfsSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('нет `navigator.storage.getDirectory` — нет OPFS', () => {
    vi.stubGlobal('navigator', {});
    expect(opfsSupported()).toBe(false);
  });

  it('есть — есть', () => {
    vi.stubGlobal('navigator', { storage: { getDirectory: () => Promise.resolve({}) } });
    expect(opfsSupported()).toBe(true);
  });
});
