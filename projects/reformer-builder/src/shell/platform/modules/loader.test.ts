import { describe, expect, it } from 'vitest';

import { createModuleLoader } from './loader';
import { lazyBuiltin, ModuleRegistryError } from './registry';
import { TranspileError, type Transpiler } from './transpilers';

/**
 * Фиктивный транспилятор вместо настоящего TypeScript.
 *
 * Вырезает строки, помеченные `//@ts-strip`. Без него такая строка — синтаксическая ошибка,
 * поэтому тест отличает «движок применился» от «повезло».
 */
const tsStripper: Transpiler = {
  id: 'ts-strip',
  applies: (fileName) => fileName.endsWith('.ts'),
  transpile: (code) => ({
    js: code
      .split('\n')
      .filter((line) => !line.trimEnd().endsWith('//@ts-strip'))
      .join('\n'),
  }),
};

const files = (entries: Record<string, string>): ReadonlyMap<string, string> =>
  new Map(Object.entries(entries));

describe('ModuleLoader: транспиляция плюс линковка', () => {
  it('транспилирует .ts и связывает граф от точки входа', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register(tsStripper);

    const result = await loader.load(
      files({
        'form/model.ts': [
          'declare const only: types //@ts-strip',
          'exports.field = "amount";',
        ].join('\n'),
        'form/validation.ts': [
          'type Rule = string //@ts-strip',
          'const model = require("./model");',
          'exports.rule = "required:" + model.field;',
        ].join('\n'),
      }),
      'form/validation.ts'
    );

    expect(result.errors).toEqual([]);
    expect(result.entry).toEqual({ rule: 'required:amount' });
    expect([...result.modules.keys()]).toEqual(['form/model.ts', 'form/validation.ts']);
  });

  it('НЕ трогает файл, для которого applies вернул false', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register(tsStripper);

    // Тот же маркер, но в .js — движок не применяется, и строка остаётся синтаксической ошибкой.
    const result = await loader.load(
      files({ 'plugin/main.js': 'declare const only: types //@ts-strip' }),
      'plugin/main.js'
    );

    expect(result.entry).toBeUndefined();
    expect(result.errors[0].file).toBe('plugin/main.js');
    expect(result.errors[0].phase).toBe('evaluate');
  });

  it('исполняет собранный .js без единого транспилятора', async () => {
    const loader = createModuleLoader();

    const result = await loader.load(
      files({ 'plugin/main.js': 'exports.activate = () => "включён";' }),
      'plugin/main.js'
    );

    expect(result.errors).toEqual([]);
    expect((result.entry as { activate: () => string }).activate()).toBe('включён');
  });

  it('JSON импортируется значением — как схема шага из агрегатора', async () => {
    const loader = createModuleLoader();

    const result = await loader.load(
      files({
        'form/steps/a/form.schema.json': '{ "node": { "component": "$component(Step)" } }',
        'form/steps/index.js': 'exports.step = require("./a/form.schema.json").node.component;',
      }),
      'form/steps/index.js'
    );

    expect(result.errors).toEqual([]);
    expect((result.entry as { step: string }).step).toBe('$component(Step)');
  });

  it('точка входа без расширения резолвится по набору файлов', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register(tsStripper);

    const result = await loader.load(files({ 'main.ts': 'exports.ok = true;' }), 'main');

    expect(result.entry).toEqual({ ok: true });
  });
});

describe('ModuleLoader: реестр модулей', () => {
  it('подставляет коду тот же объект модуля, что загружен в оболочке', async () => {
    const core = { defineForm: () => 'форма' };
    const loader = createModuleLoader({ builtins: [['@reformer/core', core]] });

    const result = await loader.load(
      files({ 'main.js': 'exports.core = require("@reformer/core");' }),
      'main.js'
    );

    expect((result.entry as { core: unknown }).core).toBe(core);
  });

  it('плагин может ДОБАВИТЬ свой модуль', async () => {
    const loader = createModuleLoader();
    loader.registry.register('acme-utils', { greet: () => 'привет' });

    const result = await loader.load(
      files({ 'main.js': 'exports.greeting = require("acme-utils").greet();' }),
      'main.js'
    );

    expect(result.entry).toEqual({ greeting: 'привет' });
  });

  it('плагин НЕ может подменить защищённый модуль', () => {
    const realCore = { tag: 'настоящее ядро' };
    const loader = createModuleLoader({ builtins: [['@reformer/core', realCore]] });

    expect(() => loader.registry.register('@reformer/core', { tag: 'подделка' })).toThrowError(
      ModuleRegistryError
    );
    expect(loader.registry.resolve('@reformer/core', 'main.js')).toBe(realCore);
  });

  it('не догружает неизвестный bare-спецификатор ниоткуда', async () => {
    const loader = createModuleLoader({ builtins: [['react', {}]] });

    const result = await loader.load(files({ 'main.js': 'require("lodash");' }), 'main.js');

    expect(result.entry).toBeUndefined();
    expect(result.errors[0].phase).toBe('resolve');
    expect(result.errors[0].message).toMatch(/lodash/);
  });
});

describe('ModuleLoader: отказы', () => {
  it('ошибка транспиляции называет файл и фазу, а не роняет загрузку', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register({
      id: 'always-fails',
      applies: (fileName) => fileName.endsWith('.ts'),
      transpile: (_code, fileName) => {
        throw new Error(`${fileName}:1:7 — неожиданный токен`);
      },
    });

    const result = await loader.load(files({ 'broken.ts': 'что-то не то' }), 'broken.ts');

    expect(result.entry).toBeUndefined();
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].file).toBe('broken.ts');
    expect(result.errors[0].phase).toBe('transpile');
    expect(result.errors[0].message).toMatch(/broken\.ts/);
  });

  it('ошибка внутри модуля называет файл, а модули до неё остаются доступны', async () => {
    const loader = createModuleLoader();

    const result = await loader.load(
      files({
        'ok.js': 'exports.value = 1;',
        'entry.js': 'require("./ok");\nrequire("./boom");',
        'boom.js': 'throw new Error("бабах");',
      }),
      'entry.js'
    );

    expect(result.errors[0].file).toBe('boom.js');
    expect(result.errors[0].message).toBe('boom.js: бабах');
    expect([...result.modules.keys()]).toEqual(['ok.js']);
  });

  it('циклический импорт даёт внятную ошибку', async () => {
    const loader = createModuleLoader();

    const result = await loader.load(
      files({
        'a.js': 'require("./b");',
        'b.js': 'require("./a");',
      }),
      'a.js'
    );

    expect(result.errors[0].message).toContain('циклический импорт: a.js → b.js → a.js');
  });

  it('ненайденная точка входа — отказ с перечислением набора', async () => {
    const loader = createModuleLoader();

    const result = await loader.load(files({ 'main.js': '' }), 'index.js');

    expect(result.entry).toBeUndefined();
    expect(result.errors[0].phase).toBe('resolve');
    expect(result.errors[0].message).toMatch(/main\.js/);
  });

  it('импорт за пределы набора файлов не резолвится', async () => {
    const loader = createModuleLoader();

    const result = await loader.load(
      files({ 'main.js': 'require("../../etc/secrets");' }),
      'main.js'
    );

    expect(result.errors[0].phase).toBe('resolve');
  });
});

describe('ModuleLoader: место находки движка', () => {
  it('место первой находки с позицией доезжает до ошибки загрузки', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register({
      id: 'positioned',
      applies: (fileName) => fileName.endsWith('.ts'),
      transpile: () => {
        throw new TranspileError([
          { message: 'без места' },
          { message: 'ожидалась «;»', range: { start: 4, end: 5 } },
          { message: 'потом ещё', range: { start: 9, end: 10 } },
        ]);
      },
    });

    const result = await loader.load(files({ 'broken.ts': 'что-то не то' }), 'broken.ts');

    expect(result.errors[0].phase).toBe('transpile');
    // Первая находка С МЕСТОМ, а не первая вообще: у сбоя одно место в плоской структуре,
    // и это то, с которого человек начнёт чинить.
    expect(result.errors[0].range).toEqual({ start: 4, end: 5 });
    expect(result.errors[0].message).toContain('ожидалась «;»');
  });

  it('движок без находок с местом — ошибка без места, как и раньше', async () => {
    const loader = createModuleLoader();
    loader.transpilers.register({
      id: 'plain',
      applies: (fileName) => fileName.endsWith('.ts'),
      transpile: () => {
        throw new Error('просто не вышло');
      },
    });

    const result = await loader.load(files({ 'broken.ts': 'x' }), 'broken.ts');

    expect(result.errors[0].phase).toBe('transpile');
    expect(result.errors[0].range).toBeUndefined();
  });
});

describe('ModuleLoader: отложенный импорт дочитывает граф', () => {
  /** Имя хост-функции — то, которым сборщик плагинов заменяет `import()`. */
  const HOST = '__reformerImport';

  /** «Сеть» теста: отдаёт файл и считает обращения; может отказать заданное число раз. */
  function remote(entries: Record<string, string>, failures: Record<string, number> = {}) {
    const reads: string[] = [];
    const left = { ...failures };
    return {
      reads,
      read: (path: string): Promise<string> => {
        reads.push(path);
        if ((left[path] ?? 0) > 0) {
          left[path] -= 1;
          return Promise.reject(new Error('сеть недоступна'));
        }
        const code = entries[path];
        return code === undefined
          ? Promise.reject(new Error('нет такого файла'))
          : Promise.resolve(code);
      },
    };
  }

  type Lazy = (target: string) => Promise<Record<string, unknown>>;

  it('без параметра lazy хост-функции у модуля нет: форма исполняется как раньше', async () => {
    const result = await createModuleLoader().load(
      files({ 'main.js': `exports.kind = typeof ${HOST};` }),
      'main.js'
    );

    expect(result.entry).toEqual({ kind: 'undefined' });
    expect(result.dispose).toBeUndefined();
  });

  it('читает файл и его замыкание только при первом импорте — и один раз', async () => {
    const net = remote({
      'chunks/engine.js': 'exports.name = "движок:" + require("./shared.js").tag;',
      'chunks/shared.js': 'exports.tag = "общий";',
    });
    const result = await createModuleLoader().load(
      files({ 'main.js': `exports.loadEngine = () => ${HOST}("./chunks/engine.js");` }),
      'main.js',
      {
        lazy: {
          closure: (path) =>
            path === 'chunks/engine.js' ? ['chunks/engine.js', 'chunks/shared.js'] : [path],
          read: net.read,
        },
      }
    );
    expect(result.errors).toEqual([]);
    // До первого обращения не прочитано ничего: ради этого импорт и отложен.
    expect(net.reads).toEqual([]);

    const loadEngine = (result.entry as { loadEngine: () => Promise<{ name: string }> }).loadEngine;
    const [first, second] = await Promise.all([loadEngine(), loadEngine()]);

    expect(first.name).toBe('движок:общий');
    // Два одновременных импорта — одно чтение каждого файла и одно пространство имён.
    expect([...net.reads].sort()).toEqual(['chunks/engine.js', 'chunks/shared.js']);
    expect(second).toBe(first);
    expect(await loadEngine()).toBe(first);
    expect(net.reads).toHaveLength(2);
    expect([...result.modules.keys()].sort()).toEqual([
      'chunks/engine.js',
      'chunks/shared.js',
      'main.js',
    ]);
  });

  it('уже исполненный общий файл не исполняется второй раз', async () => {
    const net = remote({
      'chunks/engine.js': 'exports.seen = require("./state.js").touch();',
    });
    const result = await createModuleLoader().load(
      files({
        'main.js': [
          'const state = require("./chunks/state.js");',
          'exports.first = state.touch();',
          `exports.loadEngine = () => ${HOST}("./chunks/engine.js");`,
        ].join('\n'),
        'chunks/state.js': 'let count = 0; exports.touch = () => ++count;',
      }),
      'main.js',
      { lazy: { closure: (path) => [path, 'chunks/state.js'], read: net.read } }
    );

    const entry = result.entry as { first: number; loadEngine: () => Promise<{ seen: number }> };
    const engine = await entry.loadEngine();

    // Счётчик один на граф: дочитанный файл получил тот же модуль состояния.
    expect(entry.first).toBe(1);
    expect(engine.seen).toBe(2);
    expect(net.reads).toEqual(['chunks/engine.js']);
  });

  it('отказ чтения не запоминается: повторный импорт читает заново', async () => {
    const net = remote({ 'chunks/engine.js': 'exports.ok = true;' }, { 'chunks/engine.js': 1 });
    const result = await createModuleLoader().load(
      files({ 'main.js': `exports.loadEngine = () => ${HOST}("./chunks/engine.js");` }),
      'main.js',
      { lazy: { read: net.read } }
    );
    const loadEngine = (result.entry as { loadEngine: () => Promise<{ ok: boolean }> }).loadEngine;

    const failure = await loadEngine().catch((error: unknown) => error);

    expect(failure).toMatchObject({
      name: 'ModuleLinkError',
      phase: 'resolve',
      file: 'chunks/engine.js',
    });
    expect((failure as Error).message).toContain('сеть недоступна');
    expect((await loadEngine()).ok).toBe(true);
    expect(net.reads).toEqual(['chunks/engine.js', 'chunks/engine.js']);
  });

  it('импорт на верхнем уровне модуля не принимается за циклический', async () => {
    // Дочитанный файл ссылается обратно на точку входа. Исполнись он синхронно из её тела,
    // линковщик увидел бы цикл; после асинхронной границы точка входа уже исполнена.
    const result = await createModuleLoader().load(
      files({
        'main.js': [
          'exports.base = "основа";',
          `exports.pending = ${HOST}("./chunks/late.js");`,
        ].join('\n'),
        'chunks/late.js': 'exports.text = require("../main.js").base + "+позже";',
      }),
      'main.js',
      { lazy: {} }
    );

    expect(result.errors).toEqual([]);
    const late = await (result.entry as { pending: Promise<{ text: string }> }).pending;
    expect(late.text).toBe('основа+позже');
  });

  it('без read граф — только прочитанное заранее: отсутствующий файл — отказ импорта', async () => {
    const result = await createModuleLoader().load(
      files({
        'main.js': `exports.load = (target) => ${HOST}(target);`,
        'chunks/here.js': 'exports.here = true;',
      }),
      'main.js',
      { lazy: {} }
    );
    const load = (result.entry as { load: Lazy }).load;

    expect((await load('./chunks/here.js')).here).toBe(true);
    await expect(load('./chunks/absent.js')).rejects.toMatchObject({ phase: 'resolve' });
    await expect(load('../outside.js')).rejects.toMatchObject({ phase: 'resolve' });
    await expect(load('')).rejects.toMatchObject({ phase: 'resolve' });
  });

  it('данные получают default, модуль из ESM — свои экспорты', async () => {
    const result = await createModuleLoader().load(
      files({
        'main.js': `exports.load = (target) => ${HOST}(target);`,
        'chunks/corpus.js': 'module.exports = { title: "Справка" };',
        'chunks/engine.js':
          'Object.defineProperty(exports, "__esModule", { value: true }); exports.default = "движок";',
      }),
      'main.js',
      { lazy: {} }
    );
    const load = (result.entry as { load: Lazy }).load;

    expect((await load('./chunks/corpus.js')).default).toEqual({ title: 'Справка' });
    expect((await load('./chunks/engine.js')).default).toBe('движок');
  });

  it('prepare зовётся перед исполнением — с файлами замыкания', async () => {
    const order: string[] = [];
    const net = remote({
      'chunks/engine.js': 'exports.done = globalThis.__lazyOrder.push("код");',
    });
    (globalThis as { __lazyOrder?: string[] }).__lazyOrder = order;
    try {
      const result = await createModuleLoader().load(
        files({ 'main.js': `exports.loadEngine = () => ${HOST}("./chunks/engine.js");` }),
        'main.js',
        {
          lazy: {
            read: net.read,
            prepare: (paths) => {
              order.push(`прогрев:${paths.join(',')}`);
              return Promise.resolve();
            },
          },
        }
      );

      await (result.entry as { loadEngine: () => Promise<unknown> }).loadEngine();

      expect(order).toEqual(['прогрев:chunks/engine.js', 'код']);
    } finally {
      delete (globalThis as { __lazyOrder?: string[] }).__lazyOrder;
    }
  });

  it('пакет оболочки греется в момент импорта, а не при загрузке', async () => {
    let loads = 0;
    const loader = createModuleLoader({
      builtins: [
        [
          'heavy-kit',
          lazyBuiltin(() => {
            loads += 1;
            return Promise.resolve({ Button: 'кнопка' });
          }),
        ],
      ],
    });
    const result = await loader.load(
      files({ 'main.js': `exports.load = (target) => ${HOST}(target);` }),
      'main.js',
      { lazy: {} }
    );
    const load = (result.entry as { load: Lazy }).load;
    expect(loads).toBe(0);

    const kit = await load('heavy-kit');

    expect(kit.Button).toBe('кнопка');
    expect(loads).toBe(1);
    expect(await load('heavy-kit')).toBe(kit);
    await expect(load('unknown-package')).rejects.toMatchObject({ phase: 'resolve' });
  });

  it('выгруженный граф импорт отвергает — и начатое до выгрузки чтение не исполняется', async () => {
    let release = (): void => {};
    const executed: string[] = [];
    (globalThis as { __lazyExecuted?: string[] }).__lazyExecuted = executed;
    try {
      const result = await createModuleLoader().load(
        files({ 'main.js': `exports.loadEngine = () => ${HOST}("./chunks/engine.js");` }),
        'main.js',
        {
          lazy: {
            read: () =>
              new Promise<string>((resolve) => {
                release = () => resolve('globalThis.__lazyExecuted.push("движок");');
              }),
          },
        }
      );
      const loadEngine = (result.entry as { loadEngine: () => Promise<unknown> }).loadEngine;

      const pending = loadEngine().catch((error: unknown) => error);
      // Чтение начато: дать хост-функции дойти до него.
      await new Promise((resolve) => setTimeout(resolve, 0));
      result.dispose?.();
      release();

      expect(await pending).toMatchObject({ name: 'ModuleLinkError', phase: 'resolve' });
      expect(executed).toEqual([]);
      await expect(loadEngine()).rejects.toMatchObject({ phase: 'resolve' });
    } finally {
      delete (globalThis as { __lazyExecuted?: string[] }).__lazyExecuted;
    }
  });
});

describe('ModuleLoader: отказ отложенного импорта и дочитка заранее', () => {
  const HOST = '__reformerImport';
  const main = `exports.load = (target) => ${HOST}(target);`;
  type Lazy = (target: string) => Promise<Record<string, unknown>>;

  it('об отказе импорта узнаёт и владелец графа, а не только вызвавший код', async () => {
    const errors: unknown[] = [];
    const result = await createModuleLoader().load(
      files({ 'main.js': main, 'chunks/broken.js': 'throw new Error("код упал");' }),
      'main.js',
      {
        lazy: {
          read: () => Promise.reject(new Error('сеть недоступна')),
          onError: (error) => errors.push(error),
        },
      }
    );
    const load = (result.entry as { load: Lazy }).load;

    await expect(load('./chunks/absent.js')).rejects.toMatchObject({ phase: 'resolve' });
    await expect(load('./chunks/broken.js')).rejects.toMatchObject({ phase: 'evaluate' });
    await expect(load('unknown-package')).rejects.toMatchObject({ phase: 'resolve' });

    expect(errors.map((error) => (error as { phase: string }).phase)).toEqual([
      'resolve',
      'evaluate',
      'resolve',
    ]);
  });

  it('импорт из выгруженного графа — не сбой: владельцу о нём не сообщается', async () => {
    const errors: unknown[] = [];
    const result = await createModuleLoader().load(files({ 'main.js': main }), 'main.js', {
      lazy: { onError: (error) => errors.push(error) },
    });
    const load = (result.entry as { load: Lazy }).load;

    result.dispose?.();

    await expect(load('./chunks/any.js')).rejects.toMatchObject({ phase: 'resolve' });
    expect(errors).toEqual([]);
  });

  it('дочитка заранее читает файлы, не исполняя, — импорт потом не ходит в сеть', async () => {
    const reads: string[] = [];
    const executed: string[] = [];
    (globalThis as { __preloadExecuted?: string[] }).__preloadExecuted = executed;
    try {
      const result = await createModuleLoader().load(files({ 'main.js': main }), 'main.js', {
        lazy: {
          read: (path) => {
            reads.push(path);
            return Promise.resolve(
              `globalThis.__preloadExecuted.push(${JSON.stringify(path)}); exports.ok = true;`
            );
          },
        },
      });
      const load = (result.entry as { load: Lazy }).load;

      await result.preload?.(['chunks/engine.js', 'chunks/data.js', 'main.js']);

      // Прочитано только недостающее, и ничего не исполнено.
      expect(reads.sort()).toEqual(['chunks/data.js', 'chunks/engine.js']);
      expect(executed).toEqual([]);

      expect((await load('./chunks/engine.js')).ok).toBe(true);
      expect(executed).toEqual(['chunks/engine.js']);
      expect(reads).toHaveLength(2);
    } finally {
      delete (globalThis as { __preloadExecuted?: string[] }).__preloadExecuted;
    }
  });

  it('отказ дочитки молчит: файл прочтёт сам импорт — и тогда скажет', async () => {
    let online = false;
    const errors: unknown[] = [];
    const result = await createModuleLoader().load(files({ 'main.js': main }), 'main.js', {
      lazy: {
        read: () =>
          online ? Promise.resolve('exports.ok = true;') : Promise.reject(new Error('нет сети')),
        onError: (error) => errors.push(error),
      },
    });
    const load = (result.entry as { load: Lazy }).load;

    await expect(result.preload?.(['chunks/engine.js'])).resolves.toBeUndefined();
    expect(errors).toEqual([]);

    online = true;
    expect((await load('./chunks/engine.js')).ok).toBe(true);
  });

  it('после выгрузки дочитка ничего не читает', async () => {
    const reads: string[] = [];
    const result = await createModuleLoader().load(files({ 'main.js': main }), 'main.js', {
      lazy: {
        read: (path) => {
          reads.push(path);
          return Promise.resolve('exports.ok = true;');
        },
      },
    });

    result.dispose?.();
    await result.preload?.(['chunks/engine.js']);

    expect(reads).toEqual([]);
  });
});
