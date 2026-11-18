/**
 * Снимки кучи V8 по CDP и их разбор: утечка это или прогрев.
 *
 * Рост `JSHeapUsedSize` между перемонтированиями — не обязательно утечка. В первые десятки циклов
 * кучу растит сам движок: байт-код, векторы обратной связи, оптимизированный код и его служебные
 * списки (типы узлов `code` и `hidden`). Утечка — это удержанные объекты: замыкания, массивы, ноды
 * формы, DOM-обёртки. Снимок до и после серии циклов разделяет одно и другое: {@link objectBytes}
 * считает объёмы без типов JIT ({@link JIT_TYPES}), {@link freshGroups} показывает объекты, созданные
 * между снимками и пережившие сборку, а {@link retainerPath} — кто их держит.
 *
 * Только стираемый TypeScript и без относительных импортов: файл импортируют и раннер Playwright, и
 * скрипты `.mjs` (Node снимает типы сам).
 *
 * @module lib/heap
 */

import type { CDPSession } from '@playwright/test';

/** Типы узлов снимка, которые растит JIT, а не код страницы: код, служебные структуры, формы. */
export const JIT_TYPES: ReadonlySet<string> = new Set([
  'code',
  'hidden',
  'object shape',
  'synthetic',
]);

/** Снимок в разобранном виде: плоские массивы узлов и рёбер, как их отдаёт V8. */
export interface HeapSnapshot {
  readonly nodes: readonly number[];
  readonly edges: readonly number[];
  readonly strings: readonly string[];
  readonly nodeFields: number;
  readonly edgeFields: number;
  readonly nodeTypes: readonly string[];
  readonly edgeTypes: readonly string[];
  /** Смещения полей узла: тип, имя, id, собственный размер, число рёбер. */
  readonly at: { type: number; name: number; id: number; size: number; edgeCount: number };
  /** Смещения полей ребра: тип, имя или индекс, узел-цель (смещение в `nodes`). */
  readonly edge: { type: number; name: number; to: number };
  /** Число узлов. */
  readonly count: number;
  /** Начало рёбер узла `i` в `edges` — `firstEdge[i]`, конец — `firstEdge[i + 1]`. */
  readonly firstEdge: Int32Array;
}

/** Сырой снимок — JSON формата `.heapsnapshot`. */
interface RawSnapshot {
  snapshot: {
    meta: {
      node_fields: string[];
      node_types: [string[], ...unknown[]];
      edge_fields: string[];
      edge_types: [string[], ...unknown[]];
    };
  };
  nodes: number[];
  edges: number[];
  strings: string[];
}

/** Объём и число узлов. */
export interface Tally {
  count: number;
  size: number;
}

/** Снять снимок кучи страницы. Снимок сам запускает полную сборку мусора. */
export async function takeHeapSnapshot(session: CDPSession): Promise<HeapSnapshot> {
  const chunks: string[] = [];
  const onChunk = (event: { chunk: string }): void => {
    chunks.push(event.chunk);
  };
  await session.send('HeapProfiler.enable');
  session.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
  try {
    await session.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  } finally {
    session.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
  }
  return parseHeapSnapshot(JSON.parse(chunks.join('')) as RawSnapshot);
}

export function parseHeapSnapshot(raw: RawSnapshot): HeapSnapshot {
  const meta = raw.snapshot.meta;
  const nodeFields = meta.node_fields.length;
  const edgeFields = meta.edge_fields.length;
  const at = {
    type: meta.node_fields.indexOf('type'),
    name: meta.node_fields.indexOf('name'),
    id: meta.node_fields.indexOf('id'),
    size: meta.node_fields.indexOf('self_size'),
    edgeCount: meta.node_fields.indexOf('edge_count'),
  };
  const edge = {
    type: meta.edge_fields.indexOf('type'),
    name: meta.edge_fields.indexOf('name_or_index'),
    to: meta.edge_fields.indexOf('to_node'),
  };
  const count = raw.nodes.length / nodeFields;
  const firstEdge = new Int32Array(count + 1);
  for (let i = 0, offset = 0; i < count; i++) {
    firstEdge[i] = offset;
    offset += raw.nodes[i * nodeFields + at.edgeCount] * edgeFields;
    firstEdge[i + 1] = offset;
  }
  return {
    nodes: raw.nodes,
    edges: raw.edges,
    strings: raw.strings,
    nodeFields,
    edgeFields,
    nodeTypes: meta.node_types[0],
    edgeTypes: meta.edge_types[0],
    at,
    edge,
    count,
    firstEdge,
  };
}

export const nodeType = (s: HeapSnapshot, i: number): string =>
  s.nodeTypes[s.nodes[i * s.nodeFields + s.at.type]];

export const nodeName = (s: HeapSnapshot, i: number): string =>
  s.strings[s.nodes[i * s.nodeFields + s.at.name]];

const nodeId = (s: HeapSnapshot, i: number): number => s.nodes[i * s.nodeFields + s.at.id];

const nodeSize = (s: HeapSnapshot, i: number): number => s.nodes[i * s.nodeFields + s.at.size];

/** Объём и число узлов по типам снимка. */
export function totalsByType(s: HeapSnapshot): Map<string, Tally> {
  const out = new Map<string, Tally>();
  for (let i = 0; i < s.count; i++) {
    const type = nodeType(s, i);
    const tally = out.get(type) ?? { count: 0, size: 0 };
    tally.count++;
    tally.size += nodeSize(s, i);
    out.set(type, tally);
  }
  return out;
}

/** Байты объектов кода страницы — всё, кроме типов JIT. */
export function objectBytes(totals: ReadonlyMap<string, Tally>): number {
  let bytes = 0;
  for (const [type, tally] of totals) if (!JIT_TYPES.has(type)) bytes += tally.size;
  return bytes;
}

/** Чистый прирост по типам от `before` к `after`: только изменившиеся, по убыванию объёма. */
export function netGrowth(
  before: ReadonlyMap<string, Tally>,
  after: ReadonlyMap<string, Tally>
): Array<{ type: string } & Tally> {
  const types = new Set([...before.keys(), ...after.keys()]);
  return [...types]
    .map((type) => ({
      type,
      count: (after.get(type)?.count ?? 0) - (before.get(type)?.count ?? 0),
      size: (after.get(type)?.size ?? 0) - (before.get(type)?.size ?? 0),
    }))
    .filter((row) => row.count !== 0 || row.size !== 0)
    .sort((a, b) => b.size - a.size);
}

/** Группа объектов «тип::имя» и несколько её узлов — для путей удержания. */
export interface FreshGroup extends Tally {
  readonly key: string;
  readonly type: string;
  readonly samples: number[];
}

/**
 * Объекты снимка `after`, которых не было в `before` (по id узла) и которые пережили сборку, —
 * по группам «тип::имя», по убыванию объёма. Сюда попадает и подмена: если после каждого цикла жива
 * ровно одна последняя форма, её объекты — новые, хотя число живых не растёт; это видно по
 * {@link netGrowth} и {@link classCounts}.
 */
export function freshGroups(before: HeapSnapshot, after: HeapSnapshot): FreshGroup[] {
  const known = new Set<number>();
  for (let i = 0; i < before.count; i++) known.add(nodeId(before, i));
  const groups = new Map<string, FreshGroup>();
  for (let i = 0; i < after.count; i++) {
    if (known.has(nodeId(after, i))) continue;
    const type = nodeType(after, i);
    const key = `${type}::${nodeName(after, i).replace(/\s+/g, ' ').slice(0, 60)}`;
    let group = groups.get(key);
    if (group === undefined) {
      group = { key, type, count: 0, size: 0, samples: [] };
      groups.set(key, group);
    }
    group.count++;
    group.size += nodeSize(after, i);
    if (group.samples.length < 3) group.samples.push(i);
  }
  return [...groups.values()].sort((a, b) => b.size - a.size);
}

/** Число узлов с данными именами конструкторов (и их отключённых DOM-вариантов `Detached …`). */
export function classCounts(s: HeapSnapshot, names: readonly string[]): Record<string, number> {
  const wanted = new Set(names.flatMap((name) => [name, `Detached ${name}`]));
  const out: Record<string, number> = {};
  for (let i = 0; i < s.count; i++) {
    const name = nodeName(s, i);
    if (wanted.has(name)) out[name] = (out[name] ?? 0) + 1;
  }
  return out;
}

/** Подпись узла: тип, имя, id. */
export function nodeLabel(s: HeapSnapshot, i: number): string {
  return `${nodeType(s, i)}:${nodeName(s, i).replace(/\s+/g, ' ').slice(0, 48)}@${nodeId(s, i)}`;
}

function edgeName(s: HeapSnapshot, offset: number): string {
  const type = s.edgeTypes[s.edges[offset + s.edge.type]];
  const name = s.edges[offset + s.edge.name];
  return type === 'element' || type === 'hidden' ? `[${name}]` : String(s.strings[name]);
}

/**
 * Ребро не держит цель само: слабое, либо ребро таблицы `WeakMap` к значению («part of key … ->
 * value …») — значение живо, только пока жив ключ, и путь через него ложный.
 */
function holdsWeakly(s: HeapSnapshot, offset: number): boolean {
  const type = s.edgeTypes[s.edges[offset + s.edge.type]];
  if (type === 'weak') return true;
  return type === 'internal' && edgeName(s, offset).includes('part of key');
}

/** Расстояния от корня и обратные рёбра — строятся один раз на снимок. */
interface RetainerIndex {
  readonly distance: Int32Array;
  readonly start: Int32Array;
  readonly from: Int32Array;
  readonly via: Int32Array;
}

const indexes = new WeakMap<HeapSnapshot, RetainerIndex>();

function retainerIndex(s: HeapSnapshot): RetainerIndex {
  const cached = indexes.get(s);
  if (cached !== undefined) return cached;
  const distance = new Int32Array(s.count).fill(-1);
  const queue = new Int32Array(s.count);
  let head = 0;
  let tail = 0;
  distance[0] = 0;
  queue[tail++] = 0;
  while (head < tail) {
    const node = queue[head++];
    for (let e = s.firstEdge[node]; e < s.firstEdge[node + 1]; e += s.edgeFields) {
      if (holdsWeakly(s, e)) continue;
      const to = s.edges[e + s.edge.to] / s.nodeFields;
      if (distance[to] !== -1) continue;
      distance[to] = distance[node] + 1;
      queue[tail++] = to;
    }
  }
  const start = new Int32Array(s.count + 1);
  for (let node = 0; node < s.count; node++)
    for (let e = s.firstEdge[node]; e < s.firstEdge[node + 1]; e += s.edgeFields)
      if (!holdsWeakly(s, e)) start[s.edges[e + s.edge.to] / s.nodeFields + 1]++;
  for (let i = 0; i < s.count; i++) start[i + 1] += start[i];
  const from = new Int32Array(start[s.count]);
  const via = new Int32Array(start[s.count]);
  const fill = start.slice();
  for (let node = 0; node < s.count; node++)
    for (let e = s.firstEdge[node]; e < s.firstEdge[node + 1]; e += s.edgeFields) {
      if (holdsWeakly(s, e)) continue;
      const to = s.edges[e + s.edge.to] / s.nodeFields;
      from[fill[to]] = node;
      via[fill[to]] = e;
      fill[to]++;
    }
  const index = { distance, start, from, via };
  indexes.set(s, index);
  return index;
}

/**
 * Кратчайший путь удержания узла от корня снимка: строки «держатель --ребро-->», последняя — сам
 * узел. Слабые рёбра и рёбра таблиц `WeakMap` не считаются. Пустой путь с пометкой — узел держат
 * только они (до следующей сборки).
 */
export function retainerPath(s: HeapSnapshot, target: number, depth = 16): string[] {
  const { distance, start, from, via } = retainerIndex(s);
  const steps: string[] = [];
  let current = target;
  while (current !== 0 && steps.length < 64) {
    const d = distance[current];
    if (d <= 0) {
      steps.push('(держат только слабые ссылки)');
      break;
    }
    let holder = -1;
    let edge = -1;
    for (let r = start[current]; r < start[current + 1]; r++) {
      if (distance[from[r]] !== d - 1) continue;
      holder = from[r];
      edge = via[r];
      break;
    }
    if (holder < 0) break;
    const type = s.edgeTypes[s.edges[edge + s.edge.type]];
    steps.push(`${nodeLabel(s, holder)} --${type}:${edgeName(s, edge).slice(0, 60)}-->`);
    current = holder;
  }
  return [...steps.reverse().slice(-depth), nodeLabel(s, target)];
}
