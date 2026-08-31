/**
 * Компиляция сайдкаров через порт загрузчика: прогрев, один граф, перевод сбоев в находки.
 *
 * @module plugins/preview/compiling/compile.test
 */

import { describe, expect, it } from 'vitest';
import type { PreviewModuleGraph, PreviewModules, PreviewPrimedCompile } from '../host';
import { compileForm } from './compile';
import { PREVIEW_ENTRY_FILE } from './entry';

/** Прогрев, который ничего не нашёл: движок нужен, писать пока нечего. */
function primed(): PreviewPrimedCompile {
  return { ready: new Map(), complete: false, commit: () => Promise.resolve() };
}

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

  it('прогревает ВСЕМ набором, включая синтетический энтри', async () => {
    const warmed: string[][] = [];
    const prepare = (files: ReadonlyMap<string, string>): Promise<PreviewPrimedCompile> => {
      warmed.push([...files.keys()]);
      return Promise.resolve(primed());
    };
    await compileForm(SOURCES, loader({ 'model.ts': {}, 'validation.ts': {} }, { prepare }));
    expect(warmed).toHaveLength(1);
    expect(warmed[0]).toContain(PREVIEW_ENTRY_FILE);
    expect(warmed[0]).toContain('model.ts');
  });

  it('отдаёт прогретый код линковщику, а собранное — обратно в кэш', async () => {
    const ready = new Map([['model.ts', 'exports.initialFormModel = {};']]);
    const committed: ReadonlyMap<string, string>[] = [];
    const seen: (ReadonlyMap<string, string> | undefined)[] = [];

    const modules: PreviewModules = {
      prepare: () =>
        Promise.resolve({
          ready,
          complete: false,
          commit: (compiled) => {
            committed.push(compiled);
            return Promise.resolve();
          },
        }),
      load: (files, entry, options) => {
        seen.push(options?.ready);
        const source = files.get(entry) ?? '';
        const module: { exports: unknown } = { exports: {} };
        new Function('exports', 'require', 'module', source)(module.exports, () => ({}), module);
        return Promise.resolve({
          entry: module.exports,
          modules: new Map(),
          errors: [],
          compiled: new Map([['validation.ts', 'exports.formValidation = {};']]),
        });
      },
    };

    await compileForm(SOURCES, modules);

    expect(seen[0]).toBe(ready);
    // Запись идёт следующим тиком: показ формы не ждёт OPFS.
    await Promise.resolve();
    expect(committed).toHaveLength(1);
    expect([...committed[0].keys()]).toEqual(['validation.ts']);
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
