/**
 * Компиляция сайдкаров через порт загрузчика: прогрев, один граф, перевод сбоев в находки.
 *
 * @module plugins/preview/compiling/compile.test
 */

import { describe, expect, it } from 'vitest';
import type { PreviewModuleGraph, PreviewModules } from '../host';
import { compileForm } from './compile';
import { PREVIEW_ENTRY_FILE } from './entry';

/** Двойник загрузчика: исполняет энтри тем же способом, что линковщик, и не транспилирует. */
function loader(
  modules: Record<string, unknown>,
  overrides: Partial<PreviewModules> = {}
): PreviewModules {
  return {
    prepare: overrides.prepare,
    load: (files, entry) => {
      const source = files.get(entry);
      if (source === undefined) {
        return Promise.resolve({
          entry: undefined,
          modules: new Map(),
          errors: [{ file: entry, phase: 'resolve' as const, message: 'нет точки входа' }],
        });
      }
      const module: { exports: unknown } = { exports: {} };
      const require = (specifier: string): unknown => {
        const name = specifier.replace('./', '');
        if (!(name in modules)) throw new Error(`нет модуля ${name}`);
        const value = modules[name];
        if (value instanceof Error) throw value;
        return value;
      };
      new Function('exports', 'require', 'module', source)(module.exports, require, module);
      const graph: PreviewModuleGraph = {
        entry: module.exports,
        modules: new Map(),
        errors: [],
      };
      return Promise.resolve(graph);
    },
  };
}

const SOURCES = new Map([
  ['model.ts', 'export const initialFormModel = {};'],
  ['validation.ts', 'export const formValidation = {};'],
]);

describe('compileForm', () => {
  it('пустой набор — законный ответ, а не ошибка', async () => {
    const result = await compileForm(new Map(), loader({}));
    expect(result.modules.size).toBe(0);
    expect(result.problems).toEqual([]);
  });

  it('прогревает движок ВСЕМ набором, включая синтетический энтри', async () => {
    const warmed: string[][] = [];
    const prepare = (names: readonly string[]): Promise<void> => {
      warmed.push([...names]);
      return Promise.resolve();
    };
    await compileForm(SOURCES, loader({ 'model.ts': {}, 'validation.ts': {} }, { prepare }));
    expect(warmed).toHaveLength(1);
    expect(warmed[0]).toContain(PREVIEW_ENTRY_FILE);
    expect(warmed[0]).toContain('model.ts');
  });

  it('отказ прогрева объясняется, а не превращается в «форма не собралась»', async () => {
    const modules = loader(
      {},
      { prepare: () => Promise.reject(new Error('движок не загрузился')) }
    );
    const result = await compileForm(SOURCES, modules);
    expect(result.problems).toEqual([
      {
        file: '',
        phase: 'transpile',
        message: 'движок транспиляции не готов: движок не загрузился',
      },
    ]);
  });

  it('исполненные модули приходят по именам файлов', async () => {
    const result = await compileForm(
      SOURCES,
      loader({ 'model.ts': { initialFormModel: { a: 1 } }, 'validation.ts': {} })
    );
    expect(result.modules.get('model.ts')).toEqual({ initialFormModel: { a: 1 } });
    expect(result.problems).toEqual([]);
  });

  it('сбой одного сайдкара оставляет остальные и называет виновного', async () => {
    const result = await compileForm(
      SOURCES,
      loader({ 'model.ts': { initialFormModel: {} }, 'validation.ts': new Error('битые правила') })
    );
    expect(result.modules.has('model.ts')).toBe(true);
    expect(result.problems).toEqual([
      { file: 'validation.ts', phase: 'evaluate', message: 'битые правила' },
    ]);
  });

  it('бросок загрузчика не роняет превью', async () => {
    const modules: PreviewModules = {
      load: () => {
        throw new Error('линковщик упал');
      },
    };
    const result = await compileForm(SOURCES, modules);
    expect(result.problems).toEqual([{ file: '', phase: 'evaluate', message: 'линковщик упал' }]);
  });

  it('ошибки графа доезжают со своей фазой', async () => {
    const modules: PreviewModules = {
      load: () =>
        Promise.resolve({
          entry: undefined,
          modules: new Map(),
          errors: [{ file: 'model.ts', phase: 'transpile' as const, message: 'синтаксис' }],
        }),
    };
    const result = await compileForm(SOURCES, modules);
    expect(result.problems).toEqual([
      { file: 'model.ts', phase: 'transpile', message: 'синтаксис' },
    ]);
  });
});
