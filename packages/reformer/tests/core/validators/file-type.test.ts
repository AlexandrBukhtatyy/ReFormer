/**
 * Правило `fileType(accept)` — тип каждого файла по строке в синтаксисе атрибута `accept`.
 *
 * Нативный `accept` — лишь подсказка диалогу выбора (drag-and-drop его не учитывает), поэтому
 * правило проверяет каждый файл: расширения, точные MIME, `категория/*`, список через запятую,
 * пробелы и регистр не важны. В замечании — `accept` как задан и имя первого неподходящего файла.
 */

import { describe, expect, it } from 'vitest';
import { fileType } from '../../../src/form/validators/file-type';
import { describeRule } from '../../test-utils/rule-table';

const png = { name: 'photo.PNG', size: 1000, type: 'image/png' };
const pdf = { name: 'doc.pdf', size: 5000, type: 'application/pdf' };
const exe = { name: 'setup.exe', size: 10, type: 'application/x-msdownload' };

describeRule('fileType — image/* и .pdf', fileType('image/*,.pdf'), [
  { value: [png, pdf], code: null, label: 'все подходят' },
  { value: png, code: null, label: 'одиночный файл' },
  {
    value: [png, exe, { name: 'b.exe' }],
    code: 'fileType',
    params: { accept: 'image/*,.pdf', fileName: 'setup.exe' },
    label: 'в замечании первый неподходящий',
  },
  {
    value: { name: 'scan' },
    code: 'fileType',
    params: { accept: 'image/*,.pdf', fileName: 'scan' },
    label: 'без расширения и type',
  },
]);

describeRule('fileType — пробелы и регистр в accept', fileType(' IMAGE/* , .PDF '), [
  { value: [png, pdf], code: null },
  { value: exe, code: 'fileType', params: { accept: ' IMAGE/* , .PDF ', fileName: 'setup.exe' } },
]);

describeRule('fileType — пустой accept пропускает всё', fileType(''), [
  { value: [png, pdf, exe], code: null },
]);

describeRule('fileType — пустые значения и не-файлы пропускаются', fileType('.pdf'), [
  { value: null, code: null },
  { value: undefined, code: null },
  { value: '', code: null },
  { value: [], code: null },
  { value: ['doc.exe'], code: null, label: 'массив строк — не файлы' },
  { value: 'doc.exe', code: null, label: 'строка — не файл' },
]);

describe('fileType — опции', () => {
  it('свой код и params; параметры из опций главнее', () => {
    expect(
      fileType('.pdf', { code: 'docs.fileType', params: { accept: 'PDF', hint: 1 } })(exe)
    ).toEqual({ code: 'docs.fileType', params: { accept: 'PDF', fileName: 'setup.exe', hint: 1 } });
  });
});
