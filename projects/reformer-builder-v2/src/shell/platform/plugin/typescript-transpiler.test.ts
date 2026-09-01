import { describe, expect, it, vi } from 'vitest';

import { createTranspilerRegistry } from '../modules/transpilers';
import {
  createTypeScriptSupport,
  createTypeScriptTranspiler,
  isTypeScriptFile,
  TYPESCRIPT_ENGINE_VERSION,
  TYPESCRIPT_OPTIONS_SIGNATURE,
  TYPESCRIPT_TRANSPILER_ID,
  type TypeScriptEngine,
} from './typescript-transpiler';

/** Подставной движок: четыре поля — всё, чем этот модуль пользуется. */
function fakeEngine(
  overrides: Partial<TypeScriptEngine> = {}
): TypeScriptEngine & { calls: { code: string; options: Record<string, unknown> }[] } {
  const calls: { code: string; options: Record<string, unknown> }[] = [];
  return {
    calls,
    ModuleKind: { CommonJS: 1 },
    ScriptTarget: { ES2022: 9 },
    JsxEmit: { ReactJSX: 4 },
    transpileModule(code, options) {
      calls.push({ code, options: options.compilerOptions ?? {} });
      return { outputText: `/* js */ ${code}` };
    },
    ...overrides,
  };
}

describe('транспилятор TypeScript', () => {
  it('берётся только за файлы, которые без него не прочитать', () => {
    expect(['main.ts', 'panel.tsx', 'a.mts', 'B.CTS'].every(isTypeScriptFile)).toBe(true);
    expect(['main.js', 'main.mjs', 'styles.css', 'manifest.json'].some(isTypeScriptFile)).toBe(
      false
    );
  });

  it('просит у движка ровно тот формат модуля, который понимает линковщик', () => {
    const engine = fakeEngine();

    createTypeScriptTranspiler(engine).transpile('export const a = 1;', 'main.ts');

    // CommonJS — не вкус: линковщик подставляет коду свои `require`/`module`, и модуль
    // в любом другом формате до них просто не дойдёт.
    expect(engine.calls[0].options).toMatchObject({
      module: engine.ModuleKind.CommonJS,
      jsx: engine.JsxEmit.ReactJSX,
      jsxImportSource: 'react',
      isolatedModules: true,
    });
  });

  it('подпись опций называет КАЖДУЮ опцию, которая реально уходит в движок', () => {
    const engine = fakeEngine();
    createTypeScriptTranspiler(engine).transpile('export const a = 1;', 'main.ts');

    // Подпись — часть ключа кэша транспиляции. Разойдись она с опциями — кэш отдал бы код,
    // собранный по прежним правилам, и понять это по поведению формы было бы нельзя.
    for (const option of Object.keys(engine.calls[0].options)) {
      expect(TYPESCRIPT_OPTIONS_SIGNATURE, option).toContain(`${option}=`);
    }
  });

  it('версия движка берётся из package.json — она нужна до его загрузки', () => {
    // Ключ кэша обязан быть известен ДО `import('typescript')`, иначе экономить нечего:
    // движок уже приехал.
    expect(TYPESCRIPT_ENGINE_VERSION).toMatch(/^\d+\.\d+/);
  });

  it('находки движка становятся исключением с их текстом', () => {
    const engine = fakeEngine({
      transpileModule: () => ({
        outputText: '',
        diagnostics: [{ messageText: 'ожидалась «}»' }],
      }),
    });

    expect(() => createTypeScriptTranspiler(engine).transpile('x', 'main.ts')).toThrow(
      'ожидалась «}»'
    );
  });

  it('настоящий движок отдаёт CommonJS и снимает типы', async () => {
    const registry = createTranspilerRegistry();
    const support = createTypeScriptSupport(registry);

    await support.ensure(['main.ts']);
    const transpiler = registry.find('main.ts');
    const output = transpiler?.transpile(
      'interface Options { a: number }\nexport const options: Options = { a: 1 };',
      'main.ts'
    );

    expect(output?.js).toContain('exports.options');
    expect(output?.js).not.toContain('interface');
    support.dispose();
  });
});

describe('прогрев движка', () => {
  it('без единого .ts движок не грузится вовсе', async () => {
    const registry = createTranspilerRegistry();
    const load = vi.fn<() => Promise<TypeScriptEngine>>();
    const support = createTypeScriptSupport(registry, { load });

    await support.ensure(['main.js', 'panel.js', 'manifest.json']);

    expect(load).not.toHaveBeenCalled();
    expect(registry.list()).toEqual([]);
    expect(support.needed(['main.js'])).toBe(false);
  });

  it('грузится один раз и регистрируется один раз', async () => {
    const registry = createTranspilerRegistry();
    const load = vi.fn(() => Promise.resolve(fakeEngine() as TypeScriptEngine));
    const support = createTypeScriptSupport(registry, { load });

    await Promise.all([support.ensure(['main.ts']), support.ensure(['panel.tsx'])]);
    await support.ensure(['other.ts']);

    // Повторная регистрация под тем же id — ошибка реестра, а вторая загрузка движка —
    // вторая копия компилятора в памяти. Прогрев обязан быть идемпотентным.
    expect(load).toHaveBeenCalledOnce();
    expect(registry.list().map((t) => t.id)).toEqual([TYPESCRIPT_TRANSPILER_ID]);
  });

  it('отказ загрузки движка доезжает до вызывающего', async () => {
    const registry = createTranspilerRegistry();
    const support = createTypeScriptSupport(registry, {
      load: () => Promise.reject(new Error('чанк не приехал')),
    });

    await expect(support.ensure(['main.ts'])).rejects.toThrow('чанк не приехал');
    expect(registry.list()).toEqual([]);
  });

  it('dispose снимает регистрацию', async () => {
    const registry = createTranspilerRegistry();
    const support = createTypeScriptSupport(registry, {
      load: () => Promise.resolve(fakeEngine() as TypeScriptEngine),
    });

    await support.ensure(['main.ts']);
    support.dispose();

    expect(registry.find('main.ts')).toBeUndefined();
  });
});
