/**
 * Тесты кэша транспиляции.
 *
 * Хранилище здесь — карта в памяти со счётчиками: проверяется не запись на диск (это дело
 * `build-cache`), а то, ради чего кэш существует, — когда он отвечает «движок не нужен»,
 * сколько чтений это стоит и что именно обесценивает правка одного файла.
 *
 * @module shell/platform/modules/compile-cache.test
 */

import { describe, expect, it } from 'vitest';

import type {
  BuildArtifactKind,
  BuildCacheStore,
} from '@/shell/platform/workspace/storage/build-cache';
import { createCompileCache } from './compile-cache';
import { digestAvailable } from './digest';

const IDENTITY = { engineId: 'typescript', engineVersion: '5.9.3', optionsVersion: 'sig-1' };

interface CountingStore extends BuildCacheStore {
  readonly reads: BuildArtifactKind[];
  readonly writes: BuildArtifactKind[];
  readonly data: Map<string, string>;
}

function memoryStore(): CountingStore {
  const data = new Map<string, string>();
  const reads: BuildArtifactKind[] = [];
  const writes: BuildArtifactKind[] = [];
  return {
    workspaceId: 'w1',
    data,
    reads,
    writes,
    read(kind, hash) {
      reads.push(kind);
      return Promise.resolve(data.get(`${kind}:${hash}`) ?? null);
    },
    write(kind, hash, text) {
      writes.push(kind);
      data.set(`${kind}:${hash}`, text);
      return Promise.resolve();
    },
    sweep: () => Promise.resolve({ bytesBefore: 0, removed: 0 }),
    clear: () => Promise.resolve(),
  };
}

const SOURCES = new Map([
  ['model.ts', 'export const initialFormModel = {};'],
  ['validation.ts', 'export const formValidation = {};'],
]);

const COMPILED = new Map([
  ['model.ts', 'exports.initialFormModel = {};'],
  ['validation.ts', 'exports.formValidation = {};'],
]);

describe('окружение', () => {
  it('в node есть чем считать ключ — иначе тесты ниже ничего не проверяют', () => {
    expect(digestAvailable()).toBe(true);
  });
});

describe('кэш транспиляции: первый проход', () => {
  it('на пустом кэше не находит ничего и требует движок', async () => {
    const cache = createCompileCache(memoryStore(), IDENTITY);

    const primed = await cache.prime(SOURCES);

    expect(primed.complete).toBe(false);
    expect(primed.ready.size).toBe(0);
  });

  it('пустой набор не трогает хранилище вовсе', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);

    const primed = await cache.prime(new Map());

    expect(primed.complete).toBe(false);
    expect(store.reads).toEqual([]);
  });

  it('commit кладёт пофайлово и, когда набор собрался целиком, ещё и набором', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);

    const primed = await cache.prime(SOURCES);
    await primed.commit(COMPILED);

    expect(store.writes.filter((kind) => kind === 'file')).toHaveLength(2);
    expect(store.writes.filter((kind) => kind === 'set')).toHaveLength(1);
  });

  it('неполный commit НЕ создаёт набор: бандл, отдающий меньше файлов, хуже промаха', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);

    const primed = await cache.prime(SOURCES);
    await primed.commit(new Map([['model.ts', 'exports.initialFormModel = {};']]));

    expect(store.writes.filter((kind) => kind === 'set')).toHaveLength(0);
  });

  it('чужой файл в commit не записывается под своим ключом', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);

    const primed = await cache.prime(SOURCES);
    await primed.commit(new Map([['посторонний.ts', 'exports.x = 1;']]));

    expect(store.writes).toEqual([]);
  });
});

describe('кэш транспиляции: попадание', () => {
  it('после commit отвечает «движок не нужен» и отдаёт готовый код', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    await (await cache.prime(SOURCES)).commit(COMPILED);

    const primed = await cache.prime(SOURCES);

    // Ради этого ответа кэш и заводился: `false` здесь означал бы 3.5 МБ чанка `typescript`.
    expect(primed.complete).toBe(true);
    expect(primed.ready.get('model.ts')).toBe('exports.initialFormModel = {};');
    expect(primed.ready.get('validation.ts')).toBe('exports.formValidation = {};');
  });

  it('полное попадание стоит ОДНОГО чтения, а не по одному на файл', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    await (await cache.prime(SOURCES)).commit(COMPILED);

    store.reads.length = 0;
    await cache.prime(SOURCES);

    expect(store.reads).toEqual(['set']);
  });

  it('набор собирается и тогда, когда файлы нашлись поштучно', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    await (await cache.prime(SOURCES)).commit(COMPILED);
    // Уносим набор, оставляя пофайловые записи, — так выглядит кэш после вытеснения бандла.
    for (const key of [...store.data.keys()]) if (key.startsWith('set:')) store.data.delete(key);

    store.writes.length = 0;
    const primed = await cache.prime(SOURCES);

    expect(primed.complete).toBe(true);
    // Следующее чтение снова обойдётся одним обращением.
    expect(store.writes).toEqual(['set']);
  });
});

describe('кэш транспиляции: обесценивание', () => {
  it('правка одного файла роняет набор, но НЕ трогает соседей', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    await (await cache.prime(SOURCES)).commit(COMPILED);

    const edited = new Map(SOURCES);
    edited.set('validation.ts', 'export const formValidation = { loanType: [] };');
    const primed = await cache.prime(edited);

    expect(primed.complete).toBe(false);
    // Сосед остался найденным — иначе правка одного сайдкара стоила бы полной пересборки.
    expect(primed.ready.get('model.ts')).toBe('exports.initialFormModel = {};');
    expect(primed.ready.has('validation.ts')).toBe(false);
  });

  it('апгрейд движка обесценивает всё сам, без ручной инвалидации', async () => {
    const store = memoryStore();
    await (await createCompileCache(store, IDENTITY).prime(SOURCES)).commit(COMPILED);

    const upgraded = createCompileCache(store, { ...IDENTITY, engineVersion: '5.10.0' });
    const primed = await upgraded.prime(SOURCES);

    expect(primed.complete).toBe(false);
    expect(primed.ready.size).toBe(0);
  });

  it('смена опций транспиляции обесценивает так же', async () => {
    const store = memoryStore();
    await (await createCompileCache(store, IDENTITY).prime(SOURCES)).commit(COMPILED);

    const retuned = createCompileCache(store, { ...IDENTITY, optionsVersion: 'sig-2' });

    expect((await retuned.prime(SOURCES)).complete).toBe(false);
  });

  it('один и тот же текст в .ts и .tsx — разные ключи: движок решает про JSX по расширению', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    const source = 'export const a = 1;';

    await (await cache.prime(new Map([['a.ts', source]]))).commit(new Map([['a.ts', 'ts']]));
    const primed = await cache.prime(new Map([['a.tsx', source]]));

    expect(primed.complete).toBe(false);
  });

  it('битый бандл ведёт себя как промах, а не как ошибка', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    await (await cache.prime(SOURCES)).commit(COMPILED);
    for (const key of [...store.data.keys()]) {
      if (key.startsWith('set:')) store.data.set(key, '{ это не json');
    }

    const primed = await cache.prime(SOURCES);

    // Пофайловые записи целы, поэтому набор всё равно собирается — просто дороже.
    expect(primed.complete).toBe(true);
  });

  it('бандл прежнего формата не читается', async () => {
    const store = memoryStore();
    const cache = createCompileCache(store, IDENTITY);
    await (await cache.prime(SOURCES)).commit(COMPILED);
    for (const key of [...store.data.keys()]) {
      if (key.startsWith('set:')) store.data.set(key, '{"v":0,"files":{}}');
    }
    for (const key of [...store.data.keys()]) if (key.startsWith('file:')) store.data.delete(key);

    expect((await cache.prime(SOURCES)).complete).toBe(false);
  });
});
