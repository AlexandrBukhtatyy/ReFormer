/**
 * Чтение и исполнение фикстуры: отдельный граф, молчание на отсутствии, находка на сбое.
 *
 * @module plugins/preview/compiling/fixture.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceId } from '@/sdk';
import type { PreviewHost, PreviewModuleGraph, PreviewModules } from '../host';
import { loadFixture } from './fixture';

const DOCUMENT = 'src/forms/credit/schema.json' as unknown as ResourceId;
const FIXTURE_PATH = 'src/forms/credit/fixture.ts';

/** Порт в объёме, которым пользуется загрузка фикстуры. */
function hostWith(files: Record<string, string>): PreviewHost {
  return {
    readText: (id: ResourceId) => {
      const source = files[id as unknown as string];
      if (source === undefined) return Promise.reject(new Error(`нет файла ${String(id)}`));
      return Promise.resolve(source);
    },
    resolveFromRoot: (_anchor: ResourceId, path: string) => path as unknown as ResourceId,
  } as unknown as PreviewHost;
}

/** Загрузчик без транспиляции: фикстуры в тестах написаны на CommonJS. */
const modules: PreviewModules = {
  load: (files, entry) => {
    const source = files.get(entry) ?? '';
    const module: { exports: unknown } = { exports: {} };
    try {
      new Function('exports', 'require', 'module', source)(module.exports, () => ({}), module);
    } catch (error) {
      const graph: PreviewModuleGraph = {
        entry: undefined,
        modules: new Map(),
        errors: [
          {
            file: entry,
            phase: 'evaluate',
            message: error instanceof Error ? error.message : String(error),
          },
        ],
      };
      return Promise.resolve(graph);
    }
    return Promise.resolve({ entry: module.exports, modules: new Map(), errors: [] });
  },
};

describe('загрузка фикстуры', () => {
  it('отсутствие фикстуры — не находка: так живёт большинство форм', async () => {
    const loaded = await loadFixture(
      hostWith({}),
      modules,
      DOCUMENT,
      'src/forms/credit/schema.json'
    );

    expect(loaded.fixture).toBeNull();
    expect(loaded.problems).toEqual([]);
  });

  it('исполняет фикстуру и отдаёт её экспорт', async () => {
    const host = hostWith({
      [FIXTURE_PATH]: 'exports.fixture = { model: { amount: 100 }, dataSources: { CITY: [] } };',
    });

    const loaded = await loadFixture(host, modules, DOCUMENT, 'src/forms/credit/schema.json');

    expect(loaded.fixture?.model).toEqual({ amount: 100 });
    expect(loaded.path).toBe(FIXTURE_PATH);
    expect(loaded.problems).toEqual([]);
  });

  it('файл без нужного экспорта ОБЪЯСНЯЕТСЯ: почти всегда это опечатка в имени', async () => {
    const host = hostWith({ [FIXTURE_PATH]: 'exports.fixtures = { model: {} };' });

    const loaded = await loadFixture(host, modules, DOCUMENT, 'src/forms/credit/schema.json');

    expect(loaded.fixture).toBeNull();
    expect(loaded.problems).toHaveLength(1);
    expect(loaded.problems[0].message).toMatch(/fixture/);
  });

  it('сбой исполнения показывается: файл есть, человек его писал', async () => {
    const host = hostWith({ [FIXTURE_PATH]: 'throw new Error("бабах в фикстуре");' });

    const loaded = await loadFixture(host, modules, DOCUMENT, 'src/forms/credit/schema.json');

    expect(loaded.fixture).toBeNull();
    expect(loaded.problems[0].message).toMatch(/бабах в фикстуре/);
    expect(loaded.problems[0].file).toBe(FIXTURE_PATH);
  });

  it('без порта адресации фикстуры не бывает: композиция вправе её не давать', async () => {
    const host = { readText: () => Promise.resolve('') } as unknown as PreviewHost;

    const loaded = await loadFixture(host, modules, DOCUMENT, 'src/forms/credit/schema.json');

    expect(loaded.fixture).toBeNull();
    expect(loaded.problems).toEqual([]);
  });

  it('без загрузчика модулей фикстура не исполняется вовсе', async () => {
    const host = hostWith({ [FIXTURE_PATH]: 'exports.fixture = { model: {} };' });

    const loaded = await loadFixture(host, undefined, DOCUMENT, 'src/forms/credit/schema.json');

    expect(loaded.fixture).toBeNull();
  });
});
