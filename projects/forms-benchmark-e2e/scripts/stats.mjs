/**
 * Статистика отчёта: описательная, bootstrap-CI отношения медиан, Mann–Whitney U, поправка Holm.
 * Единица наблюдения — прогон (свёртка внутри прогона делается до этого), не отдельная клавиша.
 */

export function quantile(values, q) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const median = (v) => quantile(v, 0.5);
export const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

export function sd(v) {
  if (v.length < 2) return null;
  const m = mean(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

export function describe(values) {
  const v = values.filter((x) => Number.isFinite(x));
  const m = mean(v);
  return {
    n: v.length,
    median: median(v),
    q25: quantile(v, 0.25),
    q75: quantile(v, 0.75),
    p95: v.length >= 20 ? quantile(v, 0.95) : null,
    min: v.length ? Math.min(...v) : null,
    max: v.length ? Math.max(...v) : null,
    cv: v.length > 1 && m ? sd(v) / Math.abs(m) : null,
  };
}

/** Детерминированный ГПСЧ для bootstrap — отчёт воспроизводим. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 95% bootstrap-CI отношения медиан a/b (перцентильный метод, 2000 повторов). */
export function ratioCI(a, b, reps = 2000, seed = 42) {
  if (a.length < 2 || b.length < 2) return null;
  const r = rng(seed);
  const sample = (v) => Array.from({ length: v.length }, () => v[Math.floor(r() * v.length)]);
  const ratios = [];
  for (let i = 0; i < reps; i++) {
    const mb = median(sample(b));
    if (mb) ratios.push(median(sample(a)) / mb);
  }
  return [quantile(ratios, 0.025), quantile(ratios, 0.975)];
}

function normalCdf(z) {
  // Abramowitz–Stegun 7.1.26
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Выборки до этого суммарного размера считаются точным перестановочным распределением. */
const EXACT_MAX_N = 60;

/**
 * Точное двустороннее p Mann–Whitney: распределение суммы рангов первой выборки по всем
 * C(n, n1) разбиениям при наблюдённых рангах (средние ранги связей удвоены до целых) —
 * условный перестановочный тест, верный и при связях. p = доля разбиений, у которых сумма
 * отстоит от ожидаемой не меньше наблюдённой.
 */
function exactRankSumP(doubledRanks, inFirst, n1) {
  const maxSum = doubledRanks.reduce((s, r) => s + r, 0);
  let ways = Array.from({ length: n1 + 1 }, () => new Float64Array(maxSum + 1));
  ways[0][0] = 1;
  for (const r of doubledRanks) {
    for (let k = n1; k >= 1; k--) {
      const row = ways[k];
      const prev = ways[k - 1];
      for (let s = maxSum; s >= r; s--) if (prev[s - r]) row[s] += prev[s - r];
    }
  }
  const dist = ways[n1];
  ways = null;
  const expected = (n1 * maxSum) / doubledRanks.length;
  const observed = doubledRanks.reduce((s, r, i) => s + (inFirst[i] ? r : 0), 0);
  const distance = Math.abs(observed - expected) - 1e-9;
  let total = 0;
  let tail = 0;
  for (let s = 0; s <= maxSum; s++) {
    if (!dist[s]) continue;
    total += dist[s];
    if (Math.abs(s - expected) >= distance) tail += dist[s];
  }
  return Math.min(1, tail / total);
}

/**
 * Двусторонний Mann–Whitney U. До {@link EXACT_MAX_N} наблюдений — точное перестановочное
 * распределение: нормальное приближение при n = 10 на группу не опускается ниже p ≈ 1.8e-4, и после
 * поправки Holm на сотни сравнений отчёта значимость становится недостижимой. Больше — нормальное
 * приближение с поправкой на связи и непрерывность.
 */
export function mannWhitney(a, b) {
  const n1 = a.length;
  const n2 = b.length;
  if (n1 < 3 || n2 < 3) return null;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort(
    (x, y) => x.v - y.v
  );
  const ranks = new Array(all.length);
  let tieSum = 0;
  for (let i = 0; i < all.length; ) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].v === all[i].v) j++;
    const rank = (i + j + 2) / 2;
    for (let k = i; k <= j; k++) ranks[k] = rank;
    const t = j - i + 1;
    tieSum += t ** 3 - t;
    i = j + 1;
  }
  const n = n1 + n2;
  if (n <= EXACT_MAX_N) {
    return exactRankSumP(
      ranks.map((r) => Math.round(r * 2)),
      all.map((x) => x.g === 0),
      n1
    );
  }
  const r1 = all.reduce((acc, x, i) => acc + (x.g === 0 ? ranks[i] : 0), 0);
  const u1 = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (n + 1 - tieSum / (n * (n - 1))));
  if (sigma === 0) return 1;
  const z = (Math.abs(u1 - mu) - 0.5) / sigma;
  return Math.min(1, 2 * (1 - normalCdf(z)));
}

/** Поправка Holm–Bonferroni: p-значения → скорректированные (в исходном порядке). */
export function holm(pvalues) {
  const idx = pvalues
    .map((p, i) => [p, i])
    .filter(([p]) => p !== null)
    .sort((x, y) => x[0] - y[0]);
  const m = idx.length;
  const out = pvalues.map(() => null);
  let running = 0;
  idx.forEach(([p, i], k) => {
    running = Math.max(running, Math.min(1, (m - k) * p));
    out[i] = running;
  });
  return out;
}
