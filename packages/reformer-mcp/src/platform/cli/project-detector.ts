import { existsSync, readFileSync } from 'fs';
import { resolve, dirname, join, sep } from 'path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { UI_KIT_PACKAGE, uiKitFromCatalog } from '../../core/generate/ui-kit-components.js';
import { defaultPackageBases } from './package-locator.js';
import { discoverUnknownStack } from './sampling-helpers.js';
import { reportKnowledgeProblem } from './problems.js';
import { loadUiKitCatalog, uiKitCatalogPaths } from './ui-kit-catalog.js';

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

/**
 * Подпути кита для своего кода агента: `@reformer/ui-kit/date-picker` — DatePicker, … .
 *
 * Берутся из каталога установленного кита, а не из списка в коде: прежняя подсказка импортировала
 * `DatePicker` из корня пакета, где его нет (ReFormer-4e7x), и называла компоненты, которых в ките
 * уже не было.
 */
function uiKitSubpathLine(stack: ProjectStack): string | null {
  const bases = stack.projectRoot ? [stack.projectRoot, ...defaultPackageBases()] : undefined;
  const kit = uiKitFromCatalog(loadUiKitCatalog(uiKitCatalogPaths(bases)));
  if (!kit.found) return null;
  const bySubpath = new Map<string, string[]>();
  for (const [name, exported] of Object.entries(kit.fields)) {
    const subpath = kit.subpaths[exported];
    if (!subpath) continue;
    // Имя в intent — registry-имя; импортируется экспорт. Где они разные, видны оба.
    const shown = name === exported ? exported : `${exported} (intent: ${name})`;
    bySubpath.set(subpath, [...(bySubpath.get(subpath) ?? []), shown]);
  }
  if (bySubpath.size === 0) return null;
  const groups = [...bySubpath]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([subpath, names]) => `\`${UI_KIT_PACKAGE}/${subpath}\` — ${[...new Set(names)].join(', ')}`
    );
  return `Components with their own subpath (not in the package root): ${groups.join('; ')}.`;
}

/**
 * Что найдено в проекте и что из этого следует для формы. Печатается в промптах `create-form`,
 * `plan-form` и `discover-context`.
 *
 * Форма собирается из intent (`form_build`), поэтому здесь нет ни списка импортов, ни правил
 * разметки модуля: компоненты называет грамматика, импорты печатает сборка. Остаётся то, что агент
 * решает сам: есть ли кит вообще и, на core, чем оформлять свою JSX-разметку.
 */
export function renderStackDetectionBlock(stack: ProjectStack): string {
  if (!stack.projectRoot) {
    return [
      '> ⚠️ No `package.json` of a project was found above the working directory. Ask the orchestrator:',
      '> "Which UI components? (a) `@reformer/ui-kit`, (b) shadcn/ui, (c) MUI, (d) plain HTML, (e) other" and',
      '> "Which styling? (a) Tailwind, (b) CSS Modules, (c) Emotion / styled-components, (d) vanilla CSS".',
    ].join('\n');
  }

  const lines: string[] = [];
  lines.push('### Detected stack');
  lines.push('');
  lines.push(`Project root: \`${stack.projectRoot}\``);
  if (stack.workspaceRoot) {
    lines.push(
      'This is a monorepo root: pass form_build and plan_form a `dir` inside an app package.'
    );
  }

  const detected: string[] = [];
  if (stack.hasUiKit) detected.push('`@reformer/ui-kit`');
  if (stack.hasCdk) detected.push('`@reformer/cdk`');
  if (stack.hasRendererReact) detected.push('`@reformer/renderer-react`');
  if (stack.hasRendererJson) detected.push('`@reformer/renderer-json`');
  if (stack.hasTailwind) {
    detected.push(
      stack.hasTailwindVitePlugin && !stack.hasTailwindConfig
        ? 'Tailwind CSS (v4 via @tailwindcss/vite)'
        : 'Tailwind CSS'
    );
  }
  lines.push(
    `Detected: ${detected.length > 0 ? detected.join(', ') : 'none of the known stacks'}.`
  );
  lines.push('');

  if (stack.hasUiKit) {
    lines.push(
      '- **UI components → `@reformer/ui-kit`.** In the intent, `component` is a name from the grammar; ' +
        'form_build writes the imports. In your own JSX (markup on core): ' +
        "`import { FormField } from '@reformer/ui-kit'`, a field is `<FormField control={bundle.form.email} />`."
    );
    const subpaths = uiKitSubpathLine(stack);
    if (subpaths) lines.push(`  ${subpaths}`);
  } else {
    lines.push(
      '- ⚠️ **`@reformer/ui-kit` is not a dependency.** Ask the orchestrator which UI components to use: ' +
        '(a) add `@reformer/ui-kit`, (b) shadcn/ui, (c) MUI, (d) plain HTML, (e) other. Do not build the form until answered.'
    );
  }

  if (stack.hasTailwind) {
    lines.push(
      '- **Styling (only your JSX on core):** layout classes only — rhythm `space-y-6` → `space-y-4` → ' +
        '`space-y-3`, grid `grid grid-cols-1 md:grid-cols-2 gap-4`; looks come from components (`Card`, `Alert`, ' +
        '`Separator`), never hand-written `bg-*` / `border-*` / `shadow-*` / `rounded-*`. Rules: ' +
        '`find_recipe {"topic":"form-layout","package":"ui-kit"}`.'
    );
  } else if (stack.hasTailwindDep || stack.hasTailwindConfig) {
    lines.push(
      '- ⚠️ Tailwind is only partly set up (' +
        (stack.hasTailwindDep ? 'dependency yes' : 'dependency no') +
        ', ' +
        (stack.hasTailwindConfig ? 'config yes' : 'config no') +
        '). On core ask the orchestrator before writing classes.'
    );
  } else {
    lines.push(
      '- Styling system not detected: renderer targets need none; on core ask the orchestrator before writing classes.'
    );
  }

  return lines.join('\n');
}

/**
 * Async variant of {@link renderStackDetectionBlock} that asks the connected
 * client LLM (via sampling) for likely UI library + styling system when local
 * detection couldn't find `@reformer/ui-kit` or Tailwind.
 *
 * Falls back to the synchronous `renderStackDetectionBlock` output (legacy
 * MCP-gap question) when the client doesn't support sampling, the call fails,
 * or the LLM has no useful suggestion.
 *
 * Pass `server` from the MCP request handler. Without `server`, behaves
 * exactly like the sync version.
 */
export async function renderStackDetectionBlockAsync(
  stack: ProjectStack,
  server?: Server
): Promise<string> {
  // Only kick in when we have a project root but failed to find both ui-kit
  // and Tailwind — that's the case where the legacy block becomes a static
  // "ask the orchestrator" question. With sampling we can do better.
  const needsDiscovery = stack.projectRoot !== null && !stack.hasUiKit && !stack.hasTailwind;
  if (!needsDiscovery || !server) {
    return renderStackDetectionBlock(stack);
  }

  const discovered = await discoverUnknownStack(server, stack);
  if (!discovered || (!discovered.uiKit && !discovered.styling)) {
    return renderStackDetectionBlock(stack);
  }

  const lines: string[] = [];
  lines.push('### Detected stack (LLM-assisted)');
  lines.push('');
  lines.push(`Project root: \`${stack.projectRoot}\``);
  lines.push('');
  lines.push(
    '**LLM analysis of dependencies suggests:**' +
      (discovered.uiKit ? `\n- UI library: \`${discovered.uiKit}\`` : '') +
      (discovered.styling ? `\n- Styling system: \`${discovered.styling}\`` : '')
  );
  lines.push('');
  lines.push(
    '> ⚠️ This is an LLM guess based on `package.json`, not a verified detection. ' +
      'Confirm with the orchestrator before generating code.'
  );
  return lines.join('\n');
}
