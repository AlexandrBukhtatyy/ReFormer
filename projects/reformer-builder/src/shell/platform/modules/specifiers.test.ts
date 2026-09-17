import { describe, expect, it } from 'vitest';

import { collectBareSpecifiers } from './specifiers';

const files = (...sources: string[]) =>
  new Map(sources.map((source, index) => [`file${String(index)}.ts`, source]));

describe('чтение импортов набора файлов', () => {
  it('видит все формы, которыми называют модуль', () => {
    const found = collectBareSpecifiers(
      files(
        `import { FormWizard } from '@reformer/ui-kit';\n` +
          `import type { FormProxy } from '@reformer/core';\n` +
          `export { List } from '@reformer/ui-kit/list';\n` +
          `import '@reformer/ui-kit/styles';\n` +
          `const cdk = require('@reformer/cdk/form-array');\n` +
          `const lazy = await import('@reformer/ui-kit/combobox');\n`
      )
    );

    expect(found).toEqual([
      '@reformer/cdk/form-array',
      '@reformer/core',
      '@reformer/ui-kit',
      '@reformer/ui-kit/combobox',
      '@reformer/ui-kit/list',
      '@reformer/ui-kit/styles',
    ]);
  });

  it('пути не считает: их резолвит линковщик по набору файлов, а не реестр', () => {
    const found = collectBareSpecifiers(
      files(`import { schema } from './form.schema';\nimport x from '/abs/path';\n`)
    );

    expect(found).toEqual([]);
  });

  it('читает КАЖДЫЙ файл целиком, а не первый импорт первого', () => {
    // Регулярка с `g` несёт `lastIndex` между вызовами; без сброса второй файл читался бы
    // с середины первого, и модуль, названный в его начале, потерялся бы.
    const found = collectBareSpecifiers(
      files(
        `import a from '@reformer/core';\nimport b from '@reformer/cdk';`,
        `import c from 'react';`
      )
    );

    expect(found).toEqual(['@reformer/cdk', '@reformer/core', 'react']);
  });

  it('повторы схлопывает', () => {
    const found = collectBareSpecifiers(
      files(`import a from 'react';`, `import b from 'react';\nconst c = require('react');`)
    );

    expect(found).toEqual(['react']);
  });
});
