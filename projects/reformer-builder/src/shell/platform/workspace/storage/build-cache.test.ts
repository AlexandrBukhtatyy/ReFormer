/**
 * Тесты кэша сборки — против того же подставного дерева, что и хранилище рабочей копии.
 *
 * Проверяется не «читается ли записанное» (это свойство подставного дерева), а то, ради чего
 * модуль написан: раскладка на диске, отказ по битому ключу, политика промаха и порядок
 * вытеснения.
 *
 * @module shell/platform/workspace/storage/build-cache.test
 */

import { describe, expect, it } from 'vitest';

import {
  BUILD_CACHE_VERSION,
  BUILD_ROOT_DIR,
  createBuildCacheStore,
  listStoredBuildCaches,
} from './build-cache';
import { createMemoryOpfs } from './testing';

/** 64 hex-знака: ровно то, что отдаёт `digestHex`. */
const hash = (seed: string): string => seed.repeat(64).slice(0, 64);

const A = hash('a');
const B = hash('b');

function makeStore(workspaceId = 'w1') {
  const memory = createMemoryOpfs();
  return { memory, store: createBuildCacheStore(workspaceId, { directory: memory.directory }) };
}

describe('кэш сборки: раскладка', () => {
  it('лежит рядом с рабочей областью, а не внутри неё', async () => {
    const { memory, store } = makeStore();

    await store.write('file', A, 'exports.a = 1;');

    const paths = Object.keys(memory.files());
    expect(paths).toEqual([`${BUILD_ROOT_DIR}/w1/${BUILD_CACHE_VERSION}/file/aa/${A}.js`]);
    // Слои рабочей копии парные, и кэш в эту пару не входит — иначе сломались бы
    // `counterpartLayer` и вытеснение парой.
    expect(paths.some((p) => p.startsWith('ws/'))).toBe(false);
  });

  it('набор и файл лежат врозь и различаются расширением', async () => {
    const { memory, store } = makeStore();

    await store.write('file', A, 'exports.a = 1;');
    await store.write('set', A, '{"v":1,"files":{}}');

    expect(Object.keys(memory.files()).sort()).toEqual([
      `${BUILD_ROOT_DIR}/w1/${BUILD_CACHE_VERSION}/file/aa/${A}.js`,
      `${BUILD_ROOT_DIR}/w1/${BUILD_CACHE_VERSION}/set/aa/${A}.json`,
    ]);
  });

  it('шардирует по двум знакам хеша: обход каталога нужен уборке', async () => {
    const { memory, store } = makeStore();

    await store.write('file', A, 'a');
    await store.write('file', B, 'b');

    const shards = Object.keys(memory.files()).map((p) => p.split('/')[4]);
    expect(shards.sort()).toEqual(['aa', 'bb']);
  });

  it('разные рабочие области не пересекаются', async () => {
    const memory = createMemoryOpfs();
    const first = createBuildCacheStore('w1', { directory: memory.directory });
    const second = createBuildCacheStore('w2', { directory: memory.directory });

    await first.write('file', A, 'первая');
    await second.write('file', A, 'вторая');

    expect(await first.read('file', A)).toBe('первая');
    expect(await second.read('file', A)).toBe('вторая');
  });
});

describe('кэш сборки: чтение и запись', () => {
  it('промах отдаёт null, а не бросает', async () => {
    const { store } = makeStore();

    expect(await store.read('file', A)).toBeNull();
    expect(await store.read('set', A)).toBeNull();
  });

  it('записанное читается тем же ключом', async () => {
    const { store } = makeStore();

    await store.write('file', A, 'exports.a = 1;');

    expect(await store.read('file', A)).toBe('exports.a = 1;');
    // Вид — часть адреса: тот же ключ в другом виде это другая запись.
    expect(await store.read('set', A)).toBeNull();
  });

  it('ОТВЕРГАЕТ ключ не той формы: из него строится путь', async () => {
    const { memory, store } = makeStore();

    for (const bad of ['../../etc/passwd', 'ABCDEF', '', 'a'.repeat(63), 'a'.repeat(65)]) {
      await store.write('file', bad, 'зло');
      expect(await store.read('file', bad)).toBeNull();
    }
    // Ничего не записалось — путь наружу кэша не построить.
    expect(Object.keys(memory.files())).toEqual([]);
  });

  it('отказ записи проглатывается: кэш не обязан получиться', async () => {
    const store = createBuildCacheStore('w1', {
      directory: () => Promise.reject(new Error('OPFS недоступен')),
    });

    await expect(store.write('file', A, 'x')).resolves.toBeUndefined();
    expect(await store.read('file', A)).toBeNull();
  });
});

describe('кэш сборки: уборка', () => {
  it('в пределах бюджета не трогает ничего', async () => {
    const { store } = makeStore();
    await store.write('file', A, '0123456789');

    const result = await store.sweep(1024);

    expect(result).toEqual({ bytesBefore: 10, removed: 0 });
    expect(await store.read('file', A)).toBe('0123456789');
  });

  it('сверх бюджета удаляет, пока не уложится', async () => {
    const { store } = makeStore();
    await store.write('file', A, '0123456789');
    await store.write('file', B, '0123456789');

    const result = await store.sweep(10);

    expect(result.bytesBefore).toBe(20);
    expect(result.removed).toBe(1);
    // Ровно один выжил: уборка снимает лишнее, а не чистит всё подряд.
    const survivors = [await store.read('file', A), await store.read('file', B)].filter(
      (value) => value !== null
    );
    expect(survivors).toHaveLength(1);
  });

  it('уборка пустого кэша безвредна', async () => {
    const { store } = makeStore();

    expect(await store.sweep(0)).toEqual({ bytesBefore: 0, removed: 0 });
  });
});

describe('кэш сборки: снос', () => {
  it('clear уносит только свою область', async () => {
    const memory = createMemoryOpfs();
    const first = createBuildCacheStore('w1', { directory: memory.directory });
    const second = createBuildCacheStore('w2', { directory: memory.directory });
    await first.write('file', A, 'первая');
    await second.write('file', A, 'вторая');

    await first.clear();

    expect(await first.read('file', A)).toBeNull();
    expect(await second.read('file', A)).toBe('вторая');
  });

  it('снос отсутствующего — уже достигнутая цель', async () => {
    const { store } = makeStore();

    await expect(store.clear()).resolves.toBeUndefined();
  });

  it('перечисляет области, оставившие кэш: уборке нужно знать про брошенные', async () => {
    const memory = createMemoryOpfs();
    await createBuildCacheStore('w2', { directory: memory.directory }).write('file', A, 'x');
    await createBuildCacheStore('w1', { directory: memory.directory }).write('file', A, 'x');

    expect(await listStoredBuildCaches({ directory: memory.directory })).toEqual(['w1', 'w2']);
  });

  it('без единого кэша список пуст, а не ошибка', async () => {
    const memory = createMemoryOpfs();

    expect(await listStoredBuildCaches({ directory: memory.directory })).toEqual([]);
  });
});
