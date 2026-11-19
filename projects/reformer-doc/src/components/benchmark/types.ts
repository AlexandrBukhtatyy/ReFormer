/**
 * Формат данных бенчмарка форм для сайта: src/data/forms-benchmark.json (страница /benchmark) и
 * src/data/forms-benchmark-headline.json (лендинг). Оба файла пишет
 * projects/forms-benchmark-e2e/scripts/site-data.mjs из опубликованного отчёта
 * docs/benchmarks/forms/summary.json — руками их не правят.
 */

export type FormId = 'registration' | 'credit';
export type PhaseKind = 'load' | 'typing' | 'click' | 'async' | 'remount';
export type Role = 'subject' | 'competitor' | 'baseline';

/** Значимость против ReFormer core: 1 — значимо хуже (▲), −1 — значимо лучше (▼), 0 — не доказано. */
export type Significance = -1 | 0 | 1;

/** Ячейка: `[медиана, q25, q75, отношение к лучшему в строке, значимость]`. */
export type Cell = [
  median: number | null,
  q25: number | null,
  q75: number | null,
  ratio: number | null,
  sig: Significance,
];

export interface Row {
  /** id метрики (metrics.mjs); подпись — в `FormData.metrics['<kind>/<id>']`. */
  id: string;
  /** Лучший участник строки (без baseline); `null` — величина против нуля (удержание памяти). */
  best: string | null;
  /** Разброс по прогонам выше 15 % (CV) хотя бы у одного участника. */
  noisy: boolean;
  cells: Record<string, Cell>;
}

export interface Section {
  id: string;
  title: string;
  kind: PhaseKind;
  rows: Row[];
  /** Пояснения под таблицей фазы (NOTES в metrics.mjs), по-русски. */
  notes: string[];
  /** Запросы к fake API за фазу по участникам — только если они различаются. */
  apiCalls: Record<string, Record<string, number>> | null;
}

/** Рендеры за фазу: `[компоненты, commits, компонентов на клавишу, на монтирование]`. */
export type RenderCell = [
  components: number,
  commits: number,
  perKey: number | null,
  perMount: number | null,
];

export interface CalibrationSummary {
  n: number;
  median: number | null;
  spread: number | null;
  trend: number | null;
  runDriftMedian: number | null;
  runDriftMaxAbs: number | null;
  flags: string[];
}

export interface BackgroundSummary {
  n: number;
  foreignCores: { median: number | null; max: number | null } | null;
  gpu: { median: number | null; max: number | null } | null;
  ownCores: number | null;
  dirtyRuns: number;
  flags: string[];
  preflight: { dirty: boolean; foreignCores: number | null } | null;
  neighbours: Array<{ label: string; kind: string; busy: number; medianPct: number | null }>;
}

export interface BenchForm {
  id: FormId;
  title: string;
  runId: string;
  cpu: number;
  libs: string[];
  failures: number;
  headline: Array<{ phase: string; metric: string }>;
  metrics: Record<string, { label: string; unit: string }>;
  sections: Section[];
  renders: Array<{ phase: string; cells: Record<string, RenderCell> }>;
  calibration: CalibrationSummary | null;
  background: BackgroundSummary | null;
}

export interface BundleEntry {
  lib: string;
  form: FormId;
  raw: number;
  gzip: number;
  brotli: number;
  overBaselineGzip: number | null;
  top: Array<[name: string, kb: number]>;
}

export interface CodeEntry {
  lib: string;
  form: FormId;
  formTs: number;
  formJson: number;
  kitTs: number;
  total: number;
  files: number;
  gzip: number;
}

export interface Participant {
  id: string;
  label: string;
  role: Role;
  stack: string;
}

export interface BenchMeta {
  generatedAt: string;
  runs: string[];
  machine: { cpu: string; cores: number; memoryGb: number; platform: string };
  browser: string;
  headless: string;
  node: string;
  iterations: number;
  warmup: number;
  cpuRates: number[];
  cadenceMs: number;
  seed: number;
  git: { sha: string | null; dirty: boolean };
  versions: Record<string, string>;
}

export interface BenchData {
  schema: number;
  meta: BenchMeta;
  participants: Participant[];
  forms: BenchForm[];
  bundle: BundleEntry[];
  code: CodeEntry[];
  calibration: {
    cpu: number;
    median: number | null;
    spread: number | null;
    betweenForms: number | null;
    flags: string[];
  } | null;
}

/** Сводка для лендинга: строки «Итога» (с фазой и типом фазы) и бандл. */
export interface HeadlineData {
  schema: number;
  meta: { generatedAt: string; iterations: number; cpuRates: number[] };
  forms: Array<{
    id: FormId;
    cpu: number;
    rows: Array<Row & { phase: string; kind: PhaseKind; unit: string }>;
  }>;
  bundle: Array<Pick<BundleEntry, 'lib' | 'form' | 'gzip' | 'overBaselineGzip'>>;
}

/** Участник, с которым сравниваются все остальные (значки ▲/▼). */
export const CORE = 'reformer-core';
/** Конкуренты — без ReFormer JSON (это тоже ReFormer) и baseline. */
export const RIVALS = ['formik', 'rhf', 'rjsf'] as const;

export const LIB_LABELS: Record<string, string> = {
  'reformer-core': 'ReFormer core',
  'reformer-json': 'ReFormer JSON',
  formik: 'Formik',
  rhf: 'RHF',
  rjsf: 'RJSF',
  baseline: 'baseline',
};

export const libLabel = (lib: string): string => LIB_LABELS[lib] ?? lib;

export const roleOf = (lib: string): Role =>
  lib.startsWith('reformer') ? 'subject' : lib === 'baseline' ? 'baseline' : 'competitor';

export const median = (c: Cell | undefined): number | null => c?.[0] ?? null;

/**
 * Число как в отчёте (report.mjs → fmt): КБ — целые, счётчики — до десятых, время — три значащие
 * цифры. Одни и те же значения на сайте и в report.md.
 */
export function fmt(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'КБ') return v.toFixed(0);
  if (unit === 'шт' || unit === '') return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

export const fmtRatio = (r: number | null | undefined): string =>
  r === null || r === undefined || !Number.isFinite(r) ? '' : `×${r.toFixed(2)}`;

export const sigMark = (s: Significance): string => (s === 1 ? '▲' : s === -1 ? '▼' : '');

/** Процент со знаком: +3.1 %, −0.4 %. */
export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = Math.abs(v * 100).toFixed(digits);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s} %`;
}

export const pctAbs = (v: number | null | undefined, digits = 1): string =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)} %`;

/**
 * Счёт ReFormer core против конкурента по всем строкам формы: в скольких значимо быстрее (wins),
 * значимо медленнее (losses) и где разница не доказана (ties).
 */
export function scoreAgainst(forms: BenchForm[], rival: string) {
  const out = { wins: 0, losses: 0, ties: 0 };
  for (const f of forms)
    for (const s of f.sections)
      for (const r of s.rows) {
        const c = r.cells[rival];
        if (!c || !r.cells[CORE]) continue;
        if (c[4] === 1) out.wins += 1;
        else if (c[4] === -1) out.losses += 1;
        else out.ties += 1;
      }
  return out;
}

export interface Loss {
  form: BenchForm;
  section: Section;
  row: Row;
  core: number;
  /** Самый быстрый из конкурентов, значимо обогнавших ReFormer core. */
  winner: string;
  winnerValue: number;
  /** Все конкуренты, значимо быстрее ReFormer core в этой строке. */
  winners: string[];
  /** Во сколько раз ReFormer core медленнее лучшего из них. */
  factor: number;
}

/** Строки, где конкурент значимо быстрее ReFormer core (▼ в отчёте), — по убыванию отставания. */
export function lossesOf(form: BenchForm): Loss[] {
  const out: Loss[] = [];
  for (const section of form.sections)
    for (const row of section.rows) {
      const core = median(row.cells[CORE]);
      const winners = RIVALS.filter((l) => row.cells[l]?.[4] === -1);
      if (core === null || !winners.length) continue;
      const winner = winners.reduce((a, b) =>
        (median(row.cells[b]) ?? Infinity) < (median(row.cells[a]) ?? Infinity) ? b : a
      );
      const winnerValue = median(row.cells[winner]) as number;
      out.push({
        form,
        section,
        row,
        core,
        winner,
        winnerValue,
        winners: [...winners],
        // Обогнавший — лучший в строке: отставание = «×» ReFormer core из отчёта, ровно то же число.
        factor:
          winner === row.best && row.cells[CORE][3] !== null
            ? row.cells[CORE][3]
            : winnerValue > 0
              ? core / winnerValue
              : Infinity,
      });
    }
  return out.sort((a, b) => b.factor - a.factor);
}

/**
 * Графики трейсов: src/data/forms-benchmark-traces.json (site-data.mjs, прореженные ряды
 * traces.mjs). Один трассируемый проход на участника — часто из отдельного trace-прогона на той же
 * сборке страниц: `traceRun`, `sameBuild`.
 */
export type TraceMetric = 'heap' | 'nodes' | 'listeners';

/** Фаза на общей оси: окно замера `[offset, offset + width)`, следом промежуток `gap`, мс. */
export interface TracePhase {
  id: string;
  title: string;
  offset: number;
  width: number;
  gap: number;
}

export interface TraceForm {
  id: FormId;
  /** Прогон с числами таблиц для этой формы. */
  run: string | null;
  traceRun: string;
  /** Та же сборка страниц, что у замеров; `null` — сравнить не с чем. */
  sameBuild: boolean | null;
  builtAt: string | null;
  sha: string | null;
  cpu: number | null;
  /** Длина оси, мс. */
  total: number;
  phases: TracePhase[];
  /** Отрезки линии: `[x0, y0, dx1, y1, …]` — x внутри отрезка дельтой, мс; heap — МБ. */
  libs: Record<string, Record<TraceMetric, number[][]>>;
  /** Пик и значение в конце — по полной трассе. */
  stats: Record<string, Record<TraceMetric, [max: number | null, end: number | null]>>;
  missing: string[];
  unmarked: string[];
}

export interface TraceData {
  schema: number;
  /** Прогоны отчёта, для которого записаны трейсы: страница сверяет с `BenchData.meta.runs`. */
  measuredRuns: string[];
  forms: TraceForm[];
}
