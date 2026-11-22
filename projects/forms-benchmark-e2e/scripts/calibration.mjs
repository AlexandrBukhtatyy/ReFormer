/**
 * Калибровка скорости машины в отчёте (BENCH-CONTRACT §7): записи прогонов из runs.ndjson →
 * медиана калибровки по участникам и по порядку прогонов, дрейф внутри прогона (конец к началу)
 * и за сессию. Сами записи пишет lib/calibration.ts:
 * `calibration: { startMs, endMs, driftPct, start: [повторы], end: [повторы] }`.
 *
 * Метрики отчёта калибровкой НЕ нормируются: таблицы остаются в сырых миллисекундах. Нормировка —
 * только при сравнении отчётов разных сессий (scripts/compare.mjs).
 */
import { median, quantile } from './stats.mjs';

/**
 * Порог дрейфа скорости машины, выше которого отчёт ставит сноску: 10 %.
 *
 * - Собственный шум калибровки — 1–3 % (повторы внутри замера и соседние прогоны), порог не
 *   срабатывает от шума самого замера.
 * - Типичный разброс временных метрик между прогонами — медиана CV ≈ 5 %, шум A/A-пары — медиана
 *   ≈ 2 %, p90 ≈ 7 % (опубликованный отчёт 2026-11-13). Дрейф больше 10 % вдвое больше этого
 *   разброса: машина сменила режим (частота, тепловой режим, энергоэффективные ядра), и
 *   перемешанный порядок 10 итераций уже не гарантирует, что дрейф лёг на участников поровну.
 * - Тот же порог — критерий приёмки сравнения сессий (ReFormer-q6ny): после нормировки baseline
 *   двух сессий расходится не больше чем на 10 %.
 */
export const DRIFT_THRESHOLD = 0.1;

/**
 * Дрейф внутри прогона попадает в сноску, когда порог превышен больше чем в этой доле прогонов.
 * Одиночный скачок (фоновая задача ОС на секунду) медиану по 10 итерациям не сдвигает, а
 * калибровки начала и конца — два независимых замера, их шум складывается; систематический дрейф
 * внутри прогонов (машина греется за каждый прогон) задевает многие прогоны сразу.
 */
export const RUN_DRIFT_SHARE = 0.1;

/** Калибровка прогона одним числом — среднее начала и конца (что есть); как в lib/calibration.ts. */
export function runValue(c) {
  if (!c) return null;
  const v = [c.startMs, c.endMs].filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

/** Дрейф прогона: конец к началу − 1 (доля); положительный — к концу прогона машина медленнее. */
const runDrift = (c) =>
  Number.isFinite(c?.startMs) && Number.isFinite(c?.endMs) && c.startMs > 0
    ? c.endMs / c.startMs - 1
    : null;

const finite = (v) => v.filter((x) => x !== null && Number.isFinite(x));
const maxAbs = (v) => (v.length ? Math.max(...v.map(Math.abs)) : null);

/**
 * Калибровка одного прогона формы (сессии) по профилям CPU: только режим `timing`. Статистика —
 * по замеряемым прогонам (без прогрева, как и метрики отчёта); таблица порядка прогонов показывает
 * и прогрев. `libs` — порядок участников для таблиц. null — в прогонах калибровки нет.
 */
export function analyzeCalibration(runLog, libs) {
  const recs = runLog.filter((r) => r.mode === 'timing' && runValue(r.calibration) !== null);
  if (!recs.length) return null;
  const byCpu = {};
  for (const cpu of [...new Set(recs.map((r) => r.cpu))].sort((a, b) => a - b)) {
    const all = recs.filter((r) => r.cpu === cpu);
    const measured = all.filter((r) => !r.warmup);
    const values = measured.map((r) => runValue(r.calibration));
    const med = median(values);
    const drifts = finite(measured.map((r) => runDrift(r.calibration)));
    const p10 = quantile(values, 0.1);
    const p90 = quantile(values, 0.9);

    const present = libs.filter((l) => all.some((r) => r.lib === l));
    const libStats = {};
    for (const lib of present) {
      const mine = measured.filter((r) => r.lib === lib);
      if (!mine.length) continue;
      const v = mine.map((r) => runValue(r.calibration));
      const d = finite(mine.map((r) => runDrift(r.calibration)));
      libStats[lib] = {
        n: mine.length,
        median: median(v),
        vsSession: med ? median(v) / med - 1 : null,
        start: median(finite(mine.map((r) => r.calibration.startMs))),
        end: median(finite(mine.map((r) => r.calibration.endMs))),
        drift: d.length ? median(d) : null,
        driftMaxAbs: maxAbs(d),
      };
    }

    const iterations = [...new Set(all.map((r) => r.iteration))]
      .sort((a, b) => a - b)
      .map((iteration) => {
        const rows = all.filter((r) => r.iteration === iteration);
        const cells = {};
        for (const r of rows) {
          cells[r.lib] = { value: runValue(r.calibration), drift: runDrift(r.calibration) };
        }
        return {
          iteration,
          warmup: rows.some((r) => r.warmup),
          median: median(rows.map((r) => runValue(r.calibration))),
          cells,
        };
      });
    const measuredIterations = iterations.filter((it) => !it.warmup);
    const trend =
      measuredIterations.length >= 2 && measuredIterations[0].median
        ? measuredIterations.at(-1).median / measuredIterations[0].median - 1
        : null;

    const stats = {
      n: values.length,
      median: med,
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      p10,
      p90,
      /** Разброс за сессию: (p10–p90) / медиана — устойчив к одиночному выбросу. */
      spread: med ? (p90 - p10) / med : null,
      /** Медиана последней итерации к медиане первой − 1: направленный дрейф за сессию. */
      trend,
      runDrift: {
        n: drifts.length,
        median: drifts.length ? median(drifts) : null,
        maxAbs: maxAbs(drifts),
        over: drifts.filter((d) => Math.abs(d) > DRIFT_THRESHOLD).length,
      },
      libs: libStats,
      iterations,
    };
    stats.flags = flagsOf(stats);
    byCpu[cpu] = stats;
  }
  return { threshold: DRIFT_THRESHOLD, byCpu };
}

function flagsOf(s) {
  const flags = [];
  if (s.spread !== null && s.spread > DRIFT_THRESHOLD) flags.push('spread');
  if (s.trend !== null && Math.abs(s.trend) > DRIFT_THRESHOLD) flags.push('trend');
  if (s.runDrift.n && s.runDrift.over / s.runDrift.n > RUN_DRIFT_SHARE) flags.push('run');
  return flags;
}

/**
 * Калибровка всего отчёта по профилям CPU: прогоны всех форм вместе. Формы обычно мерятся в разных
 * сессиях — если их медианы расходятся больше порога, абсолютные числа форм несравнимы между собой.
 */
export function reportCalibration(forms) {
  const cpus = new Set();
  for (const f of forms) for (const cpu of Object.keys(f.calibration?.byCpu ?? {})) cpus.add(cpu);
  if (!cpus.size) return null;
  const byCpu = {};
  for (const cpu of [...cpus].sort((a, b) => a - b)) {
    const values = [];
    const formMedians = {};
    for (const f of forms) {
      const c = f.calibration?.byCpu?.[cpu];
      if (!c) continue;
      formMedians[f.form] = c.median;
      for (const it of c.iterations.filter((x) => !x.warmup))
        for (const cell of Object.values(it.cells))
          if (cell.value !== null) values.push(cell.value);
    }
    const med = median(values);
    const meds = Object.values(formMedians).filter((v) => v);
    const betweenForms = meds.length >= 2 ? Math.max(...meds) / Math.min(...meds) - 1 : null;
    const p10 = quantile(values, 0.1);
    const p90 = quantile(values, 0.9);
    const spread = med ? (p90 - p10) / med : null;
    // Одна форма — весь отчёт совпадает с её сессией, флаги уже стоят у формы.
    const flags = [];
    if (meds.length >= 2 && spread !== null && spread > DRIFT_THRESHOLD) flags.push('spread');
    if (betweenForms !== null && betweenForms > DRIFT_THRESHOLD) flags.push('forms');
    byCpu[cpu] = {
      n: values.length,
      median: med,
      p10,
      p90,
      spread,
      formMedians,
      betweenForms,
      flags,
    };
  }
  return { threshold: DRIFT_THRESHOLD, byCpu };
}

/** Знаковый процент: +3.1 %, −0.4 %. */
export function pct(v, digits = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  const s = (v * 100).toFixed(digits);
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${s.replace('-', '')} %`;
}

/** Процент без знака (разброс). */
export const pctAbs = (v, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)} %`;

/** Человеческое описание сработавших флагов дрейфа — для сноски. */
export function describeFlags(c) {
  const t = pctAbs(DRIFT_THRESHOLD, 0);
  const out = [];
  if (c.flags.includes('spread'))
    out.push(`разброс калибровки за сессию (p10–p90) ${pctAbs(c.spread)} > ${t}`);
  if (c.flags.includes('trend'))
    out.push(`от первой итерации к последней ${pct(c.trend)} (порог ±${t})`);
  if (c.flags.includes('run'))
    out.push(
      `в ${c.runDrift.over} из ${c.runDrift.n} прогонов (больше ${pctAbs(RUN_DRIFT_SHARE, 0)} ` +
        `прогонов) скорость от начала к концу прогона изменилась больше чем на ${t} ` +
        `(max ${pctAbs(c.runDrift.maxAbs)})`
    );
  if (c.flags.includes('forms'))
    out.push(`медианы калибровки форм расходятся на ${pctAbs(c.betweenForms)} > ${t}`);
  return out;
}
