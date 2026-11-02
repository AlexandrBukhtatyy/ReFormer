/**
 * Записи прогонов из существующих стендов: `mcp:evaluate` и `mcp:calibrate`. Стенды продолжают
 * выдавать свои отчёты и гейты как раньше — запись идёт рядом.
 */

import { collectSource, createRecord, fingerprintServer, newBatchId } from './record.mjs';

const noAgent = { kind: 'none', model: null, auth: null, settings: {} };

/** Запись прогона `mcp:evaluate`: проверка на задачу корпуса, метрики — сводка отчёта. */
export async function retrievalRecord(report, { startedAt, serverPath }) {
  const checks = {};
  for (const result of report.results) {
    checks[`task.${result.id}`] = result.firstPass
      ? 'pass'
      : result.hit
        ? ['partial', `${result.calls} вызовов`]
        : ['fail', 'не найдено'];
  }
  return createRecord({
    batchId: newBatchId(startedAt),
    harness: 'retrieval',
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    source: collectSource(),
    server: await fingerprintServer(serverPath),
    agent: noAgent,
    approach: { id: report.strategy },
    scenario: { id: 'retrieval-corpus' },
    verdict: report.misses.length === 0 ? 'pass' : 'fail',
    gates: ['hitRate'],
    checks,
    metrics: [
      { id: 'static.tokens', value: report.static.total, better: 'lower' },
      { id: 'hitRate', value: report.hitRate, better: 'higher' },
      { id: 'firstPassRate', value: report.firstPassRate, better: 'higher' },
      { id: 'tokens.median', value: report.tokensPerTask.median, better: 'lower' },
      { id: 'tokens.p95', value: report.tokensPerTask.p95, better: 'lower' },
      { id: 'tokens.total', value: report.tokensPerTask.total, better: 'lower' },
      { id: 'calls.median', value: report.callsPerTask.median, better: 'lower' },
    ],
  });
}

const fraction = (text) => {
  const match = /^(\d+)\/(\d+)$/.exec(String(text));
  return match ? { hit: Number(match[1]), total: Number(match[2]) } : null;
};

/** Показатели T1, по которым следят за калибровкой; остальное остаётся в её `metrics.json`. */
const T1_FRACTIONS = [
  'fields',
  'arrays',
  'itemFields',
  'validation',
  'conditional',
  'behavior',
  'visibility',
];

/** Метрики `buildMetrics` калибровки → метрики записи: дроби и счётчики ошибок. */
export function calibrationMetrics(metrics) {
  const list = [];
  const addFraction = (id, text) => {
    const parsed = fraction(text);
    if (parsed && parsed.total > 0) list.push({ id, ...parsed, better: 'higher' });
  };
  for (const [id, entry] of Object.entries(metrics.t1 ?? {})) {
    for (const key of T1_FRACTIONS) addFraction(`t1.${id}.${key}`, entry[key]);
  }
  if (metrics.t2) {
    const sum = (field) => metrics.t2.reduce((total, run) => total + (run[field] ?? 0), 0);
    for (const field of ['crossCheckErrors', 'tscErrors', 'layoutErrors', 'codeErrors']) {
      list.push({ id: `t2.${field}`, value: sum(field), better: 'lower' });
    }
  }
  for (const [project, text] of Object.entries(metrics.t3 ?? {}))
    addFraction(`t3.${project}`, text);
  if (metrics.t4) {
    for (const [channel, value] of Object.entries(metrics.t4.chooseApi ?? {})) {
      addFraction(`t4.chooseApi.${channel}`, value.hit);
    }
    addFraction('t4.askReformer', metrics.t4.askReformer);
    addFraction('t4.symbolDocs', metrics.t4.symbolDocs);
  }
  for (const [channel, groups] of Object.entries(metrics.t5?.code ?? {})) {
    const withErrors = Object.values(groups).reduce((total, group) => total + group.withErrors, 0);
    list.push({ id: `t5.falseErrors.${channel}`, value: withErrors, better: 'lower' });
  }
  return list;
}

/** Запись прогона `mcp:calibrate`: проверки smoke и T2 по одной, метрики — сводка треков. */
export async function calibrationRecord(results, metrics, { startedAt, serverPath, channels }) {
  const checks = {};
  for (const check of results.smoke ?? []) {
    const id = `smoke.${check.id}.${check.channel}`;
    checks[id] =
      check.status === 'pass' || check.status === 'info'
        ? check.status
        : [check.status, String(check.detail ?? '').slice(0, 200)];
  }
  for (const run of metrics.t2 ?? []) {
    const clean = run.status === 'ok' && !run.tscErrors && !run.layoutErrors && !run.codeErrors;
    checks[`t2.${run.run}`] = clean
      ? 'pass'
      : [
          'fail',
          `${run.status}, tsc ${run.tscErrors}, layout ${run.layoutErrors}, code ${run.codeErrors}`,
        ];
  }
  const smokeFailed = (results.smoke ?? []).some((check) => check.status === 'fail');
  return createRecord({
    batchId: newBatchId(startedAt),
    harness: 'calibration',
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    source: collectSource(),
    server: await fingerprintServer(serverPath, channels.join('+')),
    agent: noAgent,
    approach: { id: 'calibration' },
    scenario: { id: 'calibration-suite' },
    verdict: smokeFailed ? 'fail' : 'pass',
    gates: ['smoke'],
    checks,
    metrics: calibrationMetrics(metrics),
  });
}
