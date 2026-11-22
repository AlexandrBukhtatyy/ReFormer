/**
 * Гибрид транспиляции в настоящем браузере (ReFormer-t3xy).
 *
 * Node-прогон проверяет логику, но не то, ради чего гибрид заведён: что в браузере sucrase
 * приезжает ленивым чанком сборщика, проверка разбора вывода ведёт себя как в Chromium, а
 * `typescript` грузится только при отказе — и тоже приезжает.
 *
 * @module shell/platform/plugin/transpiler-engines.browser.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createModuleLoader } from '@/shell/platform/modules/loader';
import { createTypeScriptSupport } from './typescript-transpiler';
import { createHybridEngine, TYPESCRIPT_ENGINE } from './transpiler-engines';

/** Загрузчик с гибридом, у которого видно, грузился ли `typescript`. */
async function hybridLoader() {
  const loadTypescript = vi.fn(() => TYPESCRIPT_ENGINE.load());
  const engine = createHybridEngine(loadTypescript);
  const loader = createModuleLoader();
  const support = createTypeScriptSupport(loader.transpilers, { transpiler: () => engine.load() });
  await support.ensure(['model.ts']);
  return { loader, loadTypescript };
}

const files = (entries: Record<string, string>): ReadonlyMap<string, string> =>
  new Map(Object.entries(entries));

describe('гибрид транспиляции в браузере', () => {
  it('чистые файлы собирает sucrase, typescript не грузится', async () => {
    const { loader, loadTypescript } = await hybridLoader();

    const result = await loader.load(
      files({
        'model.ts': 'export interface Shape { a: number }\nexport const value: Shape = { a: 1 };',
        'main.ts': "import { value } from './model';\nexport const doubled = value.a * 2;",
      }),
      'main.ts'
    );

    expect(result.errors).toEqual([]);
    expect(result.entry).toMatchObject({ doubled: 2 });
    expect(loadTypescript).not.toHaveBeenCalled();
  });

  it('незакрытая строка — находка typescript с местом, а не SyntaxError исполнения', async () => {
    const { loader, loadTypescript } = await hybridLoader();
    const source = 'export const s = "abc\n;';

    const result = await loader.load(files({ 'broken.ts': source }), 'broken.ts');

    expect(loadTypescript).toHaveBeenCalledTimes(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ file: 'broken.ts', phase: 'transpile' });
    expect(result.errors[0].message).toContain('Unterminated string literal');
    expect(result.errors[0].range?.start).toBeGreaterThan(source.indexOf('"'));
  });
});
