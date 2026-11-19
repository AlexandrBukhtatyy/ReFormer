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
