/**
 * Правило `maxFileSize(bytes)` — размер каждого файла не больше лимита (включительно).
 *
 * Значение — одиночный файл или массив; проверяется каждый файл, в замечание попадает первый
 * нарушивший (`maxFileSize`, `fileName`, `actualSize`). Элементы без числового `size` (дескриптор
 * загруженного файла) и не-файлы в массиве пропускаются; пустые значения — забота `required()`.
 */

import { describe, expect, it } from 'vitest';
import { maxFileSize } from '../../../src/form/validators/max-file-size';
import { describeRule } from '../../test-utils/rule-table';

const file = (name: string, size?: number) => (size === undefined ? { name } : { name, size });

describeRule('maxFileSize — лимит 2000 байт', maxFileSize(2000), [
  { value: file('a.png', 2000), code: null, label: 'ровно лимит — проходит' },
  { value: [file('a.png', 1), file('b.png', 1999)], code: null, label: 'все в лимите' },
  {
    value: file('big.pdf', 2001),
    code: 'maxFileSize',
    params: { maxFileSize: 2000, fileName: 'big.pdf', actualSize: 2001 },
    label: 'одиночный файл на байт больше',
  },
  {
    value: [file('ok.png', 10), file('first.pdf', 5000), file('second.pdf', 9000)],
    code: 'maxFileSize',
    params: { maxFileSize: 2000, fileName: 'first.pdf', actualSize: 5000 },
    label: 'в замечании первый нарушивший',
  },
  {
    value: [file('remote.bin'), 'мусор', file('big.pdf', 2001)],
    code: 'maxFileSize',
    params: { maxFileSize: 2000, fileName: 'big.pdf', actualSize: 2001 },
    label: 'файл без size и не-файл пропускаются',
  },
]);

describeRule('maxFileSize — пустые значения и не-файлы пропускаются', maxFileSize(2000), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: [], code: null },
  { value: [file('remote.bin')], code: null, label: 'только файл без size' },
  { value: ['a', 1], code: null, label: 'массив без файлов' },
  { value: 'не файл', code: null },
  { value: 123, code: null },
]);

describe('maxFileSize — опции', () => {
  it('свой код заменяет встроенный, params дополняют параметры правила', () => {
    const issue = maxFileSize(100, { code: 'passport.maxFileSize', params: { hint: 'сожмите' } })(
      file('scan.jpg', 1000)
    );
    expect(issue).toEqual({
      code: 'passport.maxFileSize',
      params: { maxFileSize: 100, fileName: 'scan.jpg', actualSize: 1000, hint: 'сожмите' },
    });
  });

  it('параметры из опций главнее параметров правила', () => {
    expect(maxFileSize(100, { params: { maxFileSize: '100 Б' } })(file('a', 101))?.params).toEqual({
      maxFileSize: '100 Б',
      fileName: 'a',
      actualSize: 101,
    });
  });
});
