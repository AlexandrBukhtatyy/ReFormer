/**
 * Фоновая нагрузка в отчёте (BENCH-CONTRACT §7): записи прогонов из runs.ndjson (`background`, их
 * пишет lib/background.ts) → по форме (сессии): чужая нагрузка в ядрах, GPU, тяжёлые соседи с долей
 * прогонов и медианой CPU, «грязные» прогоны и сноска. Пороги классификатора — в lib/background.ts
 * (копия в env.json → `background.thresholds`).
 */
import { median } from './stats.mjs';

/**
 * Сессия помечается, если «грязных» прогонов больше этой доли — то же правило, что у дрейфа внутри
 * прогона (scripts/calibration.mjs): короткий всплеск соседа медиану по итерациям не сдвигает,
 * а сосед, работающий заметную часть сессии, задевает многие прогоны и всех участников.
 */
export const DIRTY_SHARE = 0.1;

const finite = (v) => v.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
const max = (v) => (v.length ? Math.max(...v) : null);

/**
 * Фоновая нагрузка сессии формы: прогоны `timing` без прогрева. null — замеров нет (прогоны до
 * появления выборки или платформа без ps).
 */
export function analyzeBackground(runLog, env) {
  const pre = env.background?.preflight ?? null;
  const preflight = pre
    ? {
        dirty: pre.dirty,
        reasons: pre.reasons,
        foreignCores: pre.foreignCores,
        gpuPct: pre.gpuPct,
      }
    : null;
  const samples = runLog
    .filter((r) => r.mode === 'timing' && !r.warmup && r.background)
    .map((r) => r.background);
  if (!samples.length) return preflight ? { n: 0, preflight, flags: [] } : null;

  const byLabel = new Map();
  for (const s of samples) {
    for (const n of s.neighbours) {
      const e = byLabel.get(n.label) ?? {
        kind: n.kind,
        label: n.label,
        present: 0,
        busy: 0,
        values: [],
      };
      e.present += 1;
      if (n.busy) e.busy += 1;
      e.values.push(n.kind === 'gpu' ? n.gpuPct : n.cpuPct);
      byLabel.set(n.label, e);
    }
  }
  const neighbours = [...byLabel.values()]
    .map((e) => ({
      kind: e.kind,
      label: e.label,
      present: e.present,
      busy: e.busy,
      share: e.busy / samples.length,
      medianPct: median(finite(e.values)),
    }))
    .sort((a, b) => b.busy - a.busy || b.present - a.present);

  const cores = samples.map((s) => s.foreignCores);
  const gpu = finite(samples.map((s) => s.gpuPct));
  const dirtyRuns = samples.filter((s) => s.dirty).length;
  const out = {
    n: samples.length,
    foreignCores: { median: median(cores), max: max(cores) },
    ownCores: median(finite(samples.map((s) => s.ownCores))),
    gpu: gpu.length ? { median: median(gpu), max: max(gpu) } : null,
    dirtyRuns,
    dirtyShare: dirtyRuns / samples.length,
    neighbours,
    preflight,
  };
  out.flags = out.dirtyShare > DIRTY_SHARE ? ['dirty'] : [];
  return out;
}

const pct0 = (v) => `${Math.round(v * 100)} %`;
const num = (v, d = 2) => (v === null || v === undefined ? '—' : Number(v).toFixed(d));

/** Сосед одной строкой: «Ollama runner (qwen3.5:4b) — занят в 3 из 3 прогонов, медиана 27 % ядра». */
export function neighbourText(n, total) {
  const unit = n.kind === 'gpu' ? '% загрузки GPU' : '% ядра';
  const alive = n.present > n.busy ? `, ещё в ${n.present - n.busy} — запущен, но простаивает` : '';
  return `${n.label} — занят в ${n.busy} из ${total} прогонов${alive}, медиана ${num(n.medianPct, 0)} ${unit}`;
}

/** Причины пометки сессии — для сноски и предупреждения в начале формы. */
export function describeBackgroundFlags(bg) {
  const busy = bg.neighbours.filter((n) => n.busy > 0).map((n) => n.label);
  return (
    `«грязных» прогонов ${bg.dirtyRuns} из ${bg.n} (${pct0(bg.dirtyShare)}, порог ${pct0(DIRTY_SHARE)})` +
    `, чужая нагрузка — медиана ${num(bg.foreignCores.median)} ядра` +
    (busy.length ? `; соседи: ${busy.join(', ')}` : '')
  );
}

/** Сводка одной строкой — для bench:compare. */
export function backgroundLine(bg) {
  if (!bg || !bg.n) return 'нет замеров (прогоны до появления выборки фоновой нагрузки)';
  const busy = bg.neighbours.filter((n) => n.busy > 0).map((n) => `${n.label} ${n.busy}/${bg.n}`);
  return (
    `чужая нагрузка ${num(bg.foreignCores.median)} ядра (max ${num(bg.foreignCores.max)})` +
    (bg.gpu ? `, GPU ${num(bg.gpu.median, 0)} %` : '') +
    `, «грязных» прогонов ${bg.dirtyRuns}/${bg.n}` +
    (busy.length ? `; соседи: ${busy.join(', ')}` : '') +
    (bg.flags.length ? ' ⚠️' : '')
  );
}
