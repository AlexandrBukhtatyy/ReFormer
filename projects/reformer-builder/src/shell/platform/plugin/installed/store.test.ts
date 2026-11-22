/**
 * Хранилище установленных плагинов и слой файлов над ним — на памятном OPFS.
 *
 * Настоящего OPFS в `node` нет, но подменяется он ЦЕЛИКОМ и структурно (`workspace/storage/
 * testing`), тем же двойником, на котором проверяется хранилище рабочей области. Поэтому
 * проверяется здесь не «вызвали ли мы нужный метод», а поведение: что лежит после установки,
 * что видно после отката, что отвечает слой, когда плагина нет.
 *
 * @module shell/platform/plugin/installed/store.test
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createMemoryOpfs } from '@/shell/platform/workspace/storage/testing';
import type { OpfsDirectoryProvider } from '@/shell/platform/workspace/storage/opfs';
import { isSourceError } from '@/shell/platform/source/errors';
import { createInstalledFiles } from './files';
import { createInstalledPluginStore, type InstalledPluginStore } from './store';

const encoder = new TextEncoder();

const files = (entries: Readonly<Record<string, string>>): Map<string, Uint8Array> =>
  new Map(Object.entries(entries).map(([path, text]) => [path, encoder.encode(text)]));

const manifest = (version: string) =>
  JSON.stringify({ id: 'acme-hello', apiVersion: '^1', main: 'main.js', version });

let store: InstalledPluginStore;
let directory: OpfsDirectoryProvider;

beforeEach(() => {
  const opfs = createMemoryOpfs();
  directory = opfs.directory;
  store = createInstalledPluginStore({ directory });
});

const install = (version: string, extra: Readonly<Record<string, string>> = {}) =>
  store.install({
    id: 'acme-hello',
    package: '@acme/hello',
    version,
    integrity: `sha512-подпись-${version}`,
    registry: 'https://registry.example.org',
    files: files({ 'manifest.json': manifest(version), 'main.js': `код ${version}`, ...extra }),
  });

describe('установка', () => {
  it('кладёт файлы и запоминает, откуда они', async () => {
    await install('1.0.0');

    expect(await store.list()).toEqual([
      {
        id: 'acme-hello',
        package: '@acme/hello',
        version: '1.0.0',
        integrity: 'sha512-подпись-1.0.0',
        registry: 'https://registry.example.org',
        versions: ['1.0.0'],
      },
    ]);
    expect(await store.readFile('acme-hello', 'main.js')).toBe('код 1.0.0');
  });

  it('вложенные каталоги пакета сохраняются', async () => {
    await install('1.0.0', { 'locales/ru.json': '{"a":"б"}' });

    expect(await store.readFile('acme-hello', 'locales/ru.json')).toBe('{"a":"б"}');
    expect([...(await store.listFiles('acme-hello'))].sort()).toEqual([
      'locales/ru.json',
      'main.js',
      'manifest.json',
    ]);
  });

  it('новая версия не затирает прежнюю — иначе откат означал бы «скачайте заново»', async () => {
    await install('1.0.0');
    await install('1.1.0');

    const [record] = await store.list();
    expect(record).toMatchObject({ version: '1.1.0', versions: ['1.0.0', '1.1.0'] });
    expect(await store.readFile('acme-hello', 'main.js')).toBe('код 1.1.0');
  });
});

describe('откат', () => {
  it('переключает действующую версию, ничего не качая', async () => {
    await install('1.0.0');
    await install('1.1.0');

    expect(await store.activate('acme-hello', '1.0.0')).toBe(true);
    expect(await store.readFile('acme-hello', 'main.js')).toBe('код 1.0.0');
  });

  it('версии, которой нет на диске, отказывает', async () => {
    await install('1.0.0');

    expect(await store.activate('acme-hello', '9.9.9')).toBe(false);
  });
});

describe('удаление', () => {
  it('уносит файлы всех версий и запись', async () => {
    await install('1.0.0');
    await install('1.1.0');

    await store.uninstall('acme-hello');

    expect(await store.list()).toEqual([]);
    expect(await store.readFile('acme-hello', 'main.js')).toBeNull();
  });
});

describe('состав читается как данные', () => {
  it('испорченная запись означает «ничего не установлено», а не падение', async () => {
    const root = await (await directory()).getDirectoryHandle('plugins', { create: true });
    const handle = await root.getFileHandle('installed.json', { create: true });
    const writable = await handle.createWritable?.();
    await writable?.write('{ это не json');
    await writable?.close();

    expect(await store.list()).toEqual([]);
  });

  it('без OPFS список пуст, а не исключение', async () => {
    const broken = createInstalledPluginStore({
      directory: () => Promise.reject(new Error('OPFS нет')),
    });

    expect(await broken.list()).toEqual([]);
  });
});

describe('слой файлов для загрузчика', () => {
  const layerOf = (executesCode = true) =>
    createInstalledFiles({ store, executesCode: () => executesCode });

  it('корень слоя перечисляет установленные плагины каталогами', async () => {
    await install('1.0.0');

    expect(await layerOf().list('plugins')).toEqual([
      { name: 'acme-hello', path: 'plugins/acme-hello', kind: 'directory' },
    ]);
  });

  it('каталог плагина отдаёт файлы и подкаталоги одним уровнем', async () => {
    await install('1.0.0', { 'locales/ru.json': '{}' });

    const entries = await layerOf().list('plugins/acme-hello');
    expect([...entries].sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'locales', path: 'plugins/acme-hello/locales', kind: 'directory' },
      { name: 'main.js', path: 'plugins/acme-hello/main.js', kind: 'file' },
      { name: 'manifest.json', path: 'plugins/acme-hello/manifest.json', kind: 'file' },
    ]);
  });

  it('чужой путь — отказ «не найдено», а не пустой список', async () => {
    // Пустой список означал бы «здесь ничего не установлено», и загрузчик принял бы это
    // за правду о слое целиком.
    await expect(layerOf().list('somewhere/else')).rejects.toSatisfy((error: unknown) =>
      isSourceError(error, 'not-found')
    );
  });

  it('право исполнять читается у ПРОЕКТА на каждом обращении', async () => {
    let allowed = false;
    const layer = createInstalledFiles({ store, executesCode: () => allowed });

    expect(layer.capabilities.executesCode).toBe(false);
    allowed = true;
    // Иначе read-only проект стал бы местом, где чужой код всё-таки исполняется: достаточно
    // поставить его из npm вместо того, чтобы положить в папку.
    expect(layer.capabilities.executesCode).toBe(true);
  });
});
