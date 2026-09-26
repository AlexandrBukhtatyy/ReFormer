/**
 * Граф групп из рёбер «файл → цель» и его печать на языке DOT (Graphviz).
 *
 * Два масштаба: проект — узел это папка, урезанная до заданной глубины, плюс пакеты,
 * от которых проект зависит; монорепозиторий — узел это воркспейс.
 */
import path from 'node:path';
import { isCode } from './analyze.mjs';

/** Заливка узлов: цвет на кластер, в котором лежит узел; воркспейсы — на каталог. */
const PALETTE = [
  '#dbeafe',
  '#dcfce7',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#cffafe',
  '#ffedd5',
  '#e0e7ff',
  '#ecfccb',
  '#fae8ff',
  '#fee2e2',
  '#e2e8f0',
];
const CLUSTER_FILL = ['#fbfbfc', '#f4f5f7', '#eceef2', '#e4e7ec', '#dde1e7'];
const EXTERNAL = {
  workspace: { cluster: 'пакеты монорепозитория', fill: '#e0f2fe' },
  npm: { cluster: 'npm', fill: '#f3f4f6' },
  builtin: { cluster: 'npm', fill: '#f3f4f6' },
  other: { cluster: 'не разрешено', fill: '#fee2e2' },
};
const CYCLE = '#dc2626';

/** Русское множественное число: `plural(5, ['модуль', 'модуля', 'модулей'])`. */
export function plural(n, [one, few, many]) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}

const MODULES = ['модуль', 'модуля', 'модулей'];
const IMPORTS = ['импорт', 'импорта', 'импортов'];

/** Группа своего файла: его папка, урезанная до `depth` сегментов от корня воркспейса. */
export function folderGroup(file, depth) {
  const segments = file.split('/').slice(0, -1);
  return segments.length === 0 ? file : segments.slice(0, depth).join('/');
}

/** Складывает рёбра между одной и той же парой узлов; петли отбрасываются. */
function mergeEdges(list) {
  const merged = new Map();
  for (const edge of list) {
    if (edge.from === edge.to) continue;
    const key = `${edge.from}\u0000${edge.to}`;
    const acc = merged.get(key) ?? {
      from: edge.from,
      to: edge.to,
      count: 0,
      typeOnly: 0,
      dynamic: 0,
    };
    acc.count += 1;
    if (edge.typeOnly) acc.typeOnly += 1;
    if (edge.dynamic) acc.dynamic += 1;
    merged.set(key, acc);
  }
  return [...merged.values()];
}

/**
 * Циклы — компоненты сильной связности из двух и более узлов (Тарьян) по рёбрам,
 * где есть хоть один рантайм-импорт: связь только через `import type` цикла не даёт.
 */
export function findCycles(nodeIds, edges) {
  const next = new Map();
  for (const edge of edges) {
    if (edge.count > edge.typeOnly) next.set(edge.from, [...(next.get(edge.from) ?? []), edge.to]);
  }
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const cycles = [];
  let counter = 0;
  const visit = (v) => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of next.get(v) ?? []) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), index.get(w)));
      }
    }
    if (low.get(v) !== index.get(v)) return;
    const component = [];
    let w;
    do {
      w = stack.pop();
      onStack.delete(w);
      component.push(w);
    } while (w !== v);
    if (component.length > 1) cycles.push(component.sort());
  };
  for (const id of nodeIds) if (!index.has(id)) visit(id);
  return cycles;
}

/** Оставляет узлы, чей id совпал с `focus`, их соседей и рёбра между ними. */
function applyFocus(graph, focus) {
  if (!focus) return graph;
  const hit = new Set(graph.nodes.filter((n) => focus.test(n.id)).map((n) => n.id));
  const edges = graph.edges.filter((e) => hit.has(e.from) || hit.has(e.to));
  const keep = new Set([...hit, ...edges.flatMap((e) => [e.from, e.to])]);
  return { ...graph, nodes: graph.nodes.filter((n) => keep.has(n.id)), edges };
}

/** Кластеры для узлов: сама папка и все её предки, с подписью по последнему сегменту. */
function folderClusters(ids) {
  const clusters = new Map();
  for (const id of ids) {
    let dir = id;
    while (dir && dir !== '.' && !clusters.has(dir)) {
      const parent = path.posix.dirname(dir);
      clusters.set(dir, {
        id: dir,
        label: path.posix.basename(dir),
        parent: parent === '.' ? null : parent,
      });
      dir = parent;
    }
  }
  return [...clusters.values()];
}

/**
 * Граф проекта: папки заданной глубины и внешние пакеты.
 *
 * @param {object} args
 * @param {import('./workspaces.mjs').Workspace[]} args.workspaces
 * @param {{ files: string[], edges: object[] }} args.collected
 * @param {number} args.depth
 * @param {boolean} args.npm   показывать ли пакеты npm и встроенные модули Node
 * @param {RegExp | null} args.focus
 */
export function projectGraph({ workspaces, collected, depth, npm, focus }) {
  const groupOf = (file) => folderGroup(file, depth);
  const modules = new Map();
  for (const file of collected.files) {
    const group = groupOf(file);
    modules.set(group, (modules.get(group) ?? 0) + (isCode(file) ? 1 : 0));
  }
  const externals = new Map();
  const raw = [];
  for (const edge of collected.edges) {
    const { target } = edge;
    let to;
    if (target.kind === 'own') {
      to = groupOf(target.path);
      if (!modules.has(to)) modules.set(to, 0);
    } else {
      if (!npm && (target.kind === 'npm' || target.kind === 'builtin')) continue;
      to = target.name;
      externals.set(to, { kind: target.kind, imports: (externals.get(to)?.imports ?? 0) + 1 });
    }
    raw.push({ from: groupOf(edge.from), to, typeOnly: edge.typeOnly, dynamic: edge.dynamic });
  }

  const groups = [...modules.keys()].sort();
  // Папка, внутри которой есть другие группы, — кластер; её собственные файлы — узел `имя/*`.
  const isParent = (g) => groups.some((other) => other.startsWith(`${g}/`));
  const placement = (g) => {
    if (isParent(g)) return g;
    const dir = path.posix.dirname(g);
    return dir === '.' ? null : dir;
  };
  const colorKey = (g) => placement(g) ?? g;
  const colors = new Map(
    [...new Set(groups.map(colorKey))].sort().map((key, i) => [key, PALETTE[i % PALETTE.length]])
  );
  const rel = new Map(workspaces.map((ws) => [ws.name, ws.rel]));

  const nodes = [
    ...groups.map((g) => {
      const n = modules.get(g);
      return {
        id: g,
        label: isParent(g) ? `${path.posix.basename(g)}/*` : path.posix.basename(g),
        meta: n > 0 ? plural(n, MODULES) : 'ресурсы',
        cluster: placement(g),
        fill: colors.get(colorKey(g)),
        tooltip: `${g} — ${n > 0 ? plural(n, MODULES) : 'только ресурсы'}`,
      };
    }),
    ...[...externals].map(([name, { kind, imports }]) => ({
      id: name,
      label: name,
      meta: kind === 'workspace' ? rel.get(name) : plural(imports, IMPORTS),
      cluster: `ext:${EXTERNAL[kind].cluster}`,
      fill: EXTERNAL[kind].fill,
      tooltip: `${name} — ${plural(imports, IMPORTS)} из проекта`,
      last: true,
    })),
  ];
  const clusters = [
    ...folderClusters(nodes.map((n) => n.cluster).filter((c) => c && !c.startsWith('ext:'))),
    ...[...new Set(nodes.map((n) => n.cluster).filter((c) => c?.startsWith('ext:')))].map((id) => ({
      id,
      label: id.slice(4),
      parent: null,
    })),
  ];
  return applyFocus({ nodes, clusters, edges: mergeEdges(raw) }, focus);
}

/**
 * Граф монорепозитория: узел — воркспейс, ребро — импорты из одного в другой.
 *
 * @param {object} args
 * @param {import('./workspaces.mjs').Workspace[]} args.workspaces
 * @param {Map<string, { files: string[], edges: object[] }>} args.collected по имени воркспейса
 * @param {boolean} args.npm
 * @param {RegExp | null} args.focus
 */
export function monorepoGraph({ workspaces, collected, npm, focus }) {
  const raw = [];
  const externals = new Map();
  for (const ws of workspaces) {
    for (const edge of collected.get(ws.name)?.edges ?? []) {
      const { target } = edge;
      if (target.kind === 'own' || target.kind === 'other') continue;
      if (target.kind !== 'workspace') {
        if (!npm) continue;
        externals.set(target.name, (externals.get(target.name) ?? 0) + 1);
      }
      raw.push({ from: ws.name, to: target.name, typeOnly: edge.typeOnly, dynamic: edge.dynamic });
    }
  }
  const dirs = [...new Set(workspaces.map((ws) => path.posix.dirname(ws.rel)))].sort();
  const colors = new Map(dirs.map((dir, i) => [dir, PALETTE[i % PALETTE.length]]));
  const nodes = [
    ...workspaces.map((ws) => {
      const n = (collected.get(ws.name)?.files ?? []).filter(isCode).length;
      return {
        id: ws.name,
        label: ws.name,
        meta: `${ws.rel} · ${plural(n, MODULES)}`,
        cluster: path.posix.dirname(ws.rel),
        fill: n > 0 ? colors.get(path.posix.dirname(ws.rel)) : '#f3f4f6',
        tooltip: `${ws.name} (${ws.rel}) — ${plural(n, MODULES)}`,
      };
    }),
    ...[...externals].map(([name, imports]) => ({
      id: name,
      label: name,
      meta: plural(imports, IMPORTS),
      cluster: 'ext:npm',
      fill: EXTERNAL.npm.fill,
      tooltip: `${name} — ${plural(imports, IMPORTS)} из воркспейсов`,
    })),
  ];
  const clusters = [
    ...folderClusters(dirs),
    ...(externals.size > 0 ? [{ id: 'ext:npm', label: 'npm', parent: null }] : []),
  ];
  return applyFocus({ nodes, clusters, edges: mergeEdges(raw) }, focus);
}

const quote = (s) => `"${String(s).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
const xml = (s) =>
  String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const attrs = (map) =>
  Object.entries(map)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) =>
      key === 'label' && String(value).startsWith('<')
        ? `${key}=${value}`
        : `${key}=${quote(value)}`
    )
    .join(', ');

/**
 * Печать графа на языке DOT. Кластеры вложены по полю `parent`; узел в цикле и рёбра
 * цикла — красные, ребро только из `import type` — пунктир, только из `import()` — точки.
 *
 * @param {object} graph
 * @param {string} title
 * @param {string} subtitle
 */
export function toDot({ nodes, clusters, edges }, title, subtitle) {
  const cycles = findCycles(
    nodes.map((n) => n.id),
    edges
  );
  const cycleOf = new Map(cycles.flatMap((members, i) => members.map((id) => [id, i])));
  const legend =
    'сплошная — импорт в рантайме · пунктир — только import type · ' +
    'синие точки — только динамический import() · красное — цикл · толщина — число импортов';
  const lines = [
    'digraph dependencies {',
    `  graph [${attrs({
      rankdir: 'LR',
      // Один ранжир на весь граф: ограничения `rank` действуют сквозь кластеры.
      newrank: 'true',
      // Параллельные рёбра сливаются в пучки: у билдера граф вдвое ниже. Подсветка и
      // подсказки не страдают — у каждого ребра остаются свои `<title>` и tooltip.
      concentrate: 'true',
      splines: 'true',
      nodesep: '0.22',
      ranksep: '1.1',
      fontname: 'Helvetica',
      fontsize: '12',
      labelloc: 't',
      labeljust: 'l',
      label: `<<b>${xml(title)}</b><br align="left"/><font point-size="10">${xml(subtitle)}</font><br align="left"/><font point-size="9" color="#4b5563">${xml(legend)}</font><br align="left"/>>`,
    })}];`,
    `  node [${attrs({
      shape: 'box',
      style: 'rounded,filled',
      fontname: 'Helvetica',
      fontsize: '10',
      color: '#9ca3af',
      margin: '0.12,0.04',
    })}];`,
    `  edge [${attrs({ color: '#6b7280', arrowsize: '0.6' })}];`,
  ];

  const nodesIn = Map.groupBy(nodes, (n) => n.cluster ?? null);
  const clustersIn = Map.groupBy(clusters, (c) => c.parent ?? null);
  const emit = (clusterId, depth) => {
    const pad = '  '.repeat(depth + 1);
    for (const node of nodesIn.get(clusterId) ?? []) {
      const inCycle = cycleOf.has(node.id);
      lines.push(
        `${pad}${quote(node.id)} [${attrs({
          label: `<<b>${xml(node.label)}</b><br/><font point-size="8" color="#4b5563">${xml(node.meta)}</font>>`,
          fillcolor: node.fill,
          tooltip: node.tooltip,
          color: inCycle ? CYCLE : undefined,
          penwidth: inCycle ? '2' : undefined,
        })}];`
      );
    }
    for (const cluster of clustersIn.get(clusterId) ?? []) {
      lines.push(`${pad}subgraph ${quote(`cluster_${cluster.id}`)} {`);
      lines.push(
        `${pad}  graph [${attrs({
          label: cluster.label,
          style: 'rounded,filled',
          fillcolor: CLUSTER_FILL[Math.min(depth, CLUSTER_FILL.length - 1)],
          color: '#d1d5db',
          fontsize: '11',
          labeljust: 'l',
          tooltip: cluster.id.replace(/^ext:/, ''),
        })}];`
      );
      emit(cluster.id, depth + 1);
      lines.push(`${pad}}`);
    }
  };
  emit(null, 0);
  // Внешние пакеты — последней колонкой. Без этого dot делит их ранги с кластером
  // проекта, ставит пакеты под ним, и рёбра к ним уходят длинными дугами вниз.
  const last = nodes.filter((n) => n.last).map((n) => quote(n.id));
  if (last.length > 0) lines.push(`  { rank=max; ${last.join('; ')}; }`);

  for (const edge of edges) {
    const runtime = edge.count - edge.typeOnly;
    const cyclic = cycleOf.has(edge.from) && cycleOf.get(edge.from) === cycleOf.get(edge.to);
    const typeOnly = runtime === 0;
    const lazy = !typeOnly && edge.dynamic >= runtime;
    lines.push(
      `  ${quote(edge.from)} -> ${quote(edge.to)} [${attrs({
        style: typeOnly ? 'dashed' : lazy ? 'dotted' : undefined,
        color: cyclic && !typeOnly ? CYCLE : typeOnly ? '#9ca3af' : lazy ? '#2563eb' : undefined,
        penwidth: (0.7 + Math.min(2.8, Math.log2(edge.count) * 0.55)).toFixed(2),
        tooltip:
          `${edge.from} → ${edge.to}: ${plural(edge.count, IMPORTS)}` +
          (edge.typeOnly > 0 ? `, из них только типы — ${edge.typeOnly}` : '') +
          (edge.dynamic > 0 ? `, динамических — ${edge.dynamic}` : ''),
      })}];`
    );
  }
  lines.push('}');
  return { dot: `${lines.join('\n')}\n`, cycles };
}
