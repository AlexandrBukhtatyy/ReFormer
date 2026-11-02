/**
 * Каталог формы на диске и проверка типов компилятором из проекта потребителя.
 *
 * Границы. От модели приходит только путь каталога: он обязан лежать внутри корня проекта и после
 * разворота символических ссылок (`realpath` ближайшего существующего предка), а `node_modules` и
 * `.git` запрещены. Без корня проекта сервер отказывает: писать наугад от своего cwd нельзя.
 *
 * Типы. Файлы подкладываются компилятору из памяти поверх диска: сборка с ошибками не должна оставлять
 * следов, а импорты резолвятся так же, как у самой формы. `typescript` берётся из проекта, затем из
 * зависимостей сервера. Нет компилятора либо не резолвятся `@reformer/*` — проверка недоступна,
 * и инструмент говорит об этом, а не отвечает «ошибок нет».
 *
 * `REFORMER_TYPECHECK_ROOT` — каталог, от которого резолвить пакеты, если в проекте их нет: стенд
 * сценариев держит агента вне репозитория, иначе агент читал бы исходники пакетов.
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
import { detectProjectStack } from './project-detector.js';

export const TYPECHECK_ROOT_ENV = 'REFORMER_TYPECHECK_ROOT';

const FORBIDDEN_SEGMENTS = new Set(['node_modules', '.git']);
const VIRTUAL_DIRECTORY = '.reformer-form-build';

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

function isInside(root: string, path: string): boolean {
  const offset = relative(root, path);
  return offset !== '' && !offset.startsWith('..') && !isAbsolute(offset);
}

function assertPlainName(name: string): void {
  if (!name || /[\\/]/.test(name) || name === '.' || name === '..') {
    throw new Error(`Имя файла формы должно быть плоским: «${name}»`);
  }
}

function loadCompiler(base: string): typeof Ts | null {
  for (const from of [join(base, 'package.json'), import.meta.url]) {
    try {
      return createRequire(from)('typescript') as typeof Ts;
    } catch {
      // следующий источник
    }
  }
  return null;
}

/** `paths` проекта: без них в монорепозитории не резолвятся его псевдонимы. */
function projectAliases(ts: typeof Ts, base: string): Ts.CompilerOptions {
  try {
    const configFile = ts.findConfigFile(base, ts.sys.fileExists);
    if (!configFile) return {};
    const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
    const { options } = ts.parseJsonConfigFileContent(config, ts.sys, dirname(configFile));
    const { baseUrl, paths, pathsBasePath } = options as Ts.CompilerOptions & {
      pathsBasePath?: string;
    };
    return { ...(baseUrl ? { baseUrl } : {}), ...(paths ? { paths, pathsBasePath } : {}) };
  } catch {
    return {};
  }
}

function typecheckModule(
  base: string,
  directory: string,
  files: readonly FormFile[]
): TypecheckResult {
  const ts = loadCompiler(base);
  if (!ts) return { status: 'unavailable', reason: 'в проекте нет пакета typescript' };

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
    ...projectAliases(ts, base),
  };

  const normalize = (path: string): string => path.replace(/\\/g, '/');
  const virtualDirectory = normalize(directory);
  const overlay = new Map(files.map((file) => [`${virtualDirectory}/${file.path}`, file.content]));

  const host = ts.createCompilerHost(options);
  const { fileExists, readFile, directoryExists } = host;
  host.getCurrentDirectory = () => virtualDirectory;
  host.fileExists = (name) => overlay.has(normalize(name)) || fileExists.call(host, name);
  host.readFile = (name) => overlay.get(normalize(name)) ?? readFile.call(host, name);
  host.directoryExists = (name) =>
    normalize(name) === virtualDirectory || (directoryExists?.call(host, name) ?? true);

  const probe = ts.resolveModuleName(
    '@reformer/core',
    `${virtualDirectory}/index.tsx`,
    options,
    host
  );
  if (!probe.resolvedModule) {
    return { status: 'unavailable', reason: 'из каталога формы не резолвится @reformer/core' };
  }

  const roots = [...overlay.keys()].filter((name) => /\.tsx?$/.test(name));
  const program = ts.createProgram(roots, options, host);
  const diagnostics: TypeDiagnostic[] = [];
  for (const root of roots) {
    const sourceFile = program.getSourceFile(root);
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
        file: root.slice(virtualDirectory.length + 1),
        line: line === null ? null : line + 1,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ').slice(0, 300),
        source:
          line === null ? '' : (sourceFile.text.split('\n')[line]?.trim().slice(0, 200) ?? ''),
      });
    }
  }
  return { status: 'checked', diagnostics };
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
      const override = process.env[TYPECHECK_ROOT_ENV]?.trim();
      return override
        ? typecheckModule(override, join(override, VIRTUAL_DIRECTORY), files)
        : typecheckModule(root, path, files);
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
      const projectRoot = detectProjectStack(start).projectRoot;
      if (!projectRoot) {
        return {
          ok: false,
          reason: 'не найден package.json проекта с зависимостями: некуда записывать форму',
        };
      }
      const root = realpathSync(projectRoot);
      const path = realPathOfNearest(resolve(start, dir));
      if (!isInside(root, path)) {
        return { ok: false, reason: `каталог должен лежать внутри проекта ${root}` };
      }
      if (
        relative(root, path)
          .split(sep)
          .some((segment) => FORBIDDEN_SEGMENTS.has(segment))
      ) {
        return { ok: false, reason: 'в node_modules и .git писать нельзя' };
      }
      return { ok: true, directory: openDirectory(root, path) };
    },
  };
}
