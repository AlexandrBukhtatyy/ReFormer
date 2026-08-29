/**
 * Синтетическая точка входа: один граф на все сайдкары, изоляция сбоя внутри.
 *
 * @module plugins/preview/compiling/entry.test
 */

import { describe, expect, it } from 'vitest';
import { buildEntrySource, PREVIEW_ENTRY_FILE, readEntryExports } from './entry';

/** Исполняет напечатанный энтри так же, как это сделал бы линковщик. */
function run(files: readonly string[], required: Record<string, unknown>): unknown {
  const source = buildEntrySource(files);
  const module: { exports: unknown } = { exports: {} };
  const require = (specifier: string): unknown => {
    const name = specifier.replace('./', '');
    if (!(name in required)) throw new Error(`нет модуля ${name}`);
    const value = required[name];
    if (value instanceof Error) throw value;
    return value;
  };
  new Function('exports', 'require', 'module', source)(module.exports, require, module);
  return module.exports;
}

describe('buildEntrySource', () => {
  it('требует все сайдкары одним графом', () => {
    const exported = readEntryExports(
      run(['model.ts', 'validation.ts'], { 'model.ts': { a: 1 }, 'validation.ts': { b: 2 } })
    );
    expect(exported?.modules).toEqual({ 'model.ts': { a: 1 }, 'validation.ts': { b: 2 } });
    expect(exported?.errors).toEqual([]);
  });

  it('сбой одного файла не лишает превью остальных', () => {
    const exported = readEntryExports(
      run(['model.ts', 'validation.ts'], {
        'model.ts': { a: 1 },
        'validation.ts': new Error('битая схема'),
      })
    );
    expect(exported?.modules).toEqual({ 'model.ts': { a: 1 } });
    expect(exported?.errors).toEqual([{ file: 'validation.ts', message: 'битая схема' }]);
  });

  it('занятое имя точки входа — отказ, а не молчаливая перезапись', () => {
    expect(() => buildEntrySource(['model.ts', PREVIEW_ENTRY_FILE])).toThrow(/занято/);
  });

  it('порядок require совпадает с порядком набора: превью обязано быть воспроизводимым', () => {
    const source = buildEntrySource(['b.ts', 'a.ts']);
    expect(source.indexOf('"./b.ts"')).toBeLessThan(source.indexOf('"./a.ts"'));
  });
});

describe('readEntryExports', () => {
  it('не тот результат — это null, а не приведение', () => {
    expect(readEntryExports(undefined)).toBeNull();
    expect(readEntryExports({ modules: {} })).toBeNull();
    expect(readEntryExports({ modules: {}, errors: [] })).not.toBeNull();
  });
});
