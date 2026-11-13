import { describe, expect, it } from 'vitest';

import { TranspileError } from '@/shell/platform/modules/transpilers';
import {
  createSucraseTranspiler,
  loadSucraseEngine,
  SUCRASE_ENGINE_VERSION,
  SUCRASE_OPTIONS_SIGNATURE,
  SUCRASE_TRANSPILER_ID,
  type SucraseEngine,
  type SucraseOptions,
} from './sucrase-transpiler';

/** Подставной движок: запоминает опции каждого вызова. */
function fakeEngine(
  transform: SucraseEngine['transform'] = (code) => ({ code: `/* js */ ${code}` })
): SucraseEngine & { calls: SucraseOptions[] } {
  const calls: SucraseOptions[] = [];
  return {
    calls,
    transform(code, options) {
      calls.push(options);
      return transform(code, options);
    },
  };
}

const real = async () => createSucraseTranspiler(await loadSucraseEngine());

/** Исполняет CommonJS-вывод с подставным `require` и отдаёт экспорты. */
function evaluate(js: string, modules: Record<string, unknown> = {}): Record<string, unknown> {
  const module = { exports: {} as Record<string, unknown> };
  const require = (specifier: string): unknown => {
    if (!(specifier in modules)) throw new Error(`нет модуля ${specifier}`);
    return modules[specifier];
  };
  new Function('exports', 'require', 'module', js)(module.exports, require, module);
  return module.exports;
}

describe('транспилятор sucrase', () => {
  it('берётся за те же файлы, что и typescript', () => {
    const transpiler = createSucraseTranspiler(fakeEngine());
    expect(transpiler.id).toBe(SUCRASE_TRANSPILER_ID);
    expect(['a.ts', 'b.tsx', 'c.mts', 'D.CTS'].every((file) => transpiler.applies(file))).toBe(
      true
    );
    expect(['a.js', 'b.json', 'c.css'].some((file) => transpiler.applies(file))).toBe(false);
  });

  it('JSX включается только у .tsx: в .ts угловые скобки — приведение типа', () => {
    const engine = fakeEngine();
    const transpiler = createSucraseTranspiler(engine);

    transpiler.transpile('x', 'panel.tsx');
    transpiler.transpile('x', 'model.ts');

    expect(engine.calls[0].transforms).toEqual(['typescript', 'jsx', 'imports']);
    expect(engine.calls[1].transforms).toEqual(['typescript', 'imports']);
  });

  it('подпись опций называет КАЖДУЮ опцию, которая реально уходит в движок', () => {
    const engine = fakeEngine();
    createSucraseTranspiler(engine).transpile('x', 'panel.tsx');

    // Подпись — часть ключа кэша: разойдись она с опциями — кэш отдал бы код, собранный
    // по прежним правилам.
    for (const [option, value] of Object.entries(engine.calls[0])) {
      expect(SUCRASE_OPTIONS_SIGNATURE, option).toContain(`${option}=`);
      if (typeof value !== 'object') {
        expect(SUCRASE_OPTIONS_SIGNATURE, option).toContain(`${option}=${String(value)}`);
      }
    }
  });

  it('версия движка берётся из package.json — она нужна до его загрузки', () => {
    expect(SUCRASE_ENGINE_VERSION).toMatch(/^\d+\.\d+/);
  });

  it('настоящий движок отдаёт CommonJS и снимает типы', async () => {
    const transpiler = await real();
    const { js } = transpiler.transpile(
      'interface Options { a: number }\nexport const options: Options = { a: 1 };',
      'main.ts'
    );

    expect(js).not.toContain('interface');
    expect(evaluate(js)).toMatchObject({ options: { a: 1 } });
  });

  it('импорт только ради типов исчезает, как у typescript', async () => {
    const transpiler = await real();
    const { js } = transpiler.transpile(
      "import { Shape } from './types';\nexport const value: Shape = 1;",
      'model.ts'
    );

    // Иначе линковщик искал бы `./types` — файл, в котором одни типы и которого может не быть.
    expect(js).not.toContain('./types');
    expect(evaluate(js)).toMatchObject({ value: 1 });
  });

  it('JSX — через react/jsx-runtime, а не jsx-dev-runtime, которого нет в реестре', async () => {
    const transpiler = await real();
    const { js } = transpiler.transpile(
      'export const View = (props: { n: number }) => <div className="x">{props.n}</div>;',
      'view.tsx'
    );

    expect(js).toContain('react/jsx-runtime');
    expect(js).not.toContain('jsx-dev-runtime');
    const runtime = { jsx: (type: unknown, props: unknown) => ({ type, props }) };
    const exports = evaluate(js, { 'react/jsx-runtime': runtime });
    expect((exports.View as (p: { n: number }) => unknown)({ n: 1 })).toEqual({
      type: 'div',
      props: { className: 'x', children: 1 },
    });
  });

  it('приведение типа угловыми скобками в .ts читается', async () => {
    const transpiler = await real();
    const { js } = transpiler.transpile('export const n = <number>(1 as unknown);', 'cast.ts');
    expect(evaluate(js)).toMatchObject({ n: 1 });
  });

  it('современный синтаксис остаётся как есть, как у typescript с target=es2022', async () => {
    const transpiler = await real();
    const { js } = transpiler.transpile(
      'export class A { a = 1; #b = 2; get b() { return this.#b; } }\n' +
        'export const f = (o?: { a?: number }) => o?.a ?? 3;',
      'mod.ts'
    );

    expect(js).toContain('?.');
    expect(js).toContain('??');
    expect(js).toContain('#b');
    expect(js).not.toContain('_optionalChain');
    const exports = evaluate(js) as { A: new () => { a: number; b: number }; f: () => number };
    expect(new exports.A()).toMatchObject({ a: 1, b: 2 });
    expect(exports.f()).toBe(3);
  });

  it('импорт по умолчанию из модуля без __esModule получает сам модуль — как esModuleInterop', async () => {
    const transpiler = await real();
    const { js } = transpiler.transpile(
      "import React, { useState } from 'react';\nexport const same = React.useState === useState;",
      'hooks.ts'
    );

    // Реестр оболочки отдаёт пространство имён ESM без пометки `__esModule`.
    const react = { useState: () => undefined };
    expect(evaluate(js, { react })).toMatchObject({ same: true });
  });

  it('синтаксическая ошибка — TranspileError с местом в исходнике и без него в тексте', async () => {
    const transpiler = await real();
    const source = 'const a = ;';

    let caught: unknown;
    try {
      transpiler.transpile(source, 'broken.ts');
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TranspileError);
    const finding = (caught as TranspileError).findings[0];
    expect(finding.range).toEqual({ start: source.indexOf(';'), end: source.indexOf(';') + 1 });
    // Место едет полем — повторять его в тексте значило бы показать его дважды.
    expect(finding.message).not.toMatch(/\(\d+:\d+\)/);
    expect(finding.message).not.toContain('broken.ts');
  });

  it('сбой самого движка, а не синтаксис, пробрасывается как есть', () => {
    const failure = new Error('движок сломан');
    const transpiler = createSucraseTranspiler(
      fakeEngine(() => {
        throw failure;
      })
    );

    expect(() => transpiler.transpile('x', 'a.ts')).toThrow(failure);
  });
});
