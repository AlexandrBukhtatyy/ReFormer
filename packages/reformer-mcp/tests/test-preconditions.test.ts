/**
 * Условный запуск тестов идёт только через `precondition`: иначе в строгом режиме CI тест снова
 * может молча выключиться из-за отсутствующего артефакта.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { precondition } from './support/preconditions';

describe('precondition', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('вне строгого режима отсутствие артефакта — просто false', () => {
    vi.stubEnv('REFORMER_TEST_STRICT', '');
    expect(precondition('docs', false, 'npm run build')).toBe(false);
  });

  it('в строгом режиме отсутствие артефакта — ошибка с подсказкой', () => {
    vi.stubEnv('REFORMER_TEST_STRICT', '1');
    expect(() => precondition('docs', false, 'npm run build')).toThrow(/«docs».*npm run build/);
    expect(precondition('docs', true, 'npm run build')).toBe(true);
  });

  it('каждый файл с runIf/skipIf берёт условие из precondition', () => {
    const directory = __dirname;
    const conditional = readdirSync(directory)
      .filter((file) => file.endsWith('.test.ts') && file !== 'test-preconditions.test.ts')
      .filter((file) => /\.(runIf|skipIf)\(/.test(readFileSync(resolve(directory, file), 'utf8')));
    expect(conditional.length).toBeGreaterThan(0);
    const unguarded = conditional.filter(
      (file) => !readFileSync(resolve(directory, file), 'utf8').includes('precondition(')
    );
    expect(unguarded).toEqual([]);
  });
});
