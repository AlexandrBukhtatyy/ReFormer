/**
 * Утилиты файловых правил: `isFileLike`, `toFileArray`, `matchesFileAccept`.
 *
 * Правила duck-typed ({@link FileLike}): работают и с нативным `File`, и с сериализуемым
 * дескриптором загруженного файла (`{ id, name, size?, type? }`), поэтому кейсы — на простых
 * объектах; нативные `File`/`Blob` (глобальны в Node 20+) — отдельной проверкой совместимости.
 * `matchesFileAccept` повторяет синтаксис атрибута `accept`: расширения, точные MIME, `категория/*`,
 * список через запятую, без учёта регистра и пробелов вокруг элементов.
 */

import { describe, expect, it } from 'vitest';
import {
  isFileLike,
  matchesFileAccept,
  toFileArray,
  type FileLike,
} from '../../../src/form/validators/file-utils';

const png: FileLike = { name: 'photo.PNG', size: 1000, type: 'image/png' };
const pdf: FileLike = { name: 'doc.pdf', size: 5000, type: 'application/pdf' };
/** Дескриптор без size/type — предзагруженный RemoteFileRef. */
const remote: FileLike = { name: 'remote.bin' };

describe('isFileLike — файлоподобные значения', () => {
  it.each([
    ['полный дескриптор', png],
    ['только name', remote],
    ['size и type явно undefined', { name: 'a.txt', size: undefined, type: undefined }],
    ['пустое имя', { name: '' }],
    ['лишние поля', { id: 'f1', name: 'a.txt', size: 1, url: 'https://cdn/a.txt' }],
  ])('%s — файлоподобно', (_label, value) => {
    expect(isFileLike(value)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['строка', 'file.txt'],
    ['число', 42],
    ['массив', [png]],
    ['нечисловое name', { name: 42 }],
    ['без name', { size: 1 }],
    ['нечисловой size', { name: 'x', size: '1' }],
    ['нестроковый type', { name: 'x', type: 5 }],
    ['size: null', { name: 'x', size: null }],
  ])('%s — не файлоподобно', (_label, value) => {
    expect(isFileLike(value)).toBe(false);
  });

  it('нативный File — файлоподобен, Blob без имени — нет', () => {
    expect(isFileLike(new File(['abc'], 'a.txt', { type: 'text/plain' }))).toBe(true);
    expect(isFileLike(new Blob(['abc']))).toBe(false);
  });
});

describe('toFileArray — нормализация значения', () => {
  it('одиночный файл оборачивается в массив', () => {
    expect(toFileArray(png)).toEqual([png]);
  });

  it('из массива отбираются только файлоподобные элементы, порядок сохраняется', () => {
    expect(toFileArray([png, 'мусор', null, pdf, { name: 1 }])).toEqual([png, pdf]);
  });

  it('пустой массив и массив без файлов — пустой массив', () => {
    expect(toFileArray([])).toEqual([]);
    expect(toFileArray(['a', 1])).toEqual([]);
  });

  it.each([
    ['строка', 'str'],
    ['число', 123],
    ['null', null],
    ['undefined', undefined],
    ['объект без name', { size: 1 }],
  ])('%s → null', (_label, value) => {
    expect(toFileArray(value)).toBeNull();
  });

  it('нативный File читается через геттеры прототипа', () => {
    const files = toFileArray(new File(['abc'], 'a.txt', { type: 'text/plain' }));
    expect(files?.map(({ name, size, type }) => ({ name, size, type }))).toEqual([
      { name: 'a.txt', size: 3, type: 'text/plain' },
    ]);
  });
});

describe('matchesFileAccept — синтаксис accept', () => {
  it.each([
    ['.png', png, 'расширение, имя в верхнем регистре'],
    ['.PNG', { name: 'a.png' }, 'расширение в accept в верхнем регистре'],
    ['image/png', png, 'точный MIME'],
    ['IMAGE/PNG', png, 'точный MIME в верхнем регистре'],
    ['image/*', png, 'категория'],
    ['IMAGE/*', png, 'категория в верхнем регистре'],
    ['image/*,.pdf', pdf, 'список: второй элемент'],
    [' image/* , .pdf ', pdf, 'пробелы вокруг элементов'],
    ['.gz', { name: 'archive.tar.gz' }, 'последнее расширение'],
    ['.tar.gz', { name: 'archive.tar.gz' }, 'составное расширение'],
    ['.bin', remote, 'без type — по расширению'],
    ['', pdf, 'пустой accept матчит всё'],
    [' , ', pdf, 'accept из пробелов и запятых матчит всё'],
    ['*/*', png, '*/* — любой файл [ReFormer-cnk3]'],
    ['*/*', remote, '*/* — и файл без type'],
    ['.pdf, */*', png, '*/* в списке'],
  ])('%s матчит %o (%s)', (accept, file, _label) => {
    expect(matchesFileAccept(file, accept)).toBe(true);
  });

  it.each([
    ['image/*', pdf, 'чужая категория'],
    ['image/*', remote, 'без type категория не матчится'],
    ['image/jpeg', png, 'другой MIME'],
    ['.pdf', { name: 'pdf' }, 'имя без точки'],
    ['pdf', { name: 'a.pdf' }, 'расширение без точки — не паттерн'],
    ['image', png, 'категория без /*'],
    ['image/*', { name: 'a', type: 'imagery/png' }, 'префикс категории до слэша'],
  ])('%s не матчит %o (%s)', (accept, file, _label) => {
    expect(matchesFileAccept(file, accept)).toBe(false);
  });
});
