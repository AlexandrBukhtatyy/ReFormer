import { describe, expect, it } from 'vitest';
import type { FormTemplate } from '../contract';
import {
  buildTemplateFiles,
  commonDirPrefix,
  formSchemaFileOf,
  isTextFile,
  materializeFiles,
  resolvePicked,
  suggestBaseName,
  templateSlug,
} from './files';

describe('отбор файлов', () => {
  it('бинарные в шаблон не берутся, а файл без расширения — берётся', () => {
    expect(isTextFile('src/model.ts')).toBe(true);
    expect(isTextFile('assets/logo.png')).toBe(false);
    expect(isTextFile('LICENSE')).toBe(true);
    expect(isTextFile('.env')).toBe(true);
  });

  it('общий каталог схлопывается до ближайшего предка', () => {
    expect(commonDirPrefix(['a/b/model.ts', 'a/b/ui/x.ts'])).toBe('a/b');
    expect(commonDirPrefix(['a/b/x.ts', 'a/c/y.ts'])).toBe('a');
    expect(commonDirPrefix(['x.ts'])).toBe('');
  });

  it('базовое имя предлагается по последнему сегменту общего каталога', () => {
    expect(suggestBaseName(['src/credit-form/model.ts', 'src/credit-form/index.tsx'])).toBe(
      'credit-form'
    );
    expect(suggestBaseName(['credit.schema.json'])).toBe('credit');
  });

  it('slug чистит имя под файловую систему, сохраняя кириллицу', () => {
    expect(templateSlug('Кредитная форма')).toBe('кредитная-форма');
    expect(templateSlug('a/b:c')).toBe('abc');
    expect(templateSlug('   ')).toBe('template');
  });
});

describe('сборка шаблона', () => {
  it('пути становятся относительными, а имя — плейсхолдером', () => {
    const files = buildTemplateFiles(
      [
        { path: 'src/credit-form/model.ts', content: 'export type CreditForm = {};' },
        { path: 'src/credit-form/index.tsx', content: "import './credit-form/model';" },
      ],
      'credit-form'
    );
    expect(files).toEqual([
      { path: 'model.ts', content: 'export type __FormName__ = {};' },
      { path: 'index.tsx', content: "import './__form-name__/model';" },
    ]);
  });

  it('дубли путей отбрасываются, порядок сохраняется', () => {
    const files = buildTemplateFiles(
      [
        { path: 'a/x.ts', content: '1' },
        { path: 'a/x.ts', content: '2' },
      ],
      ''
    );
    expect(files).toEqual([{ path: 'x.ts', content: '1' }]);
  });
});

describe('подготовка файлов формы', () => {
  const template: FormTemplate = {
    id: 't',
    name: 'T',
    source: 'builtin',
    files: [
      { path: 'index.tsx', content: 'import { m } from "./model";' },
      { path: 'model.ts', content: 'export const m = "__FormName__";' },
      { path: 'types.ts', content: 'export type __FormName__ = {};' },
      { path: 'README.md', content: '# __FormName__' },
    ],
    requires: { 'index.tsx': ['model.ts'], 'model.ts': ['types.ts'] },
  };

  it('зависимости раскрываются транзитивно', () => {
    expect([...resolvePicked(['index.tsx'], template.requires)].sort()).toEqual([
      'index.tsx',
      'model.ts',
      'types.ts',
    ]);
  });

  it('без зависимостей набор остаётся тем, что выбрали', () => {
    expect([...resolvePicked(['README.md'], template.requires)]).toEqual(['README.md']);
  });

  it('имя подставляется и в содержимое, и в путь', () => {
    const files = materializeFiles(
      { ...template, files: [{ path: '__form-name__.ts', content: '__FormName__' }] },
      ['__form-name__.ts'],
      'user profile'
    );
    expect(files).toEqual([{ path: 'user-profile.ts', content: 'UserProfile' }]);
  });

  it('схему для открытия ищет среди json и отличает её от прочего json', () => {
    const files = [
      { path: 'package.json', content: '{"name":"x"}' },
      { path: 'renderer.schema.json', content: '{"root":{"component":"$html(div)"}}' },
    ];
    expect(formSchemaFileOf(files)?.file.path).toBe('renderer.schema.json');
    expect(formSchemaFileOf([{ path: 'x.json', content: 'не json' }])).toBeNull();
  });
});
