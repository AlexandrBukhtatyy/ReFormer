/** Простая описательная статистика для свёртки прогона. */

export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const median = (values: number[]) => quantile(values, 0.5);

export const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

export const round = (v: number | null, digits = 2) =>
  v === null ? null : Math.round(v * 10 ** digits) / 10 ** digits;

export function summarize(values: number[]) {
  return {
    n: values.length,
    median: round(median(values)),
    p95: round(quantile(values, 0.95)),
    max: round(values.length ? Math.max(...values) : null),
  };
}

/** Наклон линейной регрессии y(x) — для утечек: прирост на одно перемонтирование. */
export function slope(points: Array<[number, number]>): number | null {
  if (points.length < 2) return null;
  const n = points.length;
  const mx = sum(points.map((p) => p[0])) / n;
  const my = sum(points.map((p) => p[1])) / n;
  const num = sum(points.map(([x, y]) => (x - mx) * (y - my)));
  const den = sum(points.map(([x]) => (x - mx) ** 2));
  return den === 0 ? null : num / den;
}
