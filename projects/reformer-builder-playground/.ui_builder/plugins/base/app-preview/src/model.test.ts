/**
 * Модель превью приложением: где лежит модуль формы и какой адрес принять из адресной строки.
 *
 * @module plugins/base/app-preview/model.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceRef } from '@reformer/builder-plugin-api';
import { formModulePath, resolveAddress } from './model';

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

describe('модуль формы в каталоге документа', () => {
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
