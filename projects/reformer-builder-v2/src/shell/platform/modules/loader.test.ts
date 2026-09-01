import { describe, expect, it } from 'vitest';

import { createModuleLoader } from './loader';
import { ModuleRegistryError } from './registry';
import type { Transpiler } from './transpilers';

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
