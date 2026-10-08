/**
 * Модель панели превью: какой адрес приложения открыть в рамке — и когда открывать нечего.
 *
 * @module plugins/base/app-preview/model.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceRef } from '@reformer/builder-plugin-api';
import { formModulePath, previewTarget, resolveAddress } from './model';

function entry(path: string, kind: ResourceRef['kind'] = 'file'): ResourceRef {
  return {
    id: `fs:${path}`,
    sourceId: 'fs',
    path,
    name: path.split('/').at(-1) ?? path,
    kind,
    mediaType: kind === 'file' ? 'text/typescript' : 'inode/directory',
  };
}

describe('модуль формы в каталоге открытого файла', () => {
  it('это index.tsx — путь отдаётся от корня проекта', () => {
    const entries = [
      entry('src/forms/contact/form.schema.json'),
      entry('src/forms/contact/index.tsx'),
      entry('src/forms/contact/model.ts'),
    ];

    expect(formModulePath(entries)).toBe('src/forms/contact/index.tsx');
  });

  it('каталога с одной схемой недостаточно: модуля нет', () => {
    expect(formModulePath([entry('src/forms/contact/form.schema.json')])).toBeNull();
  });

  it('каталог с именем модуля модулем не считается', () => {
    expect(formModulePath([entry('src/forms/contact/index.tsx', 'directory')])).toBeNull();
  });

  it('пустой каталог — модуля нет', () => {
    expect(formModulePath([])).toBeNull();
  });
});

describe('что показывает панель', () => {
  const formUrl = (modulePath: string): string => `http://app/?stand=${modulePath}`;
  const base = { pageAddress: 'http://app/contacts', formUrl };

  it('режим «приложение» — страница, какой бы файл ни был открыт', () => {
    expect(previewTarget({ ...base, mode: 'page', hasDocument: false, modulePath: null })).toEqual({
      kind: 'frame',
      url: 'http://app/contacts',
    });
  });

  it('режим «форма» с модулем — стенд этой формы', () => {
    expect(
      previewTarget({
        ...base,
        mode: 'form',
        hasDocument: true,
        modulePath: 'src/forms/contact/index.tsx',
      })
    ).toEqual({ kind: 'frame', url: 'http://app/?stand=src/forms/contact/index.tsx' });
  });

  it('режим «форма» без открытого файла — показывать нечего, и это не «нет модуля»', () => {
    expect(previewTarget({ ...base, mode: 'form', hasDocument: false, modulePath: null })).toEqual({
      kind: 'no-document',
    });
  });

  it('режим «форма», файл открыт, а модуля рядом нет — сказано именно это', () => {
    expect(previewTarget({ ...base, mode: 'form', hasDocument: true, modulePath: null })).toEqual({
      kind: 'no-module',
    });
  });
});

describe('адрес из адресной строки панели', () => {
  const current = 'http://localhost:5173/contacts?tab=open';

  it('путь достраивается от текущего адреса приложения', () => {
    expect(resolveAddress('/orders', current)).toBe('http://localhost:5173/orders');
    expect(resolveAddress('archive', current)).toBe('http://localhost:5173/archive');
  });

  it('полный адрес того же приложения принимается как есть', () => {
    expect(resolveAddress('http://localhost:5173/orders?page=2', current)).toBe(
      'http://localhost:5173/orders?page=2'
    );
  });

  it('пробелы по краям не мешают', () => {
    expect(resolveAddress('  /orders  ', current)).toBe('http://localhost:5173/orders');
  });

  it('адрес другого источника не принимается: рамка показывает это приложение', () => {
    expect(resolveAddress('https://example.com/', current)).toBeNull();
    expect(resolveAddress('http://localhost:4321/', current)).toBeNull();
  });

  it('пустая строка — не адрес', () => {
    expect(resolveAddress('   ', current)).toBeNull();
  });
});
