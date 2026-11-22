/**
 * Стек проекта: ближайший `package.json` с зависимостями и признаки кита, рендереров и Tailwind.
 *
 * Читает только `package.json` и наличие `tailwind.config.*` — дёшево, на каждом вызове. Текст
 * подсказки для промптов по этим признакам печатает сервер.
 *
 * @module @reformer/mcp/local/project-detector
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join, sep } from 'path';
import { reportKnowledgeProblem } from './problems.js';

export interface ProjectStack {
  /** Absolute path to the resolved project package.json (or null if not found). */
  projectRoot: string | null;
  /**
   * The project's package.json declares `workspaces`: it is a monorepo root, not an app. A form
   * placed there by default (`form/`) would land outside every app of the monorepo.
   */
  workspaceRoot: boolean;
  /** All dependencies (deps + devDeps + peerDeps) keyed by name → version range. */
  allDependencies: Record<string, string>;
  /** Whether @reformer/ui-kit is in deps. */
  hasUiKit: boolean;
  /** Whether @reformer/cdk is in deps. */
  hasCdk: boolean;
  /** Whether @reformer/renderer-react is in deps. */
  hasRendererReact: boolean;
  /** Whether @reformer/renderer-json is in deps. */
  hasRendererJson: boolean;
  /** Whether tailwindcss / @tailwindcss/vite is in deps. */
  hasTailwindDep: boolean;
  /** Whether tailwind.config.{js,ts,cjs,mjs} exists at project root (Tailwind v3). */
  hasTailwindConfig: boolean;
  /** Whether @tailwindcss/vite plugin is in deps (Tailwind v4 — no separate config file needed). */
  hasTailwindVitePlugin: boolean;
  /** True if Tailwind dep detected AND (config file OR Vite plugin) — i.e. functional setup. */
  hasTailwind: boolean;
  /** Path to detected tailwind.config (for reference). */
  tailwindConfigPath: string | null;
}

/**
 * Каталог вне `node_modules`: для пути внутри него — каталог над самым внешним сегментом
 * `node_modules`, иначе сам путь. Сервер, запущенный через npx из
 * `<app>/node_modules/@reformer/mcp`, иначе принял бы за проект собственный пакет — и писал бы
 * туда то, что стирает следующий `npm ci`.
 */
export function outsideNodeModules(dir: string): string {
  const parts = resolve(dir).split(sep);
  const at = parts.indexOf('node_modules');
  return at > 0 ? resolve(parts.slice(0, at).join(sep) + sep) : resolve(dir);
}

/**
 * Walk up from the start directory looking for the nearest package.json that has
 * dependencies. Starts outside `node_modules` (installed packages are never the project).
 * Stops at the filesystem root. Returns null if not found.
 *
 * Без прежнего предела в 8 уровней: каталог формы в приложении монорепо лежит глубже, и поиск
 * обрывался, не дойдя до `package.json` приложения.
 */
function findProjectPackageJson(startDir: string): string | null {
  let dir = outsideNodeModules(startDir);
  for (;;) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        const json = JSON.parse(readFileSync(candidate, 'utf-8'));
        const allDeps = {
          ...(json.dependencies ?? {}),
          ...(json.devDependencies ?? {}),
          ...(json.peerDependencies ?? {}),
        };
        if (Object.keys(allDeps).length > 0) {
          return candidate;
        }
      } catch (error) {
        reportKnowledgeProblem('project', `${candidate}: ${String(error)}`);
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function findTailwindConfig(projectRoot: string): string | null {
  const candidates = [
    'tailwind.config.ts',
    'tailwind.config.js',
    'tailwind.config.mjs',
    'tailwind.config.cjs',
  ];
  for (const name of candidates) {
    const p = join(projectRoot, name);
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Detect project stack from a starting directory (defaults to process.cwd()).
 * Reads only package.json + checks for tailwind.config presence — no other
 * files are read (prompt-time hint only, must stay cheap).
 *
 * In monorepos pass an explicit `startDir` (the app directory), otherwise
 * detector returns the root package.json which usually lacks app-level deps.
 */
export function detectProjectStack(startDir?: string): ProjectStack {
  const start = startDir ? resolve(startDir) : process.cwd();
  const pkgPath = findProjectPackageJson(start);
  if (!pkgPath) {
    return {
      projectRoot: null,
      workspaceRoot: false,
      allDependencies: {},
      hasUiKit: false,
      hasCdk: false,
      hasRendererReact: false,
      hasRendererJson: false,
      hasTailwindDep: false,
      hasTailwindConfig: false,
      hasTailwindVitePlugin: false,
      hasTailwind: false,
      tailwindConfigPath: null,
    };
  }

  const projectRoot = dirname(pkgPath);
  let json: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    workspaces?: unknown;
  } = {};
  try {
    json = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    json = {};
  }

  const allDeps: Record<string, string> = {
    ...(json.dependencies ?? {}),
    ...(json.devDependencies ?? {}),
    ...(json.peerDependencies ?? {}),
  };

  const tailwindConfigPath = findTailwindConfig(projectRoot);
  const hasTailwindDep = '@tailwindcss/vite' in allDeps || 'tailwindcss' in allDeps;
  const hasTailwindVitePlugin = '@tailwindcss/vite' in allDeps;

  const workspaces = json.workspaces;
  const workspaceRoot = Array.isArray(workspaces)
    ? workspaces.length > 0
    : typeof workspaces === 'object' && workspaces !== null;

  return {
    projectRoot,
    workspaceRoot,
    allDependencies: allDeps,
    hasUiKit: '@reformer/ui-kit' in allDeps,
    hasCdk: '@reformer/cdk' in allDeps,
    hasRendererReact: '@reformer/renderer-react' in allDeps,
    hasRendererJson: '@reformer/renderer-json' in allDeps,
    hasTailwindDep,
    hasTailwindConfig: tailwindConfigPath !== null,
    hasTailwindVitePlugin,
    // Tailwind functional if: dep present AND (config file OR Vite plugin = v4 inline config).
    hasTailwind: hasTailwindDep && (tailwindConfigPath !== null || hasTailwindVitePlugin),
    tailwindConfigPath,
  };
}
