/**
 * Свёртка прогонов бенча: results/<run>/{env.json, phases.ndjson, runs.ndjson} → формы с
 * секциями (фаза × метрика × участник: описательная статистика по прогонам), рендерами,
 * калибровкой скорости машины и фоновой нагрузкой. Общая для отчёта (report.mjs) и сравнения прогонов (compare.mjs).
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, mannWhitney, ratioCI } from './stats.mjs';
import { METRICS, PHASES } from './metrics.mjs';
import { analyzeCalibration } from './calibration.mjs';
import { analyzeBackground } from './background.mjs';
import { e2eDir, suite } from './suite.mjs';

export { e2eDir };
/** Прогоны набора: `results/` у `libraries`, `results/<набор>/` у остальных (suite.mjs). */
export const resultsDir = path.join(e2eDir, 'results', suite.resultsSubdir ?? '');

/** Порядок участников, опора сравнения и A/A-контроль — из набора (suites/<id>.json). */
export const LIB_ORDER = suite.order;
export const COMPARE_TO = suite.reference;
export const CONTROL = suite.control;
/** Участники прогона вместе с A/A-контролем, если он у набора есть. */
const withControl = (libs) => (CONTROL ? [...libs, CONTROL] : libs);

export const readNdjson = (file) =>
  existsSync(file)
    ? readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];

/** Каталог прогона: в нём есть phases.ndjson. */
export const isRunDir = (dir) => existsSync(path.join(dir, 'phases.ndjson'));

/** Последний прогон каждой формы в results/. */
export function latestRuns() {
  const dirs = existsSync(resultsDir)
    ? readdirSync(resultsDir).filter(
        (d) => /_[a-z]+_[0-9a-z]+$/.test(d) && isRunDir(path.join(resultsDir, d))
      )
    : [];
  const latest = {};
  for (const d of dirs.sort()) latest[d.split('_')[1]] = d;
  return Object.values(latest).map((d) => path.join(resultsDir, d));
}

/** Список прогонов через запятую: имя каталога в results/ или путь. */
export const resolveRuns = (spec) =>
  spec
    .split(',')
    .filter(Boolean)
    .map((d) => path.resolve(resultsDir, d));

/**
 * Свёртка прогонов. `comparisons` — сравнения с ReFormer core для поправки Holm (её делает
 * вызывающий: она идёт по всем сравнениям отчёта).
 */
export function aggregate(runDirs) {
  const forms = [];
  const comparisons = []; // для Holm: { ref, p }

  for (const dir of runDirs) {
    const env = JSON.parse(readFileSync(path.join(dir, 'env.json'), 'utf8'));
    const phases = readNdjson(path.join(dir, 'phases.ndjson'));
    const runLog = readNdjson(path.join(dir, 'runs.ndjson'));
    const form = env.form;
    const libsPresent = [...new Set(phases.map((p) => p.lib))];
    const libs = LIB_ORDER.filter((l) => libsPresent.includes(l));
    const cpus = [...new Set(phases.filter((p) => p.mode === 'timing').map((p) => p.cpu))].sort();

    const failures = runLog.filter((r) => !r.ok);
    const calibration = analyzeCalibration(runLog, withControl(libs));
    const background = analyzeBackground(runLog, env);
    const formOut = {
      form,
      runId: env.runId,
      env,
      libs,
      cpus,
      failures,
      calibration,
      background,
      sections: [],
      renders: [],
    };

    for (const cpu of cpus) {
      for (const phase of PHASES[form] ?? []) {
        const metrics = METRICS[phase.kind].filter((m) => !m.only || m.only.includes(phase.id));
        const section = { cpu, phase: phase.id, title: phase.title, kind: phase.kind, rows: [] };
        for (const metric of metrics) {
          const values = {};
          for (const lib of withControl(libs)) {
            values[lib] = phases
              .filter(
                (p) => p.mode === 'timing' && p.cpu === cpu && p.phase === phase.id && p.lib === lib
              )
              .map((p) => {
                try {
                  return metric.get(p);
                } catch {
                  return null;
                }
              })
              .filter((v) => v !== null && v !== undefined && Number.isFinite(v));
          }
          const stats = Object.fromEntries(
            Object.entries(values).map(([lib, v]) => [lib, describe(v)])
          );
          const contenders = libs.filter((l) => l !== 'baseline' && stats[l].n > 0);
          // Прогон одного baseline (`BENCH_LIBS=baseline` — проверка калибровки и дрейфа машины):
          // строки строятся по нему, иначе сравнивать было бы нечего.
          const ranked = contenders.length ? contenders : libs.filter((l) => stats[l].n > 0);
          if (!ranked.length) continue;
          // Величина против нуля (удержание памяти): ни отношений, ни «лучшего» — см. metrics.mjs.
          const best = metric.absolute
            ? null
            : ranked.reduce((a, b) => (stats[b].median < stats[a].median ? b : a));
          const cells = {};
          for (const lib of libs) {
            const s = stats[lib];
            if (!s.n) continue;
            const ratio =
              best !== null && stats[best].median ? s.median / stats[best].median : null;
            cells[lib] = {
              ...s,
              ratio,
              ratioCI: best === null || lib === best ? null : ratioCI(values[lib], values[best]),
            };
          }
          // Шум A/A: насколько расходятся две одинаковые сборки ReFormer core.
          const noise =
            CONTROL &&
            COMPARE_TO &&
            stats[CONTROL]?.n &&
            stats[COMPARE_TO]?.n &&
            stats[COMPARE_TO].median
              ? Math.abs(Math.log(stats[CONTROL].median / stats[COMPARE_TO].median))
              : null;
          const row = {
            metric: metric.id,
            label: metric.label,
            unit: metric.unit,
            best,
            noise,
            cells,
          };
          if (COMPARE_TO && !metric.absolute && values[COMPARE_TO]?.length) {
            for (const lib of contenders.filter((l) => l !== COMPARE_TO)) {
              const p = mannWhitney(values[lib], values[COMPARE_TO]);
              const ref = { form, cpu, phase: phase.id, metric: metric.id, lib, p, adj: null };
              comparisons.push(ref);
              cells[lib].vsCore = ref;
            }
          }
          section.rows.push(row);
        }
        section.apiCalls = apiCallsIfDiffer(phases, cpu, phase.id, libs);
        if (section.rows.length) formOut.sections.push(section);
      }
    }

    // Рендеры: один проход на участника (CPU 1x).
    for (const phase of PHASES[form] ?? []) {
      const row = { phase: phase.id, title: phase.title, kind: phase.kind, cells: {} };
      for (const lib of libs) {
        const rec = phases.find(
          (p) => p.mode === 'renders' && p.phase === phase.id && p.lib === lib
        );
        if (!rec?.renders) continue;
        const keys = rec.keys?.proc?.length ?? 0;
        const executions = Object.values(rec.renders.primitiveExecutions ?? {}).reduce(
          (a, b) => a + b,
          0
        );
        row.cells[lib] = {
          commits: rec.renders.commits,
          components: rec.renders.components,
          primitives: rec.renders.primitives,
          executions,
          keys,
          perKey: keys ? rec.renders.components / keys : null,
          perMount:
            phase.kind === 'remount' && rec.count ? rec.renders.components / rec.count : null,
        };
      }
      if (Object.keys(row.cells).length) formOut.renders.push(row);
    }
    forms.push(formOut);
  }
  return { forms, comparisons };
}

/**
 * Запросы к fake API за фазу по участникам — только если они различаются: тогда часть работы
 * (и её время) у кого-то перенесена в другую фазу, и это видно под таблицей. У участника берётся
 * самый частый набор вызовов по его прогонам.
 */
function apiCallsIfDiffer(phases, cpu, phaseId, libs) {
  const byLib = {};
  for (const lib of libs.filter((l) => l !== 'baseline')) {
    const sigs = phases
      .filter(
        (p) =>
          p.mode === 'timing' && p.cpu === cpu && p.phase === phaseId && p.lib === lib && p.apiCalls
      )
      .map((p) =>
        JSON.stringify(
          Object.entries(p.apiCalls)
            .filter(([, n]) => n > 0)
            .sort()
        )
      );
    if (!sigs.length) continue;
    const counts = new Map();
    for (const s of sigs) counts.set(s, (counts.get(s) ?? 0) + 1);
    byLib[lib] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  if (new Set(Object.values(byLib)).size <= 1) return null;
  return Object.fromEntries(
    Object.entries(byLib).map(([lib, s]) => [lib, Object.fromEntries(JSON.parse(s))])
  );
}
