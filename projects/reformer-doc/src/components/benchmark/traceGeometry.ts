/**
 * Геометрия графиков трейсов — чистые функции, перенос из
 * projects/forms-benchmark-e2e/scripts/traces-html.mjs (`chart`, `niceMax`, подсказка). Линия
 * рисуется в viewBox `VB_W × VB_H` с `preserveAspectRatio="none"`: SVG тянется на ширину колонки,
 * а толщину линии держит `vector-effect: non-scaling-stroke`.
 */
import type { TraceForm, TraceMetric, TracePhase } from './types';

export const VB_W = 1000;
export const VB_H = 100;
/** Корзин курсора по оси: шаг стрелок клавиатуры и точность подсказки. */
export const CURSOR_STEPS = 300;

/** «Круглый» верх оси: 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ. */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

export const tickText = (v: number): string => String(+v.toFixed(2));

/** Отрезок из файла (`[x0, y0, dx1, y1, …]`) → абсолютные x: `[x0, y0, x1, y1, …]`. */
export function decodeSegment(seg: number[]): number[] {
  const out = seg.slice();
  for (let i = 2; i < out.length; i += 2) out[i] += out[i - 2];
  return out;
}

export type Lines = Record<string, Record<TraceMetric, number[][]>>;

export function decodeLines(form: TraceForm): Lines {
  const out: Lines = {};
  for (const [lib, metrics] of Object.entries(form.libs))
    out[lib] = {
      heap: metrics.heap.map(decodeSegment),
      nodes: metrics.nodes.map(decodeSegment),
      listeners: metrics.listeners.map(decodeSegment),
    };
  return out;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Путь линии в единицах viewBox; отрезок из одной точки — короткий штрих, иначе он не виден. */
export function pathOf(segs: number[][], total: number, yMax: number): string {
  const xOf = (x: number) => r1((x / total) * VB_W);
  const yOf = (y: number) => r1(VB_H - (y / yMax) * VB_H);
  return segs
    .filter((s) => s.length >= 2)
    .map((s) => {
      let d = '';
      for (let i = 0; i < s.length; i += 2) d += `${i ? 'L' : 'M'}${xOf(s[i])},${yOf(s[i + 1])}`;
      return s.length === 2 ? `${d}h1` : d;
    })
    .join('');
}

/**
 * Значение линии в момент `x` (мс): последняя точка отрезка не правее `x` — счётчики трассы
 * ступенчатые. Вне отрезков (участник ещё не дошёл или уже закончил) — `null`.
 */
export function valueAt(segs: number[][], x: number): number | null {
  for (const s of segs) {
    const n = s.length / 2;
    if (!n || x < s[0] || x > s[(n - 1) * 2]) continue;
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (s[mid * 2] <= x) lo = mid;
      else hi = mid - 1;
    }
    return s[lo * 2 + 1];
  }
  return null;
}

/**
 * Значение линии в момент `x` или последнее до него — подпись у правого края окна: участник мог
 * закончить раньше. До первой точки — `null`.
 */
export function valueAtOrBefore(segs: number[][], x: number): number | null {
  let best: number | null = null;
  let bestX = -Infinity;
  for (const s of segs) {
    for (let i = 0; i < s.length; i += 2) {
      if (s[i] > x) break;
      if (s[i] >= bestX) {
        bestX = s[i];
        best = s[i + 1];
      }
    }
  }
  return best;
}

/** Максимум линии на участке `[x0, x1]` — вместе со значением, действовавшим в момент `x0`. */
export function maxInRange(segs: number[][], x0: number, x1: number): number {
  let max = valueAt(segs, x0) ?? 0;
  for (const s of segs) {
    for (let i = 0; i < s.length; i += 2) {
      if (s[i] > x1) break;
      if (s[i] >= x0 && s[i + 1] > max) max = s[i + 1];
    }
  }
  return max;
}

/** Окно оси X в мс: видимый участок трассы. */
export interface View {
  x0: number;
  x1: number;
}

/** Самое узкое окно — 1/400 трассы, но не меньше 20 мс. */
export const minSpan = (total: number): number => Math.max(total / 400, 20);

/** Окно в пределах трассы: ширина от `minSpan` до всей трассы, края внутри `[0, total]`. */
export function clampView(view: View, total: number): View {
  const span = Math.min(total, Math.max(minSpan(total), view.x1 - view.x0));
  const x0 = Math.min(Math.max(0, view.x0), total - span);
  return { x0, x1: x0 + span };
}

/** Масштаб вокруг точки окна (`at` — доля ширины, 0–1): `factor` < 1 приближает. */
export function zoomView(view: View, total: number, at: number, factor: number): View {
  const span = view.x1 - view.x0;
  const anchor = view.x0 + at * span;
  const next = Math.min(total, Math.max(minSpan(total), span * factor));
  return clampView({ x0: anchor - at * next, x1: anchor - at * next + next }, total);
}

/** Сдвиг окна на `dx` мс без смены ширины. */
export const panView = (view: View, total: number, dx: number): View =>
  clampView({ x0: view.x0 + dx, x1: view.x1 + dx }, total);

/** Номера фаз (с 0), которые видны в окне хотя бы частично. */
export function phasesInView(phases: TracePhase[], view: View): [number, number] | null {
  let first = -1;
  let last = -1;
  phases.forEach((p, i) => {
    if (p.offset + p.width > view.x0 && p.offset < view.x1) {
      if (first < 0) first = i;
      last = i;
    }
  });
  return first < 0 ? null : [first, last];
}

/** Последнее значение линии (подпись на конце). */
export function lastValue(segs: number[][]): number | null {
  for (let k = segs.length - 1; k >= 0; k--) if (segs[k].length >= 2) return segs[k].at(-1) ?? null;
  return null;
}

export interface PhaseHit {
  index: number;
  phase: TracePhase;
  /** В окне замера (`true`) или в промежутке после него. */
  inWindow: boolean;
  /** Мс от начала окна (в окне) или от его конца (в промежутке). */
  since: number;
}

export function phaseAt(phases: TracePhase[], x: number): PhaseHit | null {
  for (let i = phases.length - 1; i >= 0; i--) {
    const p = phases[i];
    if (x < p.offset) continue;
    const inWindow = x < p.offset + p.width;
    return {
      index: i,
      phase: p,
      inWindow,
      since: inWindow ? x - p.offset : x - p.offset - p.width,
    };
  }
  return null;
}

/**
 * Подписи на концах линий: каждая у своего значения, но не ближе `gap` пикселей к соседней —
 * сначала раздвигаются вниз, затем всё, что вылезло за низ, поднимается.
 */
export function spreadLabels<T extends { y: number }>(
  items: T[],
  gap: number,
  height: number
): T[] {
  const out = [...items].sort((a, b) => a.y - b.y).map((it) => ({ ...it }));
  for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap);
  const over = out.length ? out[out.length - 1].y - height : 0;
  if (over > 0) {
    out[out.length - 1].y -= over;
    for (let i = out.length - 2; i >= 0; i--) out[i].y = Math.min(out[i].y, out[i + 1].y - gap);
  }
  return out;
}
