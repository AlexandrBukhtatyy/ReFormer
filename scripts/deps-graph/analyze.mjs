/**
 * Обход воркспейса dependency-cruiser'ом и классификация каждого импорта: свой файл,
 * другой воркспейс, пакет npm, встроенный модуль Node.
 *
 * Куда ведёт импорт, решается и по разрешённому пути, и по самому спецификатору.
 * Пакеты `@reformer/*` разрешаются в свой `dist`: на свежем клоне его нет, а часть
 * подпутей (`@reformer/ui-kit/button`) не разрешается и в собранном. Суффиксы Vite
 * (`?raw`, `?worker`) не разрешаются никогда. Имя пакета в спецификаторе есть всегда,
 * поэтому граф не зависит от того, собран ли монорепозиторий.
 */
import path from 'node:path';
import { cruise } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { isInside, ownerOf, ROOT, rootsOf, toPosix } from './workspaces.mjs';

/**
 * Сгенерированный код. `dist`, `build` и прочие выходные каталоги сюда НЕ входят: их
 * отсекает выбор корней обхода (`roots` воркспейса). dependency-cruiser сверяет
 * `exclude` и с целью импорта, а импорт пакета монорепозитория разрешается в его `dist`
 * (`../../packages/x/dist/…`) — исключение `dist` выбросило бы само ребро.
 * node_modules пропускает `doNotFollow`, в том числе при сборе файлов.
 */
const EXCLUDE = ['(^|/)_generated/'];

/** Тесты и их помощники — в граф попадают только с `--with-tests`. */
const TESTS = [
  '(^|/)(__tests__|__mocks__|tests?|testing|e2e)/',
  '\\.(test|spec|stories)\\.[cm]?[jt]sx?$',
  '(^|/)testing\\.[cm]?[jt]sx?$',
];

/**
 * Циклы по рантайм-импортам. `import type` стирается при компиляции и на порядок
 * инициализации не влияет, поэтому такие рёбра цикла не образуют.
 */
const NO_CIRCULAR = {
  name: 'no-circular',
  severity: 'warn',
  from: {},
  to: { circular: true, viaOnly: { dependencyTypesNot: ['type-only'] } },
};

const TYPE_ONLY = new Set(['type-only', 'type-import']);

/** Код, а не ресурс: `.css`, `.json`, `.eta` и прочее в число модулей не входят. */
export const isCode = (file) => /\.(?:[cm]?[jt]sx?|vue|svelte)$/.test(file);

const excludeSources = (withTests) => (withTests ? EXCLUDE : [...EXCLUDE, ...TESTS]);

/**
 * @param {import('./workspaces.mjs').Workspace} ws
 * @param {{ withTests: boolean }} options
 */
export async function cruiseWorkspace(ws, { withTests }) {
  const warnings = [];
  let tsConfig = null;
  if (ws.tsConfig) {
    try {
      tsConfig = extractTSConfig(ws.tsConfig);
    } catch (error) {
      warnings.push(
        `${path.basename(ws.tsConfig)} не прочитан, алиасы путей не резолвятся: ${error.message}`
      );
    }
  }
  const { output } = await cruise(
    rootsOf(ws, { withTests }),
    {
      baseDir: ws.dir,
      validate: true,
      ruleSet: { forbidden: [NO_CIRCULAR] },
      tsPreCompilationDeps: true,
      // Чужие каталоги (`../…`) и node_modules — листья: их устройство — дело их графа.
      doNotFollow: { path: ['node_modules', '^\\.\\./'] },
      exclude: { path: excludeSources(withTests) },
      ...(tsConfig ? { tsConfig: { fileName: ws.tsConfig } } : {}),
      outputType: 'json',
    },
    {},
    tsConfig ? { tsConfig } : {}
  );
  return { result: typeof output === 'string' ? JSON.parse(output) : output, warnings };
}

/** `@scope/name/sub` → `@scope/name`, `name/sub` → `name`. */
function packageName(specifier) {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

/**
 * @typedef {{ kind: 'own', path: string }
 *   | { kind: 'workspace' | 'npm' | 'builtin' | 'other', name: string }} Target
 */

/** @returns {Target} */
function byPath(ws, workspaces, abs) {
  const posix = toPosix(abs);
  const nm = posix.lastIndexOf('/node_modules/');
  if (nm >= 0) {
    const name = packageName(posix.slice(nm + '/node_modules/'.length));
    return workspaces.some((w) => w.name === name)
      ? { kind: 'workspace', name }
      : { kind: 'npm', name };
  }
  if (isInside(ws.dir, abs)) return { kind: 'own', path: toPosix(path.relative(ws.dir, abs)) };
  const owner = ownerOf(workspaces, abs);
  if (owner) return { kind: 'workspace', name: owner.name };
  return { kind: 'other', name: toPosix(path.relative(ROOT, abs)) };
}

/** @returns {Target} */
function classify(ws, workspaces, moduleSource, dep) {
  if (dep.coreModule) {
    return { kind: 'builtin', name: `node:${packageName(dep.module.replace(/^node:/, ''))}` };
  }
  if (!dep.couldNotResolve) return byPath(ws, workspaces, path.resolve(ws.dir, dep.resolved));
  const specifier = dep.module.replace(/[?#].*$/, '');
  if (specifier.startsWith('.')) {
    return byPath(ws, workspaces, path.resolve(ws.dir, path.dirname(moduleSource), specifier));
  }
  const name = packageName(specifier);
  if (workspaces.some((w) => w.name === name)) return { kind: 'workspace', name };
  // Алиас, который нечем разрешить (`@/…` без tsconfig, `/public/…`, `#imports`).
  if (/^(@\/|[/#~])/.test(specifier) || name === '@') return { kind: 'other', name: dep.module };
  return { kind: 'npm', name };
}

/**
 * Импорты воркспейса, сведённые к рёбрам «свой файл → цель», и циклы между модулями.
 *
 * @param {import('./workspaces.mjs').Workspace} ws
 * @param {import('./workspaces.mjs').Workspace[]} workspaces
 * @param {object} result результат `cruiseWorkspace`
 * @param {{ withTests: boolean }} options
 */
export function collect(ws, workspaces, result, { withTests }) {
  const excluded = excludeSources(withTests).map((source) => new RegExp(source));
  const own = result.modules.filter(
    (m) =>
      !m.coreModule &&
      !m.couldNotResolve &&
      !m.matchesDoNotFollow &&
      !m.source.startsWith('../') &&
      !m.source.includes('node_modules/')
  );
  const edges = [];
  for (const m of own) {
    for (const dep of m.dependencies) {
      const target = classify(ws, workspaces, m.source, dep);
      if (target.kind === 'own' && excluded.some((re) => re.test(target.path))) continue;
      edges.push({
        from: m.source,
        target,
        typeOnly: dep.dependencyTypes.some((type) => TYPE_ONLY.has(type)),
        dynamic: Boolean(dep.dynamic),
      });
    }
  }
  return { files: own.map((m) => m.source), edges, cycles: moduleCycles(result) };
}

/**
 * Циклы между модулями из нарушений `no-circular`. dependency-cruiser сообщает цикл
 * от каждого его участника, поэтому одинаковые наборы модулей сводятся в один.
 */
function moduleCycles(result) {
  const cycles = new Map();
  for (const violation of result.summary?.violations ?? []) {
    if (violation.rule?.name !== NO_CIRCULAR.name || !violation.cycle) continue;
    const members = [
      ...new Set([
        violation.from,
        ...violation.cycle.map((step) => (typeof step === 'string' ? step : step.name)),
      ]),
    ];
    const key = [...members].sort().join('\n');
    if (!cycles.has(key)) cycles.set(key, members);
  }
  return [...cycles.values()];
}
