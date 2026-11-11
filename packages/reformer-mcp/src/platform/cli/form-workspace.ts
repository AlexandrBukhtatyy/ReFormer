/**
 * Каталог формы на диске и проверка типов компилятором из проекта потребителя.
 *
 * Границы. От модели приходит только путь каталога: он обязан лежать внутри корня проекта и после
 * разворота символических ссылок (`realpath` ближайшего существующего предка), а `node_modules` и
 * `.git` запрещены. Граница — проект рабочего каталога сессии: без него сервер отказывает, писать
 * наугад нельзя. Компилятор и tsconfig ищутся от самого каталога формы: в монорепозитории это
 * приложение, в котором лежит форма, а не корень репозитория.
 *
 * Типы. Файлы подкладываются компилятору из памяти поверх диска — на своих настоящих путях, поэтому
 * относительные импорты и псевдонимы проекта резолвятся так же, как у самой формы, а сборка с
 * ошибками не оставляет следов. Опции, от которых зависит резолв (`paths`, `baseUrl`, `types`,
 * `typeRoots`, `jsxImportSource`, `customConditions`), берутся из ближайшего tsconfig проекта;
 * строгость проверки — своя, одинаковая для всех проектов. `typescript` берётся из проекта, затем из
 * зависимостей сервера. Не резолвятся `@reformer/*`, которые импортирует форма, — проверка
 * недоступна, и инструмент говорит об этом, а не отвечает «ошибок нет».
 *
 * `REFORMER_TYPECHECK_ROOT` — запасной корень резолва пакетов: стенд сценариев держит агента вне
 * репозитория, и пакеты, которых нет у формы, ищутся оттуда. Относительные импорты формы при этом
 * не трогаются.
 *
 * @module reformer-mcp/platform/cli/form-workspace
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs';
import { createRequire } from 'module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'path';
import type * as Ts from 'typescript';
import type {
  FormDirectory,
  FormFile,
  FormWorkspace,
  OpenedFormDirectory,
  TypecheckResult,
  TypeDiagnostic,
} from '../../core/workspace/form-workspace.js';
import { DEFAULT_FORM_DIR } from '../../core/workspace/form-workspace.js';
import { locatePackages, TYPECHECK_ROOT_ENV } from './package-locator.js';
import { reportKnowledgeProblem } from './problems.js';
import { detectProjectStack } from './project-detector.js';

export { TYPECHECK_ROOT_ENV };

const FORBIDDEN_SEGMENTS = new Set(['node_modules', '.git']);
/** Каталог, «из которого» резолвятся пакеты запасного корня. На диск в него ничего не пишется. */
const FALLBACK_DIRECTORY = '.reformer-form-build';

/** Ближайший существующий предок пути после разворота ссылок, с хвостом несуществующих сегментов. */
function realPathOfNearest(path: string): string {
  const tail: string[] = [];
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    tail.unshift(current.slice(parent.length).replace(/^[\\/]/, ''));
    current = parent;
  }
  return join(realpathSync(current), ...tail);
}

/** Ближайший существующий каталог пути (сам путь или его предок). */
function nearestExisting(path: string): string {
  let current = path;
  while (!existsSync(current)) {
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function isInside(root: string, path: string): boolean {
  const offset = relative(root, path);
  return offset !== '' && !offset.startsWith('..') && !isAbsolute(offset);
}

function assertPlainName(name: string): void {
  if (!name || /[\\/]/.test(name) || name === '.' || name === '..') {
    throw new Error(`Имя файла формы должно быть плоским: «${name}»`);
  }
}

function fallbackRoot(): string | undefined {
  return process.env[TYPECHECK_ROOT_ENV]?.trim() || undefined;
}

/** Компилятор: из проекта, затем от запасного корня, затем из зависимостей сервера. */
function loadCompiler(bases: readonly string[]): { ts: typeof Ts; from: string } | null {
  for (const from of [...bases.map((base) => join(base, 'package.json')), import.meta.url]) {
    try {
      return { ts: createRequire(from)('typescript') as typeof Ts, from };
    } catch {
      // следующий источник
    }
  }
  return null;
}

/** Опции tsconfig проекта, от которых зависит резолв модулей и JSX. */
const PROJECT_OPTION_KEYS = [
  'baseUrl',
  'paths',
  'pathsBasePath',
  'jsxImportSource',
  'types',
  'typeRoots',
  'customConditions',
] as const;

/** Опции резолва из ближайшего tsconfig над `base`. Строгость не берётся: она общая. */
function projectOptions(ts: typeof Ts, base: string): Ts.CompilerOptions {
  let configFile: string | undefined;
  try {
    configFile = ts.findConfigFile(base, ts.sys.fileExists);
    if (!configFile) return {};
    const { config, error } = ts.readConfigFile(configFile, ts.sys.readFile);
    if (error) {
      reportKnowledgeProblem(
        'typecheck',
        `${configFile}: ${ts.flattenDiagnosticMessageText(error.messageText, ' ')}`
      );
      return {};
    }
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, dirname(configFile));
    const picked: Ts.CompilerOptions = {};
    for (const key of PROJECT_OPTION_KEYS) {
      if (options[key] !== undefined) (picked as Record<string, unknown>)[key] = options[key];
    }
    return picked;
  } catch (error) {
    reportKnowledgeProblem('typecheck', `${configFile ?? base}: ${String(error)}`);
    return {};
  }
}

/**
 * Разобранные файлы вне каталога формы (библиотеки, `.d.ts` пакетов) — общие для всех проверок
 * процесса, пока файл не изменился. Без кэша каждая сборка заново разбирала `lib.dom.d.ts` и типы
 * React: на Windows файл тестов `form_build` шёл дольше минуты (ReFormer-gf9a).
 */
const sourceFileCache = new Map<string, { mtimeMs: number; file: Ts.SourceFile }>();

function languageKey(version: Ts.ScriptTarget | Ts.CreateSourceFileOptions): string {
  return typeof version === 'object'
    ? `${version.languageVersion}:${String(version.impliedNodeFormat)}`
    : String(version);
}

function isBareSpecifier(name: string): boolean {
  return !name.startsWith('.') && !isAbsolute(name);
}

/** Спецификаторы `@reformer/*`, которые импортируют файлы формы. */
function reformerSpecifiers(files: readonly FormFile[]): string[] {
  const found = new Set<string>(['@reformer/core']);
  for (const file of files) {
    for (const match of file.content.matchAll(/\bfrom\s+['"](@reformer\/[^'"]+)['"]/g)) {
      found.add(match[1]);
    }
  }
  return [...found].sort();
}

function typecheckModule(
  root: string,
  directory: string,
  files: readonly FormFile[]
): TypecheckResult {
  const fallback = fallbackRoot();
  const configBase = existsSync(directory) ? directory : nearestExisting(directory);
  const compiler = loadCompiler([configBase, root, ...(fallback ? [fallback] : [])]);
  if (!compiler) {
    return {
      status: 'unavailable',
      reason: 'no typescript package in the project or next to the server',
    };
  }
  const { ts } = compiler;

  const options: Ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    jsx: ts.JsxEmit.ReactJSX,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    ...projectOptions(ts, configBase),
  };
  // Глобальные `@types` запасного корня: прежде компилятор находил их, потому что проверял форму
  // «изнутри» этого корня.
  if (fallback && options.typeRoots === undefined) {
    options.typeRoots = [
      join(root, 'node_modules', '@types'),
      join(fallback, 'node_modules', '@types'),
    ].filter((dir) => existsSync(dir));
  }

  const normalize = (path: string): string => path.replace(/\\/g, '/');
  const formDirectory = normalize(directory);
  const overlay = new Map(files.map((file) => [`${formDirectory}/${file.path}`, file.content]));
  const fallbackFile = fallback ? normalize(join(fallback, FALLBACK_DIRECTORY, 'index.tsx')) : null;

  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, directoryExists, getSourceFile } = host;
  host.getCurrentDirectory = () => formDirectory;
  host.fileExists = (name) => overlay.has(normalize(name)) || fileExists.call(host, name);
  host.readFile = (name) => overlay.get(normalize(name)) ?? readFile.call(host, name);
  host.directoryExists = (name) =>
    normalize(name) === formDirectory || (directoryExists?.call(host, name) ?? true);
  host.getSourceFile = (name, version, onError, shouldCreate) => {
    const key = normalize(name);
    if (overlay.has(key)) {
      return ts.createSourceFile(name, overlay.get(key) as string, version, true);
    }
    let mtimeMs = -1;
    try {
      mtimeMs = statSync(name).mtimeMs;
    } catch {
      return getSourceFile.call(host, name, version, onError, shouldCreate);
    }
    const cacheKey = `${ts.version}\u0000${languageKey(version)}\u0000${key}`;
    const cached = sourceFileCache.get(cacheKey);
    if (cached && cached.mtimeMs === mtimeMs) return cached.file;
    const file = getSourceFile.call(host, name, version, onError, shouldCreate);
    if (file) sourceFileCache.set(cacheKey, { mtimeMs, file });
    return file;
  };

  const resolveOne = (
    name: string,
    containingFile: string,
    mode?: Ts.ResolutionMode
  ): Ts.ResolvedModuleWithFailedLookupLocations => {
    const primary = ts.resolveModuleName(
      name,
      containingFile,
      options,
      host,
      undefined,
      undefined,
      mode
    );
    if (primary.resolvedModule || !fallbackFile || !isBareSpecifier(name)) return primary;
    const secondary = ts.resolveModuleName(
      name,
      fallbackFile,
      options,
      host,
      undefined,
      undefined,
      mode
    );
    return secondary.resolvedModule ? secondary : primary;
  };
  if (fallbackFile) {
    host.resolveModuleNameLiterals = (
      literals,
      containingFile,
      _redirected,
      _options,
      sourceFile
    ) =>
      literals.map((literal) => {
        const modeOf = (
          ts as unknown as {
            getModeForUsageLocation?: (
              file: Ts.SourceFile,
              usage: Ts.StringLiteralLike,
              options?: Ts.CompilerOptions
            ) => Ts.ResolutionMode;
          }
        ).getModeForUsageLocation;
        return resolveOne(literal.text, containingFile, modeOf?.(sourceFile, literal, options));
      });
  }

  const entry = `${formDirectory}/index.tsx`;
  const missing = reformerSpecifiers(files).filter(
    (specifier) => !resolveOne(specifier, entry).resolvedModule
  );
  if (missing.length > 0) {
    return {
      status: 'unavailable',
      missing,
      reason:
        `${missing.join(', ')} do not resolve from the form folder` +
        (fallback
          ? ` (neither in the project nor from ${TYPECHECK_ROOT_ENV}=${fallback})`
          : ': the packages are not installed in the project or not built (no dist)'),
    };
  }

  const roots = [...overlay.keys()].filter((name) => /\.tsx?$/.test(name));
  const program = ts.createProgram(roots, options, host);
  const diagnostics: TypeDiagnostic[] = [];
  for (const rootName of roots) {
    const sourceFile = program.getSourceFile(rootName);
    if (!sourceFile) continue;
    for (const diagnostic of [
      ...program.getSyntacticDiagnostics(sourceFile),
      ...program.getSemanticDiagnostics(sourceFile),
    ]) {
      const line =
        diagnostic.start === undefined
          ? null
          : sourceFile.getLineAndCharacterOfPosition(diagnostic.start).line;
      diagnostics.push({
        file: rootName.slice(formDirectory.length + 1),
        line: line === null ? null : line + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ').slice(0, 300),
        source:
          line === null ? '' : (sourceFile.text.split('\n')[line]?.trim().slice(0, 200) ?? ''),
        code: diagnostic.code,
      });
    }
  }
  return { status: 'checked', diagnostics };
}

/**
 * Доступна ли проверка типов от рабочего каталога — для `reformer://status`.
 *
 * Та же логика, что у сборки: компилятор из проекта, затем от запасного корня, затем рядом с
 * сервером; `@reformer/core` — от проекта либо запасного корня.
 */
export function describeTypecheck(start: string = process.cwd()): {
  available: boolean;
  detail: string;
} {
  const project = detectProjectStack(start).projectRoot;
  const fallback = fallbackRoot();
  const bases = [project ?? start, ...(fallback ? [fallback] : [])];
  const compiler = loadCompiler(bases);
  if (!compiler) {
    return {
      available: false,
      detail: 'typescript is not installed in the project or next to the server',
    };
  }
  // Только то, что видно от проекта и запасного корня: компилятор формы резолвит пакеты оттуда, а
  // установка рядом с самим сервером (резолв его модулем) форме недоступна.
  const core = locatePackages('@reformer/core', bases).find((place) => place.via !== 'resolve');
  if (!core) {
    return {
      available: false,
      detail: `typescript ${compiler.ts.version}; @reformer/core is not installed in ${bases.join(' or ')}`,
    };
  }
  return {
    available: true,
    detail: `typescript ${compiler.ts.version}; @reformer/core ${core.version ?? '?'} at ${core.root}`,
  };
}

function openDirectory(root: string, path: string): FormDirectory {
  const at = (name: string): string => {
    assertPlainName(name);
    return join(path, name);
  };
  return {
    label: relative(root, path).split(sep).join('/'),
    read(name) {
      try {
        return readFileSync(at(name), 'utf-8');
      } catch {
        return null;
      }
    },
    write(name, content) {
      mkdirSync(path, { recursive: true });
      writeFileSync(at(name), content, 'utf-8');
    },
    remove(name) {
      rmSync(at(name), { force: true });
    },
    list() {
      return existsSync(path) ? readdirSync(path).sort() : [];
    },
    async typecheck(files) {
      return typecheckModule(root, path, files);
    },
  };
}

/**
 * @param startDirectory - От чего считать относительный путь и искать проект: у агента и сервера
 *   рабочий каталог один, поэтому `form` здесь и в его Write — один и тот же каталог.
 */
export function createCliFormWorkspace(startDirectory?: string): FormWorkspace {
  return {
    open(dir): OpenedFormDirectory {
      const start = startDirectory ?? process.cwd();
      // Граница записи — проект, в котором работает агент (от рабочего каталога сессии). Писать
      // в любой проект на диске, куда указал путь, нельзя. Проект самой формы (её tsconfig и
      // компилятор) ищет уже проверка типов — от каталога формы, внутри этой границы.
      const stack = detectProjectStack(start);
      const projectRoot = stack.projectRoot;
      if (!projectRoot) {
        return {
          ok: false,
          reason: 'no package.json of a project with dependencies: nowhere to write the form',
        };
      }
      // Без `dir` на корне монорепо умолчание положило бы форму мимо приложений (аудит 2026-11, A6).
      if (dir === null && stack.workspaceRoot) {
        return {
          ok: false,
          reason:
            `pass "dir": ${projectRoot} is a monorepo root (package.json has workspaces), ` +
            'so the default "form" folder would be outside every app. Give the form folder inside ' +
            'an app, e.g. {"dir":"apps/web/src/forms/order"}.',
        };
      }
      const root = realpathSync(projectRoot);
      const path = realPathOfNearest(resolve(start, dir ?? DEFAULT_FORM_DIR));
      if (!isInside(root, path)) {
        return { ok: false, reason: `the folder must be inside the project ${root}` };
      }
      if (
        relative(root, path)
          .split(sep)
          .some((segment) => FORBIDDEN_SEGMENTS.has(segment))
      ) {
        return { ok: false, reason: 'node_modules and .git are not writable' };
      }
      return { ok: true, directory: openDirectory(root, path) };
    },
  };
}
