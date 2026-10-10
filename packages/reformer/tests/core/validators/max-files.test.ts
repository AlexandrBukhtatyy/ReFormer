/**
 * Правило `maxFiles(n)` — файлов не больше `n` (включительно).
 *
 * Одиночный файл считается как один; не-файлы в массиве не считаются (их отбрасывает
 * `toFileArray`). Пустые значения пропускаются. В замечании — лимит и фактическое число файлов.
 */

import { describe, expect, it } from 'vitest';
import { maxFiles } from '../../../src/form/validators/max-files';
import { describeRule } from '../../test-utils/rule-table';

const a = { name: 'a.png', size: 1 };
const b = { name: 'b.pdf', size: 2 };
const c = { name: 'c.bin' };

describeRule('maxFiles — не больше двух', maxFiles(2), [
  { value: [a, b], code: null, label: 'ровно лимит — проходит' },
  { value: a, code: null, label: 'одиночный файл = 1' },
  { value: [a, 'мусор', b, null], code: null, label: 'не-файлы не считаются' },
  {
    value: [a, b, c],
    code: 'maxFiles',
    params: { maxFiles: 2, actualCount: 3 },
    label: 'три файла (один без size)',
  },
]);

describeRule('maxFiles — пустые значения и не-файлы пропускаются', maxFiles(0), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: [], code: null },
  { value: ['a', 1], code: null, label: 'массив без файлов' },
  { value: 'a.png', code: null, label: 'строка — не файл' },
]);

describe('maxFiles — опции', () => {
  it('свой код и params; параметры из опций главнее', () => {
    expect(
      maxFiles(1, { code: 'docs.maxFiles', params: { actualCount: 'много', hint: 1 } })([a, b])
    ).toEqual({ code: 'docs.maxFiles', params: { maxFiles: 1, actualCount: 'много', hint: 1 } });
  });
});
