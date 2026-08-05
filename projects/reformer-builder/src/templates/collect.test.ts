import { describe, expect, it } from 'vitest';
import {
  buildTemplateFiles,
  commonDirPrefix,
  isTextFile,
  suggestBaseName,
  templateSlug,
} from './collect';
import { TOKENS } from './placeholders';

describe('commonDirPrefix / suggestBaseName', () => {
  it('общий каталог набора путей', () => {
    expect(commonDirPrefix(['src/forms/credit/model.ts', 'src/forms/credit/ui/head.ts'])).toBe(
      'src/forms/credit'
    );
    expect(commonDirPrefix(['src/forms/credit/model.ts', 'src/forms/profile/model.ts'])).toBe(
      'src/forms'
    );
    expect(commonDirPrefix(['model.ts', 'form.json'])).toBe('');
    expect(commonDirPrefix([])).toBe('');
  });

  it('базовое имя — последний сегмент общего каталога, иначе имя файла', () => {
    expect(suggestBaseName(['src/forms/credit/model.ts', 'src/forms/credit/form.json'])).toBe(
      'credit'
    );
    expect(suggestBaseName(['credit-application.form.json'])).toBe('credit-application');
    expect(suggestBaseName([])).toBe('');
  });
});

describe('isTextFile', () => {
  it('пропускает текстовые, отсекает бинарные', () => {
    expect(isTextFile('src/model.ts')).toBe(true);
    expect(isTextFile('form.json')).toBe(true);
    expect(isTextFile('LICENSE')).toBe(true);
    expect(isTextFile('assets/logo.png')).toBe(false);
    expect(isTextFile('fonts/Inter.woff2')).toBe(false);
  });
});

describe('buildTemplateFiles', () => {
  const files = [
    {
      path: 'src/forms/credit-application/index.tsx',
      content: 'export default function CreditApplicationForm() {}',
    },
    {
      path: 'src/forms/credit-application/ui/credit-application-head.tsx',
      content: "import './credit-application/x';",
    },
  ];

  it('пути относительны общего каталога, содержимое и имена токенизированы', () => {
    expect(buildTemplateFiles(files, 'credit-application')).toEqual([
      { path: 'index.tsx', content: `export default function ${TOKENS.pascal}Form() {}` },
      {
        path: `ui/${TOKENS.kebab}-head.tsx`,
        content: `import './${TOKENS.kebab}/x';`,
      },
    ]);
  });

  it('без базового имени только срезает общий префикс', () => {
    const out = buildTemplateFiles(files, '');
    expect(out[0]).toEqual({ path: 'index.tsx', content: files[0].content });
    expect(out[1].path).toBe('ui/credit-application-head.tsx');
  });

  it('дубли путей отбрасываются', () => {
    const dup = [
      { path: 'a/model.ts', content: '1' },
      { path: 'a/model.ts', content: '2' },
    ];
    expect(buildTemplateFiles(dup, '')).toEqual([{ path: 'model.ts', content: '1' }]);
  });
});

describe('templateSlug', () => {
  it('чистит имя под файловую систему, кириллицу сохраняет', () => {
    expect(templateSlug('Кредитная форма 2')).toBe('кредитная-форма-2');
    expect(templateSlug('Credit Application')).toBe('credit-application');
    expect(templateSlug('a/b:c')).toBe('abc');
    expect(templateSlug('  ')).toBe('template');
  });
});
