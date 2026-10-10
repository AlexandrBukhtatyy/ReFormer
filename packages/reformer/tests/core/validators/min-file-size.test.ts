/**
 * Правило `minFileSize(bytes)` — размер каждого файла не меньше лимита (включительно).
 *
 * Типовой сценарий — отсев пустых (0-байтовых) файлов: `minFileSize(1)`. В замечание попадает
 * первый нарушивший (`minFileSize`, `fileName`, `actualSize`); элементы без числового `size` и
 * не-файлы пропускаются, как и пустые значения.
 */

import { describe, expect, it } from 'vitest';
import { minFileSize } from '../../../src/form/validators/min-file-size';
import { describeRule } from '../../test-utils/rule-table';

describeRule('minFileSize — отсев пустых файлов: лимит 1 байт', minFileSize(1), [
  { value: { name: 'one.txt', size: 1 }, code: null, label: 'ровно лимит — проходит' },
  { value: [{ name: 'a.png', size: 1000 }], code: null },
  {
    value: { name: 'empty.txt', size: 0 },
    code: 'minFileSize',
    params: { minFileSize: 1, fileName: 'empty.txt', actualSize: 0 },
    label: 'пустой файл',
  },
  {
    value: [
      { name: 'ok.png', size: 10 },
      { name: 'e1.txt', size: 0 },
      { name: 'e2.txt', size: 0 },
    ],
    code: 'minFileSize',
    params: { minFileSize: 1, fileName: 'e1.txt', actualSize: 0 },
    label: 'в замечании первый нарушивший',
  },
  {
    value: [{ name: 'remote.bin' }, { name: 'e.txt', size: 0 }],
    code: 'minFileSize',
    params: { minFileSize: 1, fileName: 'e.txt', actualSize: 0 },
    label: 'файл без size пропускается',
  },
]);

describeRule('minFileSize — пустые значения и не-файлы пропускаются', minFileSize(1), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: [], code: null },
  { value: { name: 'remote.bin' }, code: null, label: 'файл без size' },
  { value: 0, code: null },
]);

describe('minFileSize — опции', () => {
  it('свой код и params; параметры из опций главнее', () => {
    expect(
      minFileSize(1, { code: 'docs.minFileSize', params: { minFileSize: '1 Б', hint: 'пустой' } })({
        name: 'e.txt',
        size: 0,
      })
    ).toEqual({
      code: 'docs.minFileSize',
      params: { minFileSize: '1 Б', fileName: 'e.txt', actualSize: 0, hint: 'пустой' },
    });
  });
});
