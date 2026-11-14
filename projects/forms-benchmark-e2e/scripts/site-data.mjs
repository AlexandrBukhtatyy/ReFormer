#!/usr/bin/env node
/**
 * Данные бенчмарка для сайта документации: summary.json отчёта → компактные JSON в
 * projects/reformer-doc/src/data/. Страница /benchmark берёт полный файл, лендинг — сводный: в нём
 * только строки «Итога» и бандл, чтобы главная страница не тянула все фазы.
 *
 * Сайт показывает то же, что отчёт: медиану, IQR, отношение к лучшему и значок значимости против
 * ReFormer core (его ставит report.mjs). Сырые прогоны, p-значения и CI сюда не попадают.
 * Таблицы — по одному профилю CPU: самому сильному троттлингу из прогона (в отчёте их может быть
 * несколько).
 *
 * Запуск: `npm run bench:site-data` (из корня) или `node scripts/site-data.mjs
 * [--summary <summary.json>] [--out <каталог>]`. По умолчанию — опубликованный отчёт
 * docs/benchmarks/forms/summary.json. report.mjs вызывает writeSiteData при `--publish`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HEADLINE, NOTES } from './metrics.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
export const DEFAULT_SUMMARY = path.join(repoRoot, 'docs/benchmarks/forms/summary.json');
export const DEFAULT_OUT = path.join(repoRoot, 'projects/reformer-doc/src/data');
const ENTRIES = path.join(repoRoot, 'projects/forms-benchmark/entries.json');

/** Версия формата файлов: страница сверяет её и не рисует данные чужого формата. */
export const SITE_DATA_SCHEMA = 1;

const LIB_ORDER = ['reformer-core', 'reformer-json', 'formik', 'rhf', 'rjsf', 'baseline'];
const CONTROL = 'reformer-core-aa';
/** Короткие подписи — как в таблицах отчёта (report.mjs). */
const LABELS = {
  'reformer-core': 'ReFormer core',
  'reformer-json': 'ReFormer JSON',
  formik: 'Formik',
  rhf: 'RHF',
  rjsf: 'RJSF',
  baseline: 'baseline',
};
const FORM_TITLES = { registration: 'регистрация с капчей', credit: 'кредитная заявка' };
const VERSION_KEYS = [
  '@reformer/core',
  '@reformer/renderer-json',
  'formik',
  'yup',
  'react-hook-form',
  '@hookform/resolvers',
  'zod',
  '@rjsf/core',
  '@rjsf/validator-ajv8',
  'react',
];

/** Форматирование чисел отчёта (report.mjs → fmt): сайт показывает их так же. */
function fmt(v, unit) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (unit === 'КБ') return v.toFixed(0);
  if (unit === 'шт' || unit === '') return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1);
  return Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2);
}

/**
 * Число покороче, но с тем же видом на экране: наименьшая точность (от 4 значащих цифр), при
 * которой `format` даёт ту же строку, что и для исходного значения. Простое округление до 4 цифр
 * давало двойное округление: медиана 4.9250001 превращалась в 4.925 и показывалась как 4.92, а в
 * report.md — 4.93.
 */
function stable(v, format) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (v === 0) return 0;
  const want = format(v);
  for (let p = 4; p <= 17; p += 1) {
    const r = Number(v.toPrecision(p));
    if (format(r) === want) return r;
  }
  return v;
}
const sig = (v, unit) => stable(v, (x) => fmt(x, unit));
const fixed = (v, d) => stable(v, (x) => x.toFixed(d));
/** Процент как в отчёте (pctAbs/pct — до десятых процента). */
const share = (v) => stable(v, (x) => (x * 100).toFixed(1));

/** Значок отчёта → число: 1 — значимо хуже ReFormer core (▲), −1 — значимо лучше (▼), 0 — нет. */
const markerToSig = (m) => (m === '▲' ? 1 : m === '▼' ? -1 : 0);

function participants() {
  const manifest = existsSync(ENTRIES) ? JSON.parse(readFileSync(ENTRIES, 'utf8')) : null;
  return LIB_ORDER.map((id) => {
    const e = manifest?.entries.find((x) => x.id === id);
    return {
      id,
      label: LABELS[id],
      role:
        e?.role ??
        (id.startsWith('reformer') ? 'subject' : id === 'baseline' ? 'baseline' : 'competitor'),
      stack: e?.label ?? LABELS[id],
    };
  });
}

function meta(summary) {
  const env = summary.forms[0].env;
  const versions = env.build?.versions ?? {};
  return {
    generatedAt: summary.generatedAt,
    runs: summary.runs,
    machine: {
      cpu: env.machine.cpu,
      cores: env.machine.cores,
      memoryGb: env.machine.memoryGb,
      platform: env.machine.platform,
    },
    browser: env.runtime.browser,
    headless: env.runtime.headless,
    node: env.runtime.node,
    iterations: env.config.iterations,
    warmup: env.config.warmup,
    cpuRates: env.config.cpuRates,
    cadenceMs: env.config.cadenceMs,
    seed: env.config.seed,
    git: { sha: env.build?.git?.sha?.slice(0, 8) ?? null, dirty: !!env.build?.git?.dirty },
    versions: Object.fromEntries(
      VERSION_KEYS.filter((k) => versions[k]).map((k) => [k, versions[k]])
    ),
  };
}

/** Ячейка — кортеж `[медиана, q25, q75, отношение к лучшему, значимость]`: так файл вдвое меньше. */
const cellOf = (c, unit) => [
  sig(c.median, unit),
  sig(c.q25, unit),
  sig(c.q75, unit),
  fixed(c.ratio, 2),
  markerToSig(c.marker),
];

function rowOf(r, libs) {
  const cells = {};
  for (const lib of libs) if (r.cells[lib]) cells[lib] = cellOf(r.cells[lib], r.unit);
  return {
    id: r.metric,
    best: r.best,
    noisy: Object.values(r.cells).some((c) => c.cv !== null && c.cv > 0.15),
    cells,
  };
}

function calibrationOf(c, cpu) {
  const s = c?.byCpu?.[cpu];
  if (!s) return null;
  return {
    n: s.n,
    median: sig(s.median, 'мс'),
    spread: share(s.spread),
    trend: share(s.trend),
    runDriftMedian: share(s.runDrift?.median),
    runDriftMaxAbs: share(s.runDrift?.maxAbs),
    flags: s.flags ?? [],
  };
}

function backgroundOf(bg) {
  if (!bg) return null;
  return {
    n: bg.n,
    foreignCores: bg.foreignCores
      ? { median: fixed(bg.foreignCores.median, 2), max: fixed(bg.foreignCores.max, 2) }
      : null,
    gpu: bg.gpu ? { median: fixed(bg.gpu.median, 0), max: fixed(bg.gpu.max, 0) } : null,
    ownCores: fixed(bg.ownCores, 2),
    dirtyRuns: bg.dirtyRuns ?? 0,
    flags: bg.flags ?? [],
    preflight: bg.preflight
      ? { dirty: !!bg.preflight.dirty, foreignCores: fixed(bg.preflight.foreignCores, 2) }
      : null,
    neighbours: (bg.neighbours ?? [])
      .filter((n) => n.busy > 0)
      .slice(0, 5)
      .map((n) => ({
        label: n.label,
        kind: n.kind,
        busy: n.busy,
        medianPct: fixed(n.medianPct, 0),
      })),
  };
}

function formOf(f) {
  const cpu = Math.max(...f.cpus);
  const libs = f.libs.filter((l) => l !== CONTROL);
  // Подпись и единица метрики зависят только от типа фазы и id — один словарь вместо копии в
  // каждой строке.
  const metrics = {};
  for (const s of f.sections)
    for (const r of s.rows) metrics[`${s.kind}/${r.metric}`] = { label: r.label, unit: r.unit };
  const sections = f.sections
    .filter((s) => s.cpu === cpu)
    .map((s) => ({
      id: s.phase,
      title: s.title,
      kind: s.kind,
      rows: s.rows.map((r) => rowOf(r, libs)),
      notes: NOTES[f.form]?.[s.phase] ?? [],
      apiCalls: s.apiCalls ?? null,
    }));
  const headline = (HEADLINE[f.form] ?? []).filter((h) =>
    sections.some((s) => s.id === h.phase && s.rows.some((r) => r.id === h.metric))
  );
  return {
    id: f.form,
    title: FORM_TITLES[f.form] ?? f.form,
    runId: f.runId,
    cpu,
    libs,
    failures: f.failures?.length ?? 0,
    headline,
    metrics,
    sections,
    // Подпись фазы — из sections (те же фазы metrics.mjs).
    renders: (f.renders ?? []).map((r) => ({
      phase: r.phase,
      cells: Object.fromEntries(
        Object.entries(r.cells)
          .filter(([lib]) => libs.includes(lib))
          // `[компоненты, commits, на клавишу, на монтирование]`
          .map(([lib, c]) => [
            lib,
            [c.components, c.commits, fixed(c.perKey, 1), fixed(c.perMount, 0)],
          ])
      ),
    })),
    calibration: calibrationOf(f.calibration, cpu),
    background: backgroundOf(f.background),
  };
}

function bundleOf(bundle) {
  if (!bundle) return [];
  const order = (id) => (LIB_ORDER.includes(id) ? LIB_ORDER.indexOf(id) : 99);
  return bundle.entries
    .filter((e) => e.id !== CONTROL && LIB_ORDER.includes(e.id))
    .sort((a, b) => a.form.localeCompare(b.form) || order(a.id) - order(b.id))
    .map((e) => ({
      lib: e.id,
      form: e.form,
      raw: fixed(e.js.raw / 1024, 1),
      gzip: fixed(e.js.gzip / 1024, 1),
      brotli: fixed(e.js.brotli / 1024, 1),
      overBaselineGzip: e.overBaseline ? fixed(e.overBaseline.gzip / 1024, 1) : null,
      top: Object.entries(e.packages)
        .filter(([k]) => !k.startsWith('[') && !['react-dom', 'react', 'scheduler'].includes(k))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([k, v]) => [k, fixed(v / 1024, 1)]),
    }));
}

function codeOf(code) {
  if (!code) return [];
  const out = [];
  for (const lib of LIB_ORDER) {
    for (const [form, c] of Object.entries(code.report[lib] ?? {})) {
      out.push({
        lib,
        form,
        formTs: c.form.ts,
        formJson: c.form.json,
        kitTs: c.kit.ts,
        total: c.total.ts + c.total.json,
        files: c.total.files,
        gzip: c.total.gzip,
      });
    }
  }
  return out;
}

/** Полные данные страницы /benchmark. */
export function buildSiteData(summary) {
  const forms = summary.forms.map(formOf);
  const cpu = Math.max(...forms.map((f) => f.cpu));
  return {
    schema: SITE_DATA_SCHEMA,
    meta: meta(summary),
    participants: participants(),
    forms,
    bundle: bundleOf(summary.bundle),
    code: codeOf(summary.code),
    calibration: summary.calibration?.byCpu?.[cpu]
      ? {
          cpu,
          median: sig(summary.calibration.byCpu[cpu].median, 'мс'),
          spread: share(summary.calibration.byCpu[cpu].spread),
          betweenForms: share(summary.calibration.byCpu[cpu].betweenForms),
          flags: summary.calibration.byCpu[cpu].flags ?? [],
        }
      : null,
  };
}

/** Сводка для лендинга: строки «Итога» каждой формы и бандл — плитки считаются из них. */
export function buildHeadlineData(full) {
  return {
    schema: SITE_DATA_SCHEMA,
    meta: {
      generatedAt: full.meta.generatedAt,
      iterations: full.meta.iterations,
      cpuRates: full.meta.cpuRates,
    },
    forms: full.forms.map((f) => ({
      id: f.id,
      cpu: f.cpu,
      rows: f.headline.map((h) => {
        const section = f.sections.find((s) => s.id === h.phase);
        const row = section.rows.find((r) => r.id === h.metric);
        const { unit } = f.metrics[`${section.kind}/${row.id}`];
        return { phase: h.phase, kind: section.kind, unit, ...row };
      }),
    })),
    bundle: full.bundle.map(({ lib, form, gzip, overBaselineGzip }) => ({
      lib,
      form,
      gzip,
      overBaselineGzip,
    })),
  };
}

/**
 * JSON с отступами, но листья — массивы чисел и короткие объекты — в одну строку: файл читается и
 * даёт осмысленный diff, а весит почти как минифицированный. Prettier его не трогает
 * (.prettierignore), иначе каждая публикация оставляла бы файл изменённым.
 */
export function stringifyCompact(value, indent = '') {
  const inline = JSON.stringify(value);
  const leafArray =
    Array.isArray(value) && value.every((v) => v === null || typeof v !== 'object' || isPair(v));
  if (value === null || typeof value !== 'object' || leafArray || inline.length <= 100)
    return inline;
  const next = `${indent}  `;
  if (Array.isArray(value))
    return `[\n${value.map((v) => next + stringifyCompact(v, next)).join(',\n')}\n${indent}]`;
  const body = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${next}${JSON.stringify(k)}: ${stringifyCompact(v, next)}`);
  return `{\n${body.join(',\n')}\n${indent}}`;
}
/** `["пакет", 12.3]` — пара из списка крупнейших пакетов бандла. */
const isPair = (v) => Array.isArray(v) && v.every((x) => x === null || typeof x !== 'object');

/** Пишет оба файла; возвращает пути и размеры. */
export function writeSiteData(summary, outDir = DEFAULT_OUT) {
  const full = buildSiteData(summary);
  const headline = buildHeadlineData(full);
  mkdirSync(outDir, { recursive: true });
  const files = [
    [path.join(outDir, 'forms-benchmark.json'), full],
    [path.join(outDir, 'forms-benchmark-headline.json'), headline],
  ];
  return files.map(([file, data]) => {
    const text = `${stringifyCompact(data)}\n`;
    writeFileSync(file, text);
    return { file, bytes: Buffer.byteLength(text) };
  });
}

const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const args = process.argv.slice(2);
  const argValue = (name) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args[i + 1];
  };
  const summaryPath = path.resolve(argValue('--summary') ?? DEFAULT_SUMMARY);
  if (!existsSync(summaryPath)) {
    console.error(`нет ${summaryPath} — сначала npm run bench:report -- --publish`);
    process.exit(1);
  }
  const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
  for (const { file, bytes } of writeSiteData(
    summary,
    path.resolve(argValue('--out') ?? DEFAULT_OUT)
  ))
    console.log(
      `данные сайта → ${path.relative(process.cwd(), file)} (${(bytes / 1024).toFixed(1)} КБ)`
    );
}
