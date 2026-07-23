/**
 * File-валидаторы: maxFileSize / minFileSize / fileType / maxFiles / minFiles /
 * maxTotalFileSize + утилиты isFileLike / matchesFileAccept / toFileArray.
 *
 * Валидаторы duck-typed ({@link FileLike}): работают и с нативным `File`, и с
 * сериализуемым дескриптором загруженного файла (`{id, name, size?, type?}`), поэтому
 * тесты гоняются на plain-объектах — `File` из jsdom не нужен.
 */

import { describe, it, expect } from 'vitest';
import {
  maxFileSize,
  minFileSize,
  fileType,
  maxFiles,
  minFiles,
  maxTotalFileSize,
  isFileLike,
  matchesFileAccept,
  toFileArray,
} from '../../../src/form/validation/validators';

type Rule = (value: unknown) => { code: string; params?: Record<string, unknown> } | null;

const png = { name: 'photo.PNG', size: 1000, type: 'image/png' };
const pdf = { name: 'doc.pdf', size: 5000, type: 'application/pdf' };
const noSize = { name: 'remote.bin' }; // дескриптор без size/type (preloaded RemoteFileRef)

describe('file-utils', () => {
  it('isFileLike: объект с name — файлоподобен, прочее — нет', () => {
    expect(isFileLike(png)).toBe(true);
    expect(isFileLike(noSize)).toBe(true);
    expect(isFileLike({ name: 42 })).toBe(false);
    expect(isFileLike({ name: 'x', size: 'big' })).toBe(false);
    expect(isFileLike(null)).toBe(false);
    expect(isFileLike('file.txt')).toBe(false);
  });

  it('toFileArray: одиночный → массив, массив фильтруется, прочее → null', () => {
    expect(toFileArray(png)).toEqual([png]);
    expect(toFileArray([png, 'мусор', pdf])).toEqual([png, pdf]);
    expect(toFileArray('str')).toBeNull();
    expect(toFileArray(123)).toBeNull();
  });

  it('matchesFileAccept: расширение, точный MIME, wildcard, список, регистр', () => {
    expect(matchesFileAccept(png, '.png')).toBe(true); // .PNG против .png
    expect(matchesFileAccept(png, 'image/*')).toBe(true);
    expect(matchesFileAccept(png, 'image/png')).toBe(true);
    expect(matchesFileAccept(pdf, 'image/*,.pdf')).toBe(true);
    expect(matchesFileAccept(pdf, 'image/*')).toBe(false);
    expect(matchesFileAccept(noSize, '.bin')).toBe(true); // без type — по расширению
    expect(matchesFileAccept(noSize, 'image/*')).toBe(false);
    expect(matchesFileAccept(pdf, '')).toBe(true); // пустой accept матчит всё
    expect(matchesFileAccept(pdf, ' , ')).toBe(true);
  });
});

describe('maxFileSize', () => {
  const v = maxFileSize(2000) as Rule;

  it('пропускает файлы в лимите, пустые значения и элементы без size', () => {
    expect(v([png])).toBeNull();
    expect(v(png)).toBeNull();
    expect(v(null)).toBeNull();
    expect(v(undefined)).toBeNull();
    expect(v('')).toBeNull();
    expect(v([])).toBeNull();
    expect(v([noSize])).toBeNull();
    expect(v('не файл')).toBeNull();
  });

  it('отклоняет первый нарушивший с params', () => {
    const err = v([png, pdf]);
    expect(err).toMatchObject({
      code: 'maxFileSize',
      params: { maxFileSize: 2000, fileName: 'doc.pdf', actualSize: 5000 },
    });
  });
});

describe('minFileSize', () => {
  const v = minFileSize(1) as Rule;

  it('отклоняет пустой (0-байтовый) файл, пропускает нормальные', () => {
    expect(v([png])).toBeNull();
    const err = v([{ name: 'empty.txt', size: 0 }]);
    expect(err).toMatchObject({
      code: 'minFileSize',
      params: { minFileSize: 1, fileName: 'empty.txt', actualSize: 0 },
    });
  });
});

describe('fileType', () => {
  const v = fileType('image/*,.pdf') as Rule;

  it('пропускает подходящие и пустые значения', () => {
    expect(v([png, pdf])).toBeNull();
    expect(v(null)).toBeNull();
    expect(v([])).toBeNull();
  });

  it('отклоняет неподходящий файл с params', () => {
    const exe = { name: 'virus.exe', size: 10, type: 'application/x-msdownload' };
    expect(v([png, exe])).toMatchObject({
      code: 'fileType',
      params: { accept: 'image/*,.pdf', fileName: 'virus.exe' },
    });
  });
});

describe('maxFiles / minFiles', () => {
  it('maxFiles: считает файлы, одиночный = 1', () => {
    const v = maxFiles(2) as Rule;
    expect(v([png, pdf])).toBeNull();
    expect(v(png)).toBeNull();
    expect(v([png, pdf, noSize])).toMatchObject({
      code: 'maxFiles',
      params: { maxFiles: 2, actualCount: 3 },
    });
  });

  it('minFiles: пустое значение пропускается (required — отдельно)', () => {
    const v = minFiles(2) as Rule;
    expect(v(null)).toBeNull();
    expect(v([])).toBeNull();
    expect(v([png, pdf])).toBeNull();
    expect(v([png])).toMatchObject({
      code: 'minFiles',
      params: { minFiles: 2, actualCount: 1 },
    });
  });
});

describe('maxTotalFileSize', () => {
  const v = maxTotalFileSize(5500) as Rule;

  it('суммирует size, элементы без size не считает', () => {
    expect(v([png, noSize])).toBeNull(); // 1000
    expect(v([pdf])).toBeNull(); // 5000
    expect(v([png, pdf])).toMatchObject({
      code: 'maxTotalFileSize',
      params: { maxTotalFileSize: 5500, actualTotal: 6000 },
    });
  });
});

describe('кастомные message и params', () => {
  it('message и доп. params прокидываются в ошибку', () => {
    const v = maxFileSize(100, { message: 'Слишком большой', params: { hint: 'x' } }) as Rule;
    const err = v([png]);
    expect(err).toMatchObject({
      code: 'maxFileSize',
      message: 'Слишком большой',
      params: { maxFileSize: 100, hint: 'x' },
    });
  });
});
