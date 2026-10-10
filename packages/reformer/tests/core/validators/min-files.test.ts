/**
 * Правило `minFiles(n)` — файлов не меньше `n` (включительно).
 *
 * Пустые значения, включая `[]`, пропускаются: «нужен хотя бы один файл» выражается связкой
 * `required()` + `minFiles(n)`. Одиночный файл считается как один, не-файлы в массиве не
 * считаются. В замечании — лимит и фактическое число файлов.
 */

import { describe, expect, it } from 'vitest';
import { minFiles } from '../../../src/form/validators/min-files';
import { describeRule } from '../../test-utils/rule-table';

const a = { name: 'a.png', size: 1 };
const b = { name: 'b.pdf' };

describeRule('minFiles — не меньше двух', minFiles(2), [
  { value: [a, b], code: null, label: 'ровно лимит — проходит' },
  { value: [a, b, a], code: null },
  {
    value: a,
    code: 'minFiles',
    params: { minFiles: 2, actualCount: 1 },
    label: 'одиночный файл = 1',
  },
  {
    value: [a, 'мусор'],
    code: 'minFiles',
    params: { minFiles: 2, actualCount: 1 },
    label: 'не-файлы не считаются',
  },
]);

describeRule('minFiles — пустые значения пропускаются', minFiles(2), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  // поведение под вопросом [ReFormer-cnk3]: minFiles([]) пропускает, а minLength(1)([]) даёт замечание — JSDoc
  // minFiles называет связку required() + minFiles(n) «как и у minLength», хотя minLength
  // пустой массив проверяет сам.
  { value: [], code: null, label: 'minFiles([]) — пусто, проверяет required()' },
  { value: ['a', 1], code: null, label: 'массив без файлов — тоже пусто' },
]);

describe('minFiles — опции', () => {
  it('свой код и params; параметры из опций главнее', () => {
    expect(
      minFiles(3, { code: 'docs.minFiles', params: { minFiles: 'три', hint: 1 } })([a])
    ).toEqual({
      code: 'docs.minFiles',
      params: { minFiles: 'три', actualCount: 1, hint: 1 },
    });
  });
});
