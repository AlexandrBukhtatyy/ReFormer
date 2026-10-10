/**
 * Правило `maxTotalFileSize(bytes)` — суммарный размер файлов не больше лимита (включительно).
 *
 * Складываются `size` всех файлов значения; элементы без числового `size` в сумму не входят,
 * не-файлы отбрасываются. Пустые значения пропускаются. В замечании — лимит и фактическая сумма.
 */

import { describe, expect, it } from 'vitest';
import { maxTotalFileSize } from '../../../src/form/validators/max-total-file-size';
import { describeRule } from '../../test-utils/rule-table';

const png = { name: 'photo.png', size: 1000, type: 'image/png' };
const pdf = { name: 'doc.pdf', size: 5000, type: 'application/pdf' };
const remote = { name: 'remote.bin' };

describeRule('maxTotalFileSize — лимит 6000 байт', maxTotalFileSize(6000), [
  { value: [png, pdf], code: null, label: 'сумма ровно 6000 — проходит' },
  { value: pdf, code: null, label: 'одиночный файл' },
  { value: [png, remote, 'мусор'], code: null, label: 'без size и не-файлы в сумму не входят' },
  {
    value: [png, pdf, { name: 'one.txt', size: 1 }],
    code: 'maxTotalFileSize',
    params: { maxTotalFileSize: 6000, actualTotal: 6001 },
    label: 'сумма 6001',
  },
  {
    value: { name: 'huge.iso', size: 7000 },
    code: 'maxTotalFileSize',
    params: { maxTotalFileSize: 6000, actualTotal: 7000 },
    label: 'одиночный файл больше лимита',
  },
]);

describeRule('maxTotalFileSize — пустые значения и не-файлы пропускаются', maxTotalFileSize(0), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: [], code: null },
  { value: [remote], code: null, label: 'только файл без size — сумма 0' },
  { value: 42, code: null },
]);

describe('maxTotalFileSize — опции', () => {
  it('свой код и params; параметры из опций главнее', () => {
    expect(
      maxTotalFileSize(100, { code: 'docs.total', params: { maxTotalFileSize: '100 Б', hint: 1 } })(
        [png]
      )
    ).toEqual({
      code: 'docs.total',
      params: { maxTotalFileSize: '100 Б', actualTotal: 1000, hint: 1 },
    });
  });
});
