import { describe, expect, it } from 'vitest';

import {
  createLinker,
  evaluateCommonJs,
  ModuleCycleError,
  ModuleLinkError,
  normalizePath,
  resolveFilePath,
  type Linker,
} from './linker';
import { createModuleRegistry, type HostModuleRegistry } from './registry';

/** Линковщик без транспиляции: исходники в фикстурах — уже CommonJS. */
function linkerOf(
  files: Record<string, string>,
  registry: HostModuleRegistry = createModuleRegistry()
): Linker {
  return createLinker({
    files: new Map(Object.entries(files)),
    registry,
    compile: (code) => code,
    knownSpecifiers: () => registry.specifiers(),
  });
}

describe('арифметика путей', () => {
  it('схлопывает . и ..', () => {
    expect(normalizePath('a/./b/../c.ts')).toBe('a/c.ts');
    expect(normalizePath('./model.ts')).toBe('model.ts');
  });

  it('отказывается выйти за корень набора файлов', () => {
    expect(normalizePath('../secrets.ts')).toBeUndefined();
    expect(normalizePath('a/../../b.ts')).toBeUndefined();
  });

  it('дописывает расширение и index', () => {
    const files = new Map([
      ['form/model.ts', ''],
      ['shared/index.ts', ''],
    ]);

    expect(resolveFilePath('./model', 'form/validation.ts', files)).toBe('form/model.ts');
    expect(resolveFilePath('../shared', 'form/validation.ts', files)).toBe('shared/index.ts');
    expect(resolveFilePath('./missing', 'form/validation.ts', files)).toBeUndefined();
  });
});

describe('линковка графа', () => {
  it('связывает два модуля относительным импортом', () => {
    const linker = linkerOf({
      'form/model.ts': 'exports.field = "amount";',
      'form/validation.ts':
        'const model = require("./model");\nexports.rule = "required:" + model.field;',
    });

    const validation = linker.load('form/validation.ts') as { rule: string };

    expect(validation.rule).toBe('required:amount');
    expect([...linker.modules.keys()]).toEqual(['form/model.ts', 'form/validation.ts']);
  });

  it('ходит по каталогам вверх и вниз', () => {
    const linker = linkerOf({
      'shared/api.ts': 'exports.url = "/v1";',
      'form/nested/behavior.ts': 'exports.url = require("../../shared/api").url;',
    });

    expect(linker.load('form/nested/behavior.ts')).toEqual({ url: '/v1' });
  });

  it('исполняет модуль ровно один раз', () => {
    const linker = linkerOf({
      'counter.ts': 'globalThis.__linkerCalls = (globalThis.__linkerCalls || 0) + 1;',
      'a.ts': 'require("./counter"); require("./counter"); exports.ok = true;',
      'b.ts': 'require("./a"); require("./counter"); exports.ok = true;',
    });

    (globalThis as Record<string, unknown>).__linkerCalls = 0;
    linker.load('b.ts');

    expect((globalThis as Record<string, unknown>).__linkerCalls).toBe(1);
  });

  it('получает bare-спецификатор из реестра — тем же объектом', () => {
    const core = { defineForm: () => 'форма' };
    const registry = createModuleRegistry([['@reformer/core', core]]);
    const linker = linkerOf(
      { 'form/model.ts': 'exports.core = require("@reformer/core");' },
      registry
    );

    const model = linker.load('form/model.ts') as { core: unknown };

    expect(model.core).toBe(core);
  });

  it('не догружает неизвестный bare-спецификатор, а объясняет отказ', () => {
    const registry = createModuleRegistry([['react', {}]]);
    const linker = linkerOf({ 'form/model.ts': 'require("lodash");' }, registry);

    let caught: unknown;
    try {
      linker.load('form/model.ts');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ModuleLinkError);
    expect((caught as ModuleLinkError).phase).toBe('resolve');
    expect((caught as ModuleLinkError).file).toBe('form/model.ts');
    expect((caught as ModuleLinkError).message).toMatch(/lodash/);
    expect((caught as ModuleLinkError).message).toMatch(/идентичность/);
    expect((caught as ModuleLinkError).message).toMatch(/Доступны: react/);
  });

  it('называет отсутствующий относительный импорт и перечисляет набор', () => {
    const linker = linkerOf({ 'a.ts': 'require("./nope");' });

    expect(() => linker.load('a.ts')).toThrowError(/a\.ts: импорт «\.\/nope» не найден/);
  });
});

describe('циклический импорт', () => {
  it('даёт внятную ошибку с цепочкой вместо бесконечной рекурсии', () => {
    const linker = linkerOf({
      'a.ts': 'const b = require("./b");\nexports.a = 1;',
      'b.ts': 'const a = require("./a");\nexports.b = 2;',
    });

    let caught: unknown;
    try {
      linker.load('a.ts');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ModuleCycleError);
    expect((caught as ModuleCycleError).message).toContain('a.ts → b.ts → a.ts');
  });

  it('ловит цикл длиннее двух файлов', () => {
    const linker = linkerOf({
      'a.ts': 'require("./b");',
      'b.ts': 'require("./c");',
      'c.ts': 'require("./a");',
    });

    expect(() => linker.load('a.ts')).toThrowError(/a\.ts → b\.ts → c\.ts → a\.ts/);
  });
});

describe('изоляция ошибки модуля', () => {
  it('ошибка исполнения называет файл и фазу', () => {
    const linker = linkerOf({ 'form/behavior.ts': 'throw new Error("бабах");' });

    let caught: unknown;
    try {
      linker.load('form/behavior.ts');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ModuleLinkError);
    expect((caught as ModuleLinkError).file).toBe('form/behavior.ts');
    expect((caught as ModuleLinkError).phase).toBe('evaluate');
    expect((caught as ModuleLinkError).message).toBe('form/behavior.ts: бабах');
    expect((caught as ModuleLinkError).cause).toBeInstanceOf(Error);
  });

  it('называет САМЫЙ ГЛУБОКИЙ файл, а не импортёра', () => {
    const linker = linkerOf({
      'entry.ts': 'require("./middle");',
      'middle.ts': 'require("./deep");',
      'deep.ts': 'throw new Error("сломалось здесь");',
    });

    let caught: unknown;
    try {
      linker.load('entry.ts');
    } catch (error) {
      caught = error;
    }

    expect((caught as ModuleLinkError).file).toBe('deep.ts');
    expect((caught as ModuleLinkError).message).toBe('deep.ts: сломалось здесь');
    expect((caught as ModuleLinkError).chain).toEqual(['entry.ts', 'middle.ts', 'deep.ts']);
  });

  it('ошибка транспиляции помечается фазой transpile', () => {
    const linker = createLinker({
      files: new Map([['a.ts', 'const x: number = 1;']]),
      registry: createModuleRegistry(),
      compile: (_code, fileName) => {
        throw new Error(`${fileName}:1:11 — синтаксис`);
      },
    });

    let caught: unknown;
    try {
      linker.load('a.ts');
    } catch (error) {
      caught = error;
    }

    expect((caught as ModuleLinkError).phase).toBe('transpile');
    expect((caught as ModuleLinkError).file).toBe('a.ts');
  });
});

describe('исполнение CommonJS-конверта', () => {
  it('отдаёт module.exports и подставляет __filename', () => {
    const exports = evaluateCommonJs(
      'module.exports = { where: __filename };',
      () => undefined,
      'form/model.ts'
    );

    expect(exports).toEqual({ where: 'form/model.ts' });
  });

  it('ambient затеняет глобал ЛЕКСИЧЕСКИ, а снаружи ничего не меняет', () => {
    const real = globalThis.fetch;

    const exports = evaluateCommonJs(
      'module.exports = { got: fetch("/x") };',
      () => undefined,
      'form/api.ts',
      { fetch: (url: string) => `подменённый ${url}` }
    );

    expect(exports).toEqual({ got: 'подменённый /x' });
    // Главное свойство: оболочка и соседние вкладки продолжают видеть настоящий `fetch`,
    // и снимать подмену не нужно — снаружи её и не было.
    expect(globalThis.fetch).toBe(real);
  });

  it('без ambient сигнатура модуля прежняя: плагины ничего не замечают', () => {
    const exports = evaluateCommonJs(
      'module.exports = { args: arguments.length };',
      () => undefined,
      'plugin/main.js'
    );

    expect(exports).toEqual({ args: 4 });
  });
});

describe('подстановка модулей', () => {
  const files = new Map([
    ['form/api.ts', 'module.exports.submitForm = function () { return "настоящий"; };'],
    ['form/behavior.ts', 'module.exports.submit = require("./api").submitForm;'],
    ['form/dict-user.ts', 'module.exports.dict = require("@acme/dict");'],
  ]);

  function link(overrides?: ReadonlyMap<string, unknown>) {
    return createLinker({
      files,
      registry: createModuleRegistry(),
      compile: (code) => code,
      overrides,
    });
  }

  it('перекрывает файл, который в наборе ЕСТЬ', () => {
    const linker = link(new Map([['./api', { submitForm: () => 'подменённый' }]]));

    const exports = linker.load('form/behavior.ts') as { submit: () => string };

    // Не лазейка, а суть проверки: настоящий `api.ts` ходил бы в сеть.
    expect(exports.submit()).toBe('подменённый');
  });

  it('закрывает bare-спецификатор, которого в оболочке нет вовсе', () => {
    const linker = link(new Map<string, unknown>([['@acme/dict', { REGIONS: ['Москва'] }]]));

    const exports = linker.load('form/dict-user.ts') as { dict: { REGIONS: string[] } };

    expect(exports.dict.REGIONS).toEqual(['Москва']);
  });

  it('без подстановки неизвестный пакет по-прежнему ОТКАЗ, а не пустышка', () => {
    const linker = link();

    expect(() => linker.load('form/dict-user.ts')).toThrowError(/@acme\/dict/);
  });

  it('подстановка сравнивается со строкой импорта, а не с резолвнутым путём', () => {
    // Человек, писавший фикстуру, видит перед собой `'./api'`, а не `form/api.ts`.
    const byResolvedPath = link(new Map([['form/api.ts', { submitForm: () => 'мимо' }]]));

    const exports = byResolvedPath.load('form/behavior.ts') as { submit: () => string };
    expect(exports.submit()).toBe('настоящий');
  });
});
