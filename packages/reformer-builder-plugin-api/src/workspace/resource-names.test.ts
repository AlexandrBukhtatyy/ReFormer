import { describe, expect, it } from 'vitest';

import {
  isInside,
  MAX_NAME_LENGTH,
  splitName,
  uniqueName,
  validateResourceName,
} from './resource-names';

describe('проверка имени', () => {
  it('обычное имя проходит', () => {
    expect(validateResourceName('schema.json')).toBeNull();
    expect(validateResourceName('форма кредита.md')).toBeNull();
    expect(validateResourceName('.gitignore')).toBeNull();
  });

  it('пустое имя и пробелы — отказ, а не молчаливое создание безымянного', () => {
    expect(validateResourceName('')).toBe('empty');
    expect(validateResourceName('   ')).toBe('empty');
  });

  it('разделитель пути в имени — отказ: создаётся одна запись, а не дерево', () => {
    expect(validateResourceName('forms/credit.json')).toBe('separator');
  });

  it('точки — переход по дереву, а не имя', () => {
    expect(validateResourceName('.')).toBe('dots');
    expect(validateResourceName('..')).toBe('dots');
  });

  it('символы, запрещённые файловыми системами', () => {
    for (const name of ['a:b', 'a*b', 'a?b', 'a"b', 'a<b', 'a>b', 'a|b', 'a\\b']) {
      expect(validateResourceName(name)).toBe('forbidden-character');
    }
  });

  it('управляющий символ — отказ: он попадает в имя только вставкой и всегда по ошибке', () => {
    expect(validateResourceName('a\u0007b')).toBe('forbidden-character');
  });

  it('точка и пробел в конце: Windows их срежет, и имя окажется не тем', () => {
    expect(validateResourceName('schema.')).toBe('trailing');
    expect(validateResourceName('schema ')).toBe('trailing');
  });

  it('имена устройств DOS — отказ и с расширением тоже', () => {
    expect(validateResourceName('con')).toBe('reserved');
    expect(validateResourceName('NUL.txt')).toBe('reserved');
    expect(validateResourceName('com1.ts')).toBe('reserved');
    // «console.ts» началом совпадает с `con`, но устройством не является.
    expect(validateResourceName('console.ts')).toBeNull();
  });

  it('длина ограничена пределом сегмента', () => {
    expect(validateResourceName('a'.repeat(MAX_NAME_LENGTH))).toBeNull();
    expect(validateResourceName('a'.repeat(MAX_NAME_LENGTH + 1))).toBe('too-long');
  });
});

describe('деление имени', () => {
  it('расширение берётся по ПОСЛЕДНЕЙ точке — как его понимает человек', () => {
    // v1 брала первую и превращала «schema.form.json» в «schema-2.form.json».
    expect(splitName('schema.form.json')).toEqual({ stem: 'schema.form', ext: '.json' });
  });

  it('ведущая точка расширением не считается', () => {
    expect(splitName('.gitignore')).toEqual({ stem: '.gitignore', ext: '' });
  });

  it('имя без точки — одна основа', () => {
    expect(splitName('README')).toEqual({ stem: 'README', ext: '' });
  });
});

describe('подбор свободного имени', () => {
  it('свободное имя возвращается как есть — без единого обращения к источнику', () => {
    expect(uniqueName(['other.ts'], 'schema.json')).toBe('schema.json');
  });

  it('занятое разводится номером с сохранением расширения', () => {
    expect(uniqueName(['schema.json'], 'schema.json')).toBe('schema-2.json');
    expect(uniqueName(['schema.json', 'schema-2.json'], 'schema.json')).toBe('schema-3.json');
  });

  it('регистр не различается: на APFS и NTFS это одна запись', () => {
    expect(uniqueName(['Schema.json'], 'schema.json')).toBe('schema-2.json');
  });

  it('каталог без расширения нумеруется целиком', () => {
    expect(uniqueName(['credit'], 'credit')).toBe('credit-2');
  });

  it('исчерпание номеров разводится солью, а не бесконечным перебором', () => {
    const taken = ['x.ts', ...Array.from({ length: 999 }, (_, i) => `x-${i + 2}.ts`)];
    expect(uniqueName(taken, 'x.ts', 'copy')).toBe('x-copy.ts');
  });
});

describe('вложенность пути', () => {
  it('путь внутри каталога и он сам', () => {
    expect(isInside('forms/credit', 'forms')).toBe(true);
    expect(isInside('forms', 'forms')).toBe(true);
  });

  it('совпадение по префиксу имени вложенностью не является', () => {
    expect(isInside('forms-old/credit', 'forms')).toBe(false);
  });

  it('корень содержит всё: пустой путь — это он', () => {
    expect(isInside('forms/credit', '')).toBe(true);
  });
});
