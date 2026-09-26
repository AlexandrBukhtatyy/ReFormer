#!/usr/bin/env node
/**
 * Граф зависимостей монорепозитория или одного его проекта (dependency-cruiser).
 *
 *   npm run deps:graph                                 # весь монорепозиторий: воркспейсы и связи
 *   npm run deps:graph -- @reformer/builder            # проект: его папки и пакеты, от которых он зависит
 *   npm run deps:graph -- projects/reformer-builder    # то же по пути
 *   npm run deps:graph -- @reformer/builder --modules  # плюс граф по отдельным модулям
 *   npm run deps:graph -- --help
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { format } from 'dependency-cruiser';
import { collect, cruiseWorkspace, isCode } from './analyze.mjs';
import { monorepoGraph, plural, projectGraph, toDot } from './graph.mjs';
import { writeGraph } from './render.mjs';
import { findWorkspace, listWorkspaces, ROOT, rootsOf, toPosix } from './workspaces.mjs';

/**
 * Глубина папок-узлов для проектов, где трёх уровней мало. У билдера единица
 * архитектуры — `src/plugins/<домен>/<плагин>` и `src/shell/<слой>/<область>`,
 * это четыре сегмента.
 */
const DEPTH = { '@reformer/builder': 4 };
const DEFAULT_DEPTH = 3;
const DEFAULT_OUT = path.join(ROOT, '.tmp', 'deps-graph');

const MODULES = ['модуль', 'модуля', 'модулей'];
const GROUPS = ['группа', 'группы', 'групп'];
const LINKS = ['связь', 'связи', 'связей'];
const IMPORTS = ['импорт', 'импорта', 'импортов'];
const WORKSPACES = ['воркспейс', 'воркспейса', 'воркспейсов'];

const HELP = `Граф зависимостей монорепозитория или одного проекта (dependency-cruiser).

  npm run deps:graph [-- <проект>...] [опции]

Без проекта — весь монорепозиторий: узел — воркспейс, ребро — импорты из одного
в другой. С проектом — его устройство: узел — папка до заданной глубины, плюс
пакеты монорепозитория, от которых он зависит. Проект задаётся именем пакета
(@reformer/builder), путём (projects/reformer-builder) или именем каталога.

Опции:
  --depth <n>      глубина папок-узлов от корня проекта (по умолчанию ${DEFAULT_DEPTH}, у билдера 4)
  --focus <regex>  оставить узлы, чей путь или имя совпали, и их соседей
  --npm            показать пакеты npm и встроенные модули Node
  --with-tests     учитывать тесты: *.test.*, testing/, каталоги tests/ рядом с src
  --modules        для проекта — ещё и граф по отдельным модулям (крупный; --focus
                   действует и на него)
  --json           сохранить сырой результат dependency-cruiser
  --out <каталог>  куда писать (по умолчанию ${toPosix(path.relative(ROOT, DEFAULT_OUT))})
  -h, --help       эта справка

Результат — <каталог>/<monorepo|имя каталога проекта>/*.html, рядом .svg и .dot.
В HTML наведение подсвечивает связи узла, правый клик закрепляет, Esc снимает.`;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

let args;
try {
  args = parseArgs({
    allowPositionals: true,
    options: {
      depth: { type: 'string' },
      focus: { type: 'string' },
      npm: { type: 'boolean', default: false },
      'with-tests': { type: 'boolean', default: false },
      modules: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
      out: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
} catch (error) {
  fail(`${error.message}\n  справка: npm run deps:graph -- --help`);
}
const { values, positionals } = args;
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

// `npm run` запускает скрипт из корня, а пути пользователь пишет от своего каталога.
const cwd = process.env.INIT_CWD ?? process.cwd();
const outRoot = values.out ? path.resolve(cwd, values.out) : DEFAULT_OUT;
const options = { withTests: values['with-tests'] };
const depthOverride = values.depth === undefined ? null : Number(values.depth);
if (depthOverride !== null && !(Number.isInteger(depthOverride) && depthOverride >= 1)) {
  fail(`--depth ждёт целое число от 1, получено «${values.depth}»`);
}
let focus = null;
try {
  focus = values.focus ? new RegExp(values.focus) : null;
} catch (error) {
  fail(`--focus: ${error.message}`);
}

const workspaces = listWorkspaces();
const targets = positionals.map(
  (query) =>
    findWorkspace(workspaces, query, cwd) ??
    fail(
      `воркспейс «${query}» не найден. Есть:\n` +
        workspaces.map((ws) => `  ${ws.name.padEnd(32)} ${ws.rel}`).join('\n')
    )
);

const rel = (file) => toPosix(path.relative(ROOT, file));
const seconds = (started) => `${((performance.now() - started) / 1000).toFixed(1)} с`;

/** Дата и коммит — чтобы по картинке было видно, с какого состояния она снята. */
function stamp() {
  const date = new Date().toISOString().slice(0, 10);
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' });
  return head.status === 0 ? `${date} · ${head.stdout.trim()}` : date;
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

/** «a ×3, b ×1» — цели рёбер из узла `from`, по убыванию числа импортов. */
function targetsOf(edges, from, keep = () => true) {
  return edges
    .filter((e) => e.from === from && keep(e.to))
    .sort((a, b) => b.count - a.count)
    .map((e) => `${e.to} ×${e.count}`)
    .join(', ');
}

function printCycles(title, cycles, limit = 5) {
  if (cycles.length === 0) {
    console.log(`  ${title}: нет`);
    return;
  }
  const members = new Set(cycles.flat()).size;
  console.log(`  ${title}: ${cycles.length}, участников — ${members}`);
  for (const cycle of cycles.slice(0, limit)) {
    const shown = cycle.slice(0, 6).join(' ⇄ ');
    console.log(`    ${shown}${cycle.length > 6 ? ` ⇄ … (+${cycle.length - 6})` : ''}`);
  }
  if (cycles.length > limit) console.log(`    … и ещё ${cycles.length - limit}`);
}

async function monorepo() {
  const dir = path.join(outRoot, 'monorepo');
  console.log(
    `Монорепозиторий: ${plural(workspaces.length, WORKSPACES)}` +
      `${options.withTests ? ', с тестами' : ''}`
  );
  const collected = new Map();
  for (const ws of workspaces) {
    const started = performance.now();
    const { result, warnings } = await cruiseWorkspace(ws, options);
    const data = collect(ws, workspaces, result, options);
    collected.set(ws.name, data);
    const modules = data.files.filter(isCode).length;
    const cycles = data.cycles.length > 0 ? `  циклов между модулями: ${data.cycles.length}` : '';
    console.log(
      `  ${ws.name.padEnd(32)} ${String(modules).padStart(5)} мод.  ${seconds(started)}${cycles}`
    );
    for (const warning of warnings) console.log(`    ! ${warning}`);
    if (values.json) writeJson(path.join(dir, 'cruise', `${ws.slug}.json`), result);
  }

  const graph = monorepoGraph({ workspaces, collected, npm: values.npm, focus });
  const subtitle = [
    plural(workspaces.length, WORKSPACES),
    plural(graph.edges.length, LINKS),
    options.withTests ? 'с тестами' : 'без тестов',
    ...(focus ? [`фокус /${focus.source}/`] : []),
    stamp(),
  ].join(' · ');
  const title = 'Зависимости: монорепозиторий';
  const { dot, cycles } = toDot(graph, title, subtitle);
  const html = await writeGraph(dir, 'workspaces', dot, title);

  const names = new Set(workspaces.map((ws) => ws.name));
  console.log('\nЗависимости между воркспейсами:');
  for (const ws of workspaces) {
    const list = targetsOf(graph.edges, ws.name, (to) => names.has(to));
    if (list) console.log(`  ${ws.name} → ${list}`);
  }
  printCycles('Циклы между воркспейсами', cycles);
  console.log(`\n✓ ${rel(html)}`);
}

async function project(ws) {
  const depth = depthOverride ?? DEPTH[ws.name] ?? DEFAULT_DEPTH;
  const dir = path.join(outRoot, ws.slug);
  const started = performance.now();
  const { result, warnings } = await cruiseWorkspace(ws, options);
  const data = collect(ws, workspaces, result, options);
  for (const warning of warnings) console.log(`  ! ${warning}`);
  if (values.json) writeJson(path.join(dir, 'cruise.json'), result);

  const graph = projectGraph({ workspaces, collected: data, depth, npm: values.npm, focus });
  const modules = data.files.filter(isCode).length;
  const groups = graph.nodes.filter((n) => !n.cluster?.startsWith('ext:')).length;
  const subtitle = [
    ws.rel,
    `${plural(modules, MODULES)} → ${plural(groups, GROUPS)} (глубина ${depth})`,
    plural(graph.edges.length, LINKS),
    options.withTests ? 'с тестами' : 'без тестов',
    ...(focus ? [`фокус /${focus.source}/`] : []),
    stamp(),
  ].join(' · ');
  const title = `Зависимости: ${ws.name}`;
  const { dot, cycles } = toDot(graph, title, subtitle);
  const html = await writeGraph(dir, 'folders', dot, title);

  console.log(`${ws.name} (${ws.rel}), ${seconds(started)}`);
  console.log(
    `  ${plural(modules, MODULES)} → ${plural(groups, GROUPS)} (глубина ${depth}), ` +
      plural(graph.edges.length, LINKS)
  );
  const names = new Set(workspaces.map((w) => w.name));
  const used = new Map();
  for (const edge of data.edges) {
    if (edge.target.kind === 'workspace' && names.has(edge.target.name)) {
      used.set(edge.target.name, (used.get(edge.target.name) ?? 0) + 1);
    }
  }
  if (used.size > 0) {
    const list = [...used].sort((a, b) => b[1] - a[1]).map(([name, n]) => `${name} ×${n}`);
    console.log(`  Пакеты монорепозитория: ${list.join(', ')}`);
  }
  printCycles('Циклы между группами', cycles);
  printCycles('Циклы между модулями (без import type)', data.cycles);
  const unresolved = data.edges.filter((e) => e.target.kind === 'other');
  if (unresolved.length > 0) {
    const sample = [...new Set(unresolved.map((e) => e.target.name))].slice(0, 5).join(', ');
    console.log(`  Не разрешено: ${plural(unresolved.length, IMPORTS)} — ${sample}`);
  }
  console.log(`  ✓ ${rel(html)}`);

  if (values.modules) {
    const own = rootsOf(ws, options)
      .map((root) => `^${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(/|$)`)
      .join('|');
    const { output } = await format(result, {
      outputType: 'dot',
      includeOnly: own,
      ...(focus ? { focus: focus.source } : {}),
    });
    const modulesHtml = await writeGraph(dir, 'modules', output, `${title} — модули`);
    console.log(`  ✓ ${rel(modulesHtml)}`);
  }
}

if (targets.length === 0) {
  await monorepo();
} else {
  for (const ws of targets) await project(ws);
}
