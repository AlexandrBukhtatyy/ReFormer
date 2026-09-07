/**
 * Тесты примитива Resource.
 *
 * Проверяются ровно те утверждения, на которые опирается остальное ядро: канонический вид
 * пути (один ресурс — один ключ кэша), невозможность побега за корень, арифметика сегментов
 * для резолвера импортов и приоритет источника над расширением.
 *
 * @module shell/platform/primitives/resource.test
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MEDIA_TYPE,
  basename,
  dirname,
  extname,
  isTextMediaType,
  joinPath,
  makeResourceId,
  mediaTypeFor,
  normalizePath,
  parseResourceId,
  relativePath,
} from './resource';

describe('normalizePath', () => {
  it('срезает ведущий и хвостовой слэш', () => {
    expect(normalizePath('/src/forms/')).toBe('src/forms');
  });

  it('схлопывает повторные слэши и точки', () => {
    expect(normalizePath('src//forms/./credit///schema.json')).toBe('src/forms/credit/schema.json');
  });

  it('разрешает `..` внутри пути', () => {
    expect(normalizePath('src/forms/credit/../shared/rules.ts')).toBe('src/forms/shared/rules.ts');
  });

  it('сводит все написания корня к пустой строке', () => {
    expect(normalizePath('')).toBe('');
    expect(normalizePath('.')).toBe('');
    expect(normalizePath('/')).toBe('');
    expect(normalizePath('./')).toBe('');
  });

  it('оставляет уже канонический путь без изменений', () => {
    expect(normalizePath('src/forms/credit/schema.json')).toBe('src/forms/credit/schema.json');
  });

  it('не считает расширением точку внутри имени', () => {
    expect(normalizePath('a/.hidden/b..c')).toBe('a/.hidden/b..c');
  });

  it('бросает на попытке выйти за корень', () => {
    expect(() => normalizePath('..')).toThrow(/за корень/);
    expect(() => normalizePath('../etc/hosts')).toThrow(/за корень/);
    expect(() => normalizePath('src/../../etc/hosts')).toThrow(/за корень/);
    expect(() => normalizePath('/../a')).toThrow(/за корень/);
  });

  it('бросает, даже если побег компенсирован дальше по пути', () => {
    // Схлопывать такой путь к `src/a` нельзя: побег состоялся, и источник мог бы его выполнить.
    expect(() => normalizePath('../src/a')).toThrow(/за корень/);
  });
});

describe('joinPath', () => {
  it('склеивает сегменты и нормализует результат', () => {
    expect(joinPath('src/forms', 'credit', 'schema.json')).toBe('src/forms/credit/schema.json');
  });

  it('пропускает пустые сегменты — каталог верхнего уровня приходит как пустая строка', () => {
    expect(joinPath('', 'schema.json')).toBe('schema.json');
  });

  it('работает как резолв импорта: каталог ресурса плюс относительный спецификатор', () => {
    const schema = 'src/forms/credit/schema.json';
    expect(joinPath(dirname(schema), './validation.ts')).toBe('src/forms/credit/validation.ts');
    expect(joinPath(dirname(schema), '../shared/rules.ts')).toBe('src/forms/shared/rules.ts');
  });

  it('отсекает импорт, уводящий за корень источника', () => {
    expect(() => joinPath('src/forms', '../../../etc/hosts')).toThrow(/за корень/);
  });
});

describe('dirname / basename / extname', () => {
  it('делит путь на каталог и имя', () => {
    expect(dirname('src/forms/credit/schema.json')).toBe('src/forms/credit');
    expect(basename('src/forms/credit/schema.json')).toBe('schema.json');
  });

  it('для ресурса верхнего уровня каталог — корень', () => {
    expect(dirname('schema.json')).toBe('');
    expect(basename('schema.json')).toBe('schema.json');
  });

  it('корень не имеет ни каталога, ни имени', () => {
    expect(dirname('')).toBe('');
    expect(basename('')).toBe('');
  });

  it('нормализует вход', () => {
    expect(dirname('/src//forms/./schema.json')).toBe('src/forms');
    expect(basename('src/forms/')).toBe('forms');
  });

  it('расширение отдаётся вместе с точкой', () => {
    expect(extname('schema.json')).toBe('.json');
    expect(extname('src/forms/credit/schema.json')).toBe('.json');
  });

  it('из составного расширения берётся последнее', () => {
    expect(extname('types.d.ts')).toBe('.ts');
  });

  it('у скрытого файла расширения нет — ведущая точка часть имени', () => {
    expect(extname('.gitignore')).toBe('');
    expect(extname('src/.prettierrc')).toBe('');
  });

  it('без точки расширения нет', () => {
    expect(extname('LICENSE')).toBe('');
    expect(extname('')).toBe('');
  });
});

describe('relativePath', () => {
  const schema = 'src/forms/credit/schema.json';

  it('поднимается к соседнему каталогу — случай резолвера импортов', () => {
    expect(relativePath(schema, 'src/forms/shared/rules.ts')).toBe('../shared/rules.ts');
  });

  it('считает то же самое в обратную сторону', () => {
    expect(relativePath('src/forms/shared/rules.ts', schema)).toBe('../credit/schema.json');
  });

  it('сосед по каталогу получает префикс `./`, чтобы не читаться как имя пакета', () => {
    expect(relativePath(schema, 'src/forms/credit/validation.ts')).toBe('./validation.ts');
  });

  it('спускается в подкаталог', () => {
    expect(relativePath(schema, 'src/forms/credit/parts/step-1.json')).toBe('./parts/step-1.json');
  });

  it('поднимается на несколько уровней', () => {
    expect(relativePath(schema, 'docs/spec.md')).toBe('../../../docs/spec.md');
  });

  it('ссылка на самого себя — это `./` плюс имя', () => {
    expect(relativePath(schema, schema)).toBe('./schema.json');
  });

  it('от ресурса верхнего уровня всё видно вниз', () => {
    expect(relativePath('package.json', 'src/forms/credit/schema.json')).toBe(
      './src/forms/credit/schema.json'
    );
  });

  it('корень источника достижим одними `..`', () => {
    expect(relativePath(schema, '')).toBe('../../..');
    expect(relativePath('package.json', '')).toBe('.');
  });

  it('нормализует оба аргумента', () => {
    expect(relativePath('/src/forms/credit/./schema.json', 'src/forms//shared/rules.ts')).toBe(
      '../shared/rules.ts'
    );
  });
});

describe('mediaTypeFor', () => {
  it('узнаёт расширение', () => {
    expect(mediaTypeFor('src/forms/credit/schema.json')).toBe('application/json');
    expect(mediaTypeFor('src/forms/credit/validation.ts')).toBe('text/typescript');
    expect(mediaTypeFor('README.md')).toBe('text/markdown');
    expect(mediaTypeFor('assets/logo.png')).toBe('image/png');
  });

  it('не различает регистр расширения', () => {
    expect(mediaTypeFor('PHOTO.JPG')).toBe('image/jpeg');
    expect(mediaTypeFor('Schema.JSON')).toBe('application/json');
  });

  it('неизвестное расширение и файл без расширения — текст по умолчанию', () => {
    expect(mediaTypeFor('LICENSE')).toBe(DEFAULT_MEDIA_TYPE);
    expect(mediaTypeFor('.gitignore')).toBe(DEFAULT_MEDIA_TYPE);
    expect(mediaTypeFor('data.unknown-ext')).toBe(DEFAULT_MEDIA_TYPE);
  });

  it('подсказка источника перебивает расширение', () => {
    // Источник знает больше: `Content-Type` — факт о содержимом, расширение — догадка по имени.
    expect(mediaTypeFor('report.json', 'text/markdown')).toBe('text/markdown');
    expect(mediaTypeFor('blob', 'image/png')).toBe('image/png');
  });

  it('у подсказки отбрасываются параметры и регистр', () => {
    expect(mediaTypeFor('a.bin', 'Application/JSON; charset=utf-8')).toBe('application/json');
    expect(mediaTypeFor('a.bin', '  text/markdown  ')).toBe('text/markdown');
  });

  it('нераспознаваемая подсказка игнорируется, ответ падает на расширение', () => {
    expect(mediaTypeFor('schema.json', '')).toBe('application/json');
    expect(mediaTypeFor('schema.json', 'binary')).toBe('application/json');
    expect(mediaTypeFor('schema.json', '???')).toBe('application/json');
  });
});

describe('isTextMediaType', () => {
  it('всё семейство `text/` — текст', () => {
    expect(isTextMediaType('text/plain')).toBe(true);
    expect(isTextMediaType('text/typescript')).toBe(true);
    expect(isTextMediaType('text/markdown')).toBe(true);
  });

  it('текстовые форматы вне `text/` перечислены явно', () => {
    expect(isTextMediaType('application/json')).toBe(true);
    expect(isTextMediaType('application/yaml')).toBe(true);
    expect(isTextMediaType('application/xml')).toBe(true);
  });

  it('структурный суффикс делает текстом что угодно слева', () => {
    expect(isTextMediaType('image/svg+xml')).toBe(true);
    expect(isTextMediaType('application/ld+json')).toBe(true);
  });

  it('бинарные — не текст', () => {
    expect(isTextMediaType('image/png')).toBe(false);
    expect(isTextMediaType('font/woff2')).toBe(false);
    expect(isTextMediaType('application/pdf')).toBe(false);
    expect(isTextMediaType('application/octet-stream')).toBe(false);
  });

  it('параметры не мешают, мусор — не текст', () => {
    expect(isTextMediaType('application/json; charset=utf-8')).toBe(true);
    expect(isTextMediaType('binary')).toBe(false);
    expect(isTextMediaType('')).toBe(false);
  });

  it('согласован с таблицей расширений', () => {
    expect(isTextMediaType(mediaTypeFor('schema.json'))).toBe(true);
    expect(isTextMediaType(mediaTypeFor('icon.svg'))).toBe(true);
    expect(isTextMediaType(mediaTypeFor('logo.png'))).toBe(false);
  });
});

describe('makeResourceId / parseResourceId', () => {
  it('собирает и разбирает обратно', () => {
    const id = makeResourceId('fs-1', 'src/forms/credit/schema.json');
    expect(id).toBe('fs-1:src/forms/credit/schema.json');
    expect(parseResourceId(id)).toEqual({
      sourceId: 'fs-1',
      path: 'src/forms/credit/schema.json',
    });
  });

  it('нормализует путь при сборке — иначе один ресурс получил бы два ключа', () => {
    expect(makeResourceId('fs-1', '/src//forms/./credit/schema.json')).toBe(
      makeResourceId('fs-1', 'src/forms/credit/schema.json')
    );
  });

  it('корень источника — идентификатор с пустым путём', () => {
    const root = makeResourceId('fs-1', '');
    expect(root).toBe('fs-1:');
    expect(parseResourceId(root)).toEqual({ sourceId: 'fs-1', path: '' });
  });

  it('двоеточие в пути переживает разбор — делим по первому', () => {
    const id = makeResourceId('fs-1', 'notes/12:30.md');
    expect(id).toBe('fs-1:notes/12:30.md');
    expect(parseResourceId(id)).toEqual({ sourceId: 'fs-1', path: 'notes/12:30.md' });
  });

  it('не даёт собрать неразбираемый идентификатор', () => {
    expect(() => makeResourceId('fs:1', 'a.json')).toThrow(/':'/);
    expect(() => makeResourceId('', 'a.json')).toThrow(/пустым/);
  });

  it('не даёт собрать побег за корень', () => {
    expect(() => makeResourceId('fs-1', '../etc/hosts')).toThrow(/за корень/);
  });

  it('отвергает побег и на разборе — идентификатор мог прийти извне', () => {
    expect(() => parseResourceId('fs-1:../etc/hosts')).toThrow(/за корень/);
  });

  it('канонизирует путь на разборе', () => {
    expect(parseResourceId('fs-1:/src//a.json')).toEqual({ sourceId: 'fs-1', path: 'src/a.json' });
  });

  it('отвергает строку, которая не идентификатор ресурса', () => {
    expect(() => parseResourceId('src/forms/schema.json')).toThrow(/не идентификатор/);
    expect(() => parseResourceId('')).toThrow(/не идентификатор/);
    expect(() => parseResourceId(':a.json')).toThrow(/не идентификатор/);
  });
});
