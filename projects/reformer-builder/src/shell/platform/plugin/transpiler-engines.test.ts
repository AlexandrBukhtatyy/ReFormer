import { describe, expect, it } from 'vitest';

import { createTranspilerRegistry } from '@/shell/platform/modules/transpilers';
import {
  parseTranspilerChoice,
  SUCRASE_ENGINE,
  transpilerEngine,
  TYPESCRIPT_ENGINE,
} from './transpiler-engines';
import { createTypeScriptSupport } from './typescript-transpiler';

describe('выбор движка транспиляции', () => {
  it('без имени — typescript: эксперимент включают явно', () => {
    expect(transpilerEngine()).toBe(TYPESCRIPT_ENGINE);
    expect(transpilerEngine('typescript')).toBe(TYPESCRIPT_ENGINE);
    expect(transpilerEngine('sucrase')).toBe(SUCRASE_ENGINE);
  });

  it('имя из адреса читается без учёта регистра; незнакомое — движок по умолчанию', () => {
    expect(parseTranspilerChoice('sucrase')).toBe('sucrase');
    expect(parseTranspilerChoice(' Sucrase ')).toBe('sucrase');
    expect(parseTranspilerChoice('typescript')).toBe('typescript');
    expect(parseTranspilerChoice('esbuild')).toBeUndefined();
    expect(parseTranspilerChoice('')).toBeUndefined();
    expect(parseTranspilerChoice(null)).toBeUndefined();
  });

  it('у движков разные подписи кэша: вывод одного не выдаётся за вывод другого', () => {
    expect(SUCRASE_ENGINE.engineId).not.toBe(TYPESCRIPT_ENGINE.engineId);
    expect(SUCRASE_ENGINE.optionsVersion).not.toBe(TYPESCRIPT_ENGINE.optionsVersion);
  });

  it('описатель движка садится в поддержку TypeScript вместо typescript', async () => {
    const registry = createTranspilerRegistry();
    const support = createTypeScriptSupport(registry, { transpiler: () => SUCRASE_ENGINE.load() });

    await support.ensure(['model.ts']);

    expect(registry.list().map((transpiler) => transpiler.id)).toEqual([SUCRASE_ENGINE.engineId]);
    expect(
      registry.find('model.ts')?.transpile('export const a: number = 1;', 'model.ts').js
    ).toContain('exports.a');
    support.dispose();
  });

  it('оба движка дают исполнимый CommonJS из одного исходника', async () => {
    const source =
      "import { helper } from './helper';\n" +
      'enum Kind { A = 1, B }\n' +
      'export const value = helper(Kind.B);';
    for (const engine of [TYPESCRIPT_ENGINE, SUCRASE_ENGINE]) {
      const { js } = (await engine.load()).transpile(source, 'model.ts');
      const module = { exports: {} as Record<string, unknown> };
      const require = (specifier: string): unknown => {
        expect(specifier, engine.engineId).toBe('./helper');
        return { helper: (n: number) => n * 10 };
      };
      new Function('exports', 'require', 'module', js)(module.exports, require, module);
      expect(module.exports, engine.engineId).toMatchObject({ value: 20 });
    }
  });
});
