/**
 * TypeScript для генератора каталога: где его взять и как собрать программу по входу кита.
 *
 * `typescript` — необязательная peer-зависимость CLI: остальным командам он не нужен, а кит,
 * генерирующий каталог из типов, и так держит его в devDependencies. Поэтому модуль грузится
 * динамически — сначала из каталога кита (та же версия, которой кит проверяет себя), затем
 * рядом с CLI. Нет нигде — отказ `typescript-missing`, а не падение импорта всего CLI.
 *
 * @module @reformer/builder-plugin-cli/catalog/program
 */

import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type * as TS from 'typescript';

/** Модуль `typescript` целиком — так его отдаёт `require('typescript')`. */
export type TypeScriptModule = typeof TS;

/**
 * Грузит TypeScript: из каталога кита, затем рядом с CLI. `undefined` — не установлен.
 */
export function loadTypeScript(fromDir: string): TypeScriptModule | undefined {
  const bases = [join(fromDir, '__reformer-catalog__.js'), fileURLToPath(import.meta.url)];
  for (const base of bases) {
    try {
      return createRequire(base)('typescript') as TypeScriptModule;
    } catch {
      // нет в этом месте — пробуем следующее
    }
  }
  return undefined;
}

/** Параметры программы. Пути — абсолютные. */
export interface CatalogProgramOptions {
  readonly entry: string;
  /** tsconfig кита; нет — умолчания генератора. */
  readonly tsconfig?: string;
  /** Хост компилятора: файлы фикстур в памяти. По умолчанию — файловая система. */
  readonly host?: TS.CompilerHost;
}

export type CatalogProgramResult =
  | { readonly ok: true; readonly program: TS.Program }
  | { readonly ok: false; readonly message: string };

/** Умолчания без tsconfig: React-JSX, разрешение как у сборщика, строгая проверка `null`. */
function defaultOptions(ts: TypeScriptModule): TS.CompilerOptions {
  return {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    // Глобальные `@types/*` не подмешиваются: пропсы компонента не должны зависеть от того,
    // какие ещё пакеты типов случайно лежат в node_modules.
    types: [],
  };
}

/**
 * Программа по входу кита. Опции — из tsconfig кита (пути, JSX, `types`), поверх —
 * то, без чего интроспекция врёт или делает лишнее: без эмита, с `strictNullChecks`
 * (иначе `string | undefined` печаталось бы как `string`, а опциональность — терялась).
 */
export function createCatalogProgram(
  ts: TypeScriptModule,
  options: CatalogProgramOptions
): CatalogProgramResult {
  let compilerOptions = defaultOptions(ts);
  const host = options.host;
  const readFile = (file: string): string | undefined =>
    host === undefined ? ts.sys.readFile(file) : host.readFile(file);
  const fileExists = (file: string): boolean =>
    host === undefined ? ts.sys.fileExists(file) : host.fileExists(file);

  if (options.tsconfig !== undefined) {
    const read = ts.readConfigFile(options.tsconfig, readFile);
    if (read.error !== undefined) {
      return {
        ok: false,
        message: `tsconfig не читается: ${ts.flattenDiagnosticMessageText(read.error.messageText, '\n')}`,
      };
    }
    // Файлы проекта не нужны — корень программы один, вход кита. Поэтому каталог не обходится,
    // а ошибки разбора о «нет входных файлов» не считаются.
    const parsed = ts.parseJsonConfigFileContent(
      read.config,
      {
        useCaseSensitiveFileNames:
          host?.useCaseSensitiveFileNames() ?? ts.sys.useCaseSensitiveFileNames,
        readDirectory: () => [],
        fileExists,
        readFile,
      },
      dirname(options.tsconfig)
    );
    compilerOptions = { ...parsed.options };
  }

  compilerOptions = {
    ...compilerOptions,
    noEmit: true,
    strictNullChecks: true,
    skipLibCheck: true,
    declaration: false,
    declarationMap: false,
    composite: false,
    incremental: false,
    tsBuildInfoFile: undefined,
  };
  compilerOptions.jsx ??= ts.JsxEmit.ReactJSX;

  if (!fileExists(options.entry)) {
    return { ok: false, message: `входа кита «${options.entry}» нет` };
  }
  const program = ts.createProgram({ rootNames: [options.entry], options: compilerOptions, host });
  return { ok: true, program };
}
