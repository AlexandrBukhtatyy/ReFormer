/**
 * Проверка типов модуля формы с настоящими типами `@reformer/*`. Общая для калибровки и верификатора.
 * Каталог обязан лежать внутри репозитория: пакеты резолвятся через его `node_modules`.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let typescriptModule = null;
function typescript() {
  typescriptModule ??= createRequire(path.join(packageDirectory, 'package.json'))('typescript');
  return typescriptModule;
}

/**
 * @param {string} directory - каталог модуля: относительно него печатаются пути диагностик
 * @param {string[]} entries - абсолютные пути файлов
 * @returns {{ file: string, line: number|null, message: string }[]}
 */
export function typecheckFiles(directory, entries) {
  const compiler = typescript();
  const program = compiler.createProgram(entries, {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    jsx: compiler.JsxEmit.ReactJSX,
    module: compiler.ModuleKind.ESNext,
    moduleResolution: compiler.ModuleResolutionKind.Bundler,
    target: compiler.ScriptTarget.ES2022,
  });
  return program
    .getSyntacticDiagnostics()
    .concat(program.getSemanticDiagnostics())
    .map((diagnostic) => {
      const file = diagnostic.file ? path.relative(directory, diagnostic.file.fileName) : '';
      const line =
        diagnostic.file && diagnostic.start !== undefined
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1
          : null;
      return {
        file,
        line,
        message: compiler.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
      };
    });
}
