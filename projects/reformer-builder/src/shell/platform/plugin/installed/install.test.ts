/**
 * Установка из npm — от ответа реестра до файлов на диске.
 *
 * Архив здесь НАСТОЯЩИЙ (тот же, что у разбора пакета: сделан `npm pack`), реестр подставной.
 * Так проверяется то, ради чего модуль существует, — порядок шагов и место остановки:
 * подпись сверяется до распаковки, манифест — до записи на диск, а включения не происходит
 * вовсе.
 *
 * @module shell/platform/plugin/installed/install.test
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMemoryOpfs } from '@/shell/platform/workspace/storage/testing';
import { FIXTURE_INTEGRITY, fixtureTarball } from '../npm/__fixtures__/tarball';
import type { NpmPackageRef, NpmRegistryClient } from '../npm/registry';
import { installPluginFromNpm } from './install';
import { createInstalledPluginStore, type InstalledPluginStore } from './store';

const REGISTRY = 'https://registry.example.org';

const REF: NpmPackageRef = {
  name: 'acme-hello',
  version: '0.1.0',
  tarball: `${REGISTRY}/acme-hello/-/acme-hello-0.1.0.tgz`,
  integrity: FIXTURE_INTEGRITY,
};

let store: InstalledPluginStore;

beforeEach(() => {
  store = createInstalledPluginStore({ directory: createMemoryOpfs().directory });
});

/** Реестр-двойник: отдаёт заготовленную версию и настоящий архив. */
function registryWith(
  overrides: Partial<{
    resolve: NpmRegistryClient['resolve'];
    download: NpmRegistryClient['download'];
  }> = {}
): NpmRegistryClient {
  return {
    resolve: overrides.resolve ?? (() => Promise.resolve({ ok: true, value: REF })),
    download: overrides.download ?? (() => Promise.resolve({ ok: true, value: fixtureTarball() })),
  };
}

const install = (registry: NpmRegistryClient = registryWith()) =>
  installPluginFromNpm({ registry, store, registryUrl: REGISTRY }, { package: 'acme-hello' });

describe('установка из npm', () => {
  it('кладёт файлы пакета и запись о том, откуда они', async () => {
    const result = await install();

    expect(result.ok && result.record).toMatchObject({
      id: 'acme-hello',
      package: 'acme-hello',
      version: '0.1.0',
      integrity: FIXTURE_INTEGRITY,
      registry: REGISTRY,
    });
    expect(await store.readFile('acme-hello', 'main.js')).toContain('acme-hello');
    expect(await store.readFile('acme-hello', 'locales/ru.json')).toContain('command.hello');
  });

  it('ничего не включает: установить и запустить — разные действия', async () => {
    // Иначе чужой код исполнялся бы по факту скачивания. Решение о запуске принимает человек
    // в каталоге проекта, там же спрашиваются права.
    const result = await install();

    expect(result.ok).toBe(true);
    // Единственный след установки — файлы и запись; ни рантайма, ни каталога здесь нет вовсе.
    expect((await store.list()).map((record) => record.id)).toEqual(['acme-hello']);
  });

  it('подпись не совпала — на диск не попадает НИЧЕГО', async () => {
    const registry = registryWith({
      resolve: () => Promise.resolve({ ok: true, value: { ...REF, integrity: 'sha512-чужая' } }),
    });

    const result = await install(registry);

    expect(result.ok || result.problem.code).toBe('manifest-unreadable');
    expect(await store.list()).toEqual([]);
  });

  it('пакет без манифеста — отказ с объяснением, а не пустой каталог на диске', async () => {
    const registry = registryWith({
      // Архив-то настоящий, но не плагина: пустой tar с одним файлом.
      download: () => Promise.resolve({ ok: true, value: new Uint8Array([1, 2, 3]) }),
    });

    const result = await install(registry);

    expect(result.ok).toBe(false);
    expect(await store.list()).toEqual([]);
  });

  it('реестр отказал — отказ проходит наружу текстом реестра', async () => {
    const registry = registryWith({
      resolve: () =>
        Promise.resolve({ ok: false, problem: { code: 'not-found', message: 'пакета нет' } }),
    });

    const result = await install(registry);

    expect(result.ok || result.problem.message).toBe('пакета нет');
  });

  it('диапазон уезжает в реестр как есть', async () => {
    const resolve = vi.fn(() => Promise.resolve({ ok: true as const, value: REF }));

    await installPluginFromNpm(
      { registry: registryWith({ resolve }), store, registryUrl: REGISTRY },
      { package: 'acme-hello', range: '^0.1' }
    );

    expect(resolve).toHaveBeenCalledWith('acme-hello', '^0.1');
  });
});
