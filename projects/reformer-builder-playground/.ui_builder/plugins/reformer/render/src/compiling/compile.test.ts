/**
 * Компиляция модуля через порт загрузчика: прогрев, один граф, перевод сбоев в находки.
 *
 * @module plugins/reformer/render/compiling/compile.test
 */

import { describe, expect, it } from 'vitest';
import type { PreviewModuleGraph, PreviewModules, PreviewPrimedCompile } from '../host';
import { compileForm, stripFilePrefix } from './compile';
import { PREVIEW_ENTRY_FILE } from './entry';
import { moduleFilesFor, planModule } from './module';

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

describe('compileForm: план модуля', () => {
  /** Набор в раскладке по ролям: страница и сборка приложения лежат рядом с файлами ролей. */
  const ROLES = new Map([
    ['ZayavkaForm.tsx', 'export default function Page() {}'],
    ['application/create.ts', 'export {};'],
    ['application/submit.ts', 'export function wireSubmit() {}'],
    ['api/index.ts', 'export {};'],
    ['behavior/index.ts', 'export function behaviorRules() {}'],
    ['validation/form.ts', 'export const formValidation = {};'],
  ]);

  it('требуются файлы ролей — путём от корня модуля; остальной набор только линкуется', async () => {
    const requested: string[] = [];
    let linked: string[] = [];
    const modules: PreviewModules = {
      load: (files, entry) => {
        const module: { exports: unknown } = { exports: {} };
        const require = (specifier: string): unknown => {
          requested.push(specifier);
          return { from: specifier };
        };
        new Function('exports', 'require', 'module', files.get(entry) ?? '')(
          module.exports,
          require,
          module
        );
        linked = [...files.keys()];
        return Promise.resolve({ entry: module.exports, modules: new Map(), errors: [] });
      },
    };

    const plan = planModule(ROLES.keys(), moduleFilesFor('forms/zayavka/schema/form.schema.json'));
    const result = await compileForm(ROLES, modules, {}, plan);

    expect(requested).toEqual([
      './validation/form.ts',
      './behavior/index.ts',
      './application/submit.ts',
    ]);
    // Набор доходит до линковщика целиком — импорт `../api` из отправки обязан найти свой файл,
    // — кроме страницы и сборки приложения: их превью не исполняет ни при каком импорте.
    expect(linked).toEqual(
      expect.arrayContaining(['api/index.ts', 'application/submit.ts', 'validation/form.ts'])
    );
    expect(linked).not.toContain('ZayavkaForm.tsx');
    expect(linked).not.toContain('application/create.ts');
    expect([...result.modules.keys()]).toEqual([
      'validation/form.ts',
      'behavior/index.ts',
      'application/submit.ts',
    ]);
    expect(result.problems).toEqual([]);
  });

  it('файл из плана, которого нет в наборе, не требуется: об отказе уже сказало чтение', async () => {
    const requested: string[] = [];
    const modules: PreviewModules = {
      load: (files, entry) => {
        const module: { exports: unknown } = { exports: {} };
        new Function('exports', 'require', 'module', files.get(entry) ?? '')(
          module.exports,
          (specifier: string) => {
            requested.push(specifier);
            return {};
          },
          module
        );
        return Promise.resolve({ entry: module.exports, modules: new Map(), errors: [] });
      },
    };
    // План построен по списку каталога; `schema/registry.ts` в нём есть, а прочитать не вышло.
    const plan = planModule([...ROLES.keys(), 'schema/registry.ts']);

    const result = await compileForm(ROLES, modules, {}, plan);

    expect(requested).not.toContain('./schema/registry.ts');
    expect(result.problems).toEqual([]);
  });

  it('набор, из которого нечего требовать, загрузчик не будит', async () => {
    let loads = 0;
    const modules: PreviewModules = {
      load: () => {
        loads += 1;
        return Promise.resolve({ entry: {}, modules: new Map(), errors: [] });
      },
    };
    const onlyTypes = new Map([['types/zayavka.ts', 'export type Zayavka = {};']]);

    const result = await compileForm(
      onlyTypes,
      modules,
      {},
      planModule([...onlyTypes.keys(), 'validation/form.ts'])
    );

    expect(loads).toBe(0);
    expect(result.modules.size).toBe(0);
    expect(result.problems).toEqual([]);
  });

  it('имя точки входа, занятое файлом набора, — отказ, а не перезапись', async () => {
    const taken = new Map([...SOURCES, [PREVIEW_ENTRY_FILE, 'чужой файл']]);
    const result = await compileForm(taken, loader({}), {}, planModule(SOURCES.keys()));
    expect(result.modules.size).toBe(0);
    expect(result.problems).toEqual([
      { file: '', phase: 'resolve', message: expect.stringMatching(/занято/) as string },
    ]);
  });
});

describe('compileForm: текст находки', () => {
  it('имя файла, приписанное линковщиком, снимается: файл несёт отдельное поле', async () => {
    const modules: PreviewModules = {
      load: () =>
        Promise.resolve({
          entry: undefined,
          modules: new Map(),
          errors: [
            {
              file: 'validation.ts',
              phase: 'transpile' as const,
              message: "validation.ts: ')' expected.",
            },
            { file: 'model.ts', phase: 'evaluate' as const, message: 'validation.ts: чужое имя' },
            { file: '', phase: 'resolve' as const, message: ': без файла' },
          ],
        }),
    };
    const result = await compileForm(SOURCES, modules);
    expect(result.problems.map((problem) => problem.message)).toEqual([
      "')' expected.",
      'validation.ts: чужое имя',
      ': без файла',
    ]);
  });

  it('stripFilePrefix снимает ровно своё имя и только с начала', () => {
    expect(stripFilePrefix('a.ts', 'a.ts: x')).toBe('x');
    expect(stripFilePrefix('a.ts', 'y a.ts: x')).toBe('y a.ts: x');
    expect(stripFilePrefix('', ': x')).toBe(': x');
  });
});

describe('compileForm: место находки', () => {
  it('место, названное движком, доезжает до находки превью', async () => {
    const modules: PreviewModules = {
      load: () =>
        Promise.resolve({
          entry: undefined,
          modules: new Map(),
          errors: [
            {
              file: 'validation.ts',
              phase: 'transpile' as const,
              message: 'ожидалась «;»',
              range: { start: 40, end: 41 },
            },
            { file: 'model.ts', phase: 'evaluate' as const, message: 'бросил' },
          ],
        }),
    };
    const result = await compileForm(SOURCES, modules);
    expect(result.problems).toEqual([
      {
        file: 'validation.ts',
        phase: 'transpile',
        message: 'ожидалась «;»',
        range: { start: 40, end: 41 },
      },
      { file: 'model.ts', phase: 'evaluate', message: 'бросил' },
    ]);
  });

  it('сбой, пойманный энтри, несёт фазу, файл-виновник и место, а повтор схлопывается', async () => {
    // Два сайдкара импортируют один битый `./model`: ошибка названа виновником, а не
    // импортёром, и второй раз ничего не добавляет.
    const modules: PreviewModules = {
      load: () =>
        Promise.resolve({
          entry: {
            modules: {},
            errors: [
              {
                file: 'model.ts',
                message: "model.ts: ')' expected.",
                phase: 'transpile' as const,
                range: { start: 7, end: 8 },
              },
              {
                file: 'model.ts',
                message: "model.ts: ')' expected.",
                phase: 'transpile' as const,
                range: { start: 7, end: 8 },
              },
              { file: 'registry.ts', message: 'бросил при исполнении' },
            ],
          },
          modules: new Map(),
          errors: [],
        }),
    };
    const result = await compileForm(SOURCES, modules);
    expect(result.problems).toEqual([
      {
        file: 'model.ts',
        phase: 'transpile',
        message: "')' expected.",
        range: { start: 7, end: 8 },
      },
      { file: 'registry.ts', phase: 'evaluate', message: 'бросил при исполнении' },
    ]);
  });
});
