/**
 * Форматирование сгенерированных файлов через `prettier/standalone` (как `model/printer`, но для
 * TS/TSX/MD). Опции — зеркало `.prettierrc.cjs` репо. При ошибке парсинга отдаём файл как есть
 * (рабочий неформатированный лучше падения экспорта).
 *
 * @module reformer-builder/codegen/format
 */

import * as prettier from 'prettier/standalone';
import type { Options, Plugin } from 'prettier';
import * as estree from 'prettier/plugins/estree';
import * as typescript from 'prettier/plugins/typescript';
import * as markdown from 'prettier/plugins/markdown';
import type { FileOut } from './index';

const OPTS: Options = {
  printWidth: 100,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5',
  bracketSpacing: true,
  arrowParens: 'always',
  endOfLine: 'lf',
};

const TS_PLUGINS = [estree, typescript] as unknown as Plugin[];
const MD_PLUGINS = [markdown] as unknown as Plugin[];

/** Отформатировать файлы (по расширению). Неизвестные/ошибочные — без изменений. */
export async function formatFiles(files: FileOut[]): Promise<FileOut[]> {
  return Promise.all(
    files.map(async (f) => {
      try {
        if (f.path.endsWith('.ts') || f.path.endsWith('.tsx')) {
          const content = await prettier.format(f.content, {
            ...OPTS,
            parser: 'typescript',
            plugins: TS_PLUGINS,
          });
          return { ...f, content };
        }
        if (f.path.endsWith('.md')) {
          const content = await prettier.format(f.content, {
            ...OPTS,
            parser: 'markdown',
            plugins: MD_PLUGINS,
          });
          return { ...f, content };
        }
      } catch {
        /* неформатированный файл лучше, чем падение экспорта */
      }
      return f;
    })
  );
}
