/**
 * Модель превью приложением: где лежит модуль формы и какой адрес принять из адресной строки.
 *
 * @module plugins/base/app-preview/model.test
 */

import { describe, expect, it } from 'vitest';
import type { ResourceRef } from '@reformer/builder-plugin-api';
import { formModulePath, moduleDirectoryOf, resolveAddress } from './model';

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

/** Служба адресов в объёме правила — та же арифметика, что у рабочей области. */
const files = {
  // До последнего «/»; у ресурса в корне источника каталог — сам корень.
  parentOf: (id: string): string => {
    const at = id.lastIndexOf('/');
    return at === -1 ? id.slice(0, id.indexOf(':') + 1) : id.slice(0, at);
  },
  resolve: (dir: string, ...segments: readonly string[]): string =>
    dir.endsWith(':') ? `${dir}${segments.join('/')}` : [dir, ...segments].join('/'),
};

describe('каталог модуля, которому принадлежит документ', () => {
  it('документ в папке schema — модуль в её родителе', () => {
    expect(moduleDirectoryOf(files, 'fs:src/forms/contact/schema/form.schema.json')).toBe(
      'fs:src/forms/contact'
    );
  });

  it('документ рядом с точкой входа — модуль там же', () => {
    expect(moduleDirectoryOf(files, 'fs:src/forms/contact/form.schema.json')).toBe(
      'fs:src/forms/contact'
    );
  });

  it('решает имя папки, а не имя документа: формат документа плагину безразличен', () => {
    expect(moduleDirectoryOf(files, 'fs:src/forms/contact/schema/what-ever.yaml')).toBe(
      'fs:src/forms/contact'
    );
    // Папка, в имени которой «schema» только часть, — обычный каталог документа.
    expect(moduleDirectoryOf(files, 'fs:src/forms/contact/schemas/form.schema.json')).toBe(
      'fs:src/forms/contact/schemas'
    );
    expect(moduleDirectoryOf(files, 'fs:src/forms/schema-old/form.schema.json')).toBe(
      'fs:src/forms/schema-old'
    );
  });

  it('папка schema в корне проекта — модуль в корне; документ в корне — тоже', () => {
    expect(moduleDirectoryOf(files, 'fs:schema/form.schema.json')).toBe('fs:');
    expect(moduleDirectoryOf(files, 'fs:form.schema.json')).toBe('fs:');
  });

  it('выше одного уровня не поднимается: schema/schema — это модуль с именем schema', () => {
    expect(moduleDirectoryOf(files, 'fs:forms/schema/schema/form.schema.json')).toBe(
      'fs:forms/schema'
    );
  });
});

describe('точка входа модуля среди записей его каталога', () => {
  it('index.ts нового модуля — путь отдаётся от корня проекта', () => {
    const entries = [
      entry('src/forms/contact/ContactForm.tsx'),
      entry('src/forms/contact/index.ts'),
      entry('src/forms/contact/README.md'),
      entry('src/forms/contact/schema', 'directory'),
    ];

    expect(formModulePath(entries)).toBe('src/forms/contact/index.ts');
  });

  it('лежат оба — берётся index.ts: его же возьмёт импорт каталога в приложении', () => {
    // Модуль перегенерировали на месте: прежняя страница `index.tsx` ещё не удалена.
    const entries = [entry('src/forms/contact/index.tsx'), entry('src/forms/contact/index.ts')];

    expect(formModulePath(entries)).toBe('src/forms/contact/index.ts');
  });

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
