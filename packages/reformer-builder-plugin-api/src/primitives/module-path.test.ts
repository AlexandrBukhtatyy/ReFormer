import { describe, expect, it } from 'vitest';

import { normalizeModulePath } from './module-path.js';

describe('нормализация пути модуля', () => {
  it('схлопывает . и ..', () => {
    expect(normalizeModulePath('a/./b/../c.ts')).toBe('a/c.ts');
    expect(normalizeModulePath('./model.ts')).toBe('model.ts');
  });

  it('отказывается выйти за корень набора файлов', () => {
    expect(normalizeModulePath('../secrets.ts')).toBeUndefined();
    expect(normalizeModulePath('a/../../b.ts')).toBeUndefined();
  });

  it('приводит обратные слэши к прямым: автор мог написать путь по-виндовски', () => {
    expect(normalizeModulePath('dist\\main.js')).toBe('dist/main.js');
  });
});
