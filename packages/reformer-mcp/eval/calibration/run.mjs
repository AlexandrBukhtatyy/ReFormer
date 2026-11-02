#!/usr/bin/env node
/**
 * Калибровка @reformer/mcp по эталонным формам — через MCP Inspector CLI, по двум каналам.
 *
 * Отвечает на вопрос, которого не задаёт eval извлечения (`../runner.mjs`): можно ли с помощью
 * сервера собрать РАБОЧУЮ форму — простую с валидацией и поведением и сложную многошаговую — и
 * насколько ответы сервера пригодны агенту, который их читает. Метод и baseline —
 * `docs/mcp-eval/calibration.md`.
 *
 * Запуск (из корня репозитория):
 *   npm run mcp:calibrate                       — smoke + все треки, оба канала
 *   npm run mcp:calibrate -- --smoke            — только протокольный smoke (этап 0)
 *   npm run mcp:calibrate -- --channel node     — один канал: node | worker | both
 *   npm run mcp:calibrate -- --tracks T1,T5     — выбранные треки
 *   npm run mcp:calibrate -- --no-smoke         — без этапа 0
 *   npm run mcp:calibrate -- --e2e              — с T3: формы из эталонных intent под e2e эталонов
 *   npm run mcp:calibrate -- --out <dir>        — каталог прогона (по умолчанию .tmp/mcp-calibration/<время>)
 *   npm run mcp:calibrate -- --gate             — код 1 при ухудшении против calibration-baseline.json
 *   npm run mcp:calibrate -- --save-baseline    — записать метрики прогона как baseline
 *   npm run mcp:calibrate -- --publish          — положить запись прогона в packages/reformer-mcp/eval/runs/
 *
 * Перед запуском: собранный пакет (`npm --prefix packages/reformer-mcp run build`) и бандл
 * конструктора (`npm --prefix projects/reformer-builder-playground run mcp:build`).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  CHANNELS,
  ensureInspector,
  INSPECTOR_VERSION,
  repoRoot,
  tmpDir,
} from './lib/inspector.mjs';
import { calibrationRecord } from '../records/adapters.mjs';
import { writeRecords } from '../records/record.mjs';
import { compareCalibration } from './compare.mjs';
import { buildMetrics, renderReport } from './report.mjs';
import { runSmoke } from './smoke.mjs';
import { mountForms, runE2e, summarizeE2e } from './runtime.mjs';
import { createTextLog, trackT1, trackT2, trackT4, trackT5, trackT6 } from './tracks.mjs';

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
function flag(name, fallback = null) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}

const channelFlag = flag('channel', 'both');
const channels = channelFlag === 'both' ? ['node', 'worker'] : [channelFlag];
for (const ch of channels) {
  if (!CHANNELS[ch]) {
    console.error(`✗ неизвестный канал ${ch}: node | worker | both`);
    process.exit(1);
  }
}
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.resolve(flag('out', path.join(tmpDir, stamp)));
mkdirSync(outDir, { recursive: true });

const missing = [
  [CHANNELS.node.script, 'npm --prefix packages/reformer-mcp run build'],
  [
    path.join(repoRoot, 'projects/reformer-builder-playground/.ui_builder/mcp/reformer/server.js'),
    'npm --prefix projects/reformer-builder-playground run mcp:build',
  ],
].filter(([file]) => !existsSync(file));
if (missing.length) {
  for (const [file, cmd] of missing) {
    console.error(`✗ нет ${path.relative(repoRoot, file)} — соберите: ${cmd}`);
  }
  process.exit(1);
}

ensureInspector();
console.log(`Калибровка @reformer/mcp → ${path.relative(repoRoot, outDir)}`);
console.log(`Каналы: ${channels.map((c) => `${c} — ${CHANNELS[c].label}`).join('; ')}\n`);

const startedAt = new Date();
const meta = { startedAt: startedAt.toISOString(), channels, inspector: INSPECTOR_VERSION };
// T3 (браузерные e2e по собранным формам) идёт десятки минут — только по `--e2e` или `--tracks`.
const defaultTracks = has('smoke') ? '' : `T1,T2,${has('e2e') ? 'T3,' : ''}T4,T5,T6`;
const tracks = (flag('tracks', defaultTracks) ?? '').split(',').filter(Boolean);
const ctx = { outDir, channels, texts: createTextLog() };
const results = {};

if (!has('no-smoke')) {
  results.smoke = await runSmoke({ outDir, channels });
  printChecks('Этап 0 — протокольный smoke', results.smoke);
}

const step = async (id, title, fn) => {
  if (!tracks.includes(id)) return;
  const t0 = Date.now();
  process.stdout.write(`\n… ${id} ${title}`);
  results[id.toLowerCase()] = await fn();
  console.log(` — ${Math.round((Date.now() - t0) / 1000)} с`);
};
await step('T1', 'спека → intent', () => trackT1(ctx));
await step('T2', 'intent → бандл', () => trackT2(ctx, results.t1));
await step('T3', 'рантайм: e2e эталонов по собранным формам', async () => {
  const mounted = await mountForms({ outDir });
  const e2e = runE2e({ outDir, mounted });
  return { mounted, byProject: summarizeE2e(e2e) };
});
await step('T4', 'подбор API', () => trackT4(ctx));
await step('T5', 'проверка кода на эталонах', () => trackT5(ctx));
await step('T6', 'пригодность ответа', async () => trackT6(ctx));

const metrics = buildMetrics(results);
writeFileSync(path.join(outDir, 'metrics.json'), JSON.stringify(metrics, null, 2));
writeFileSync(path.join(outDir, 'report.md'), renderReport(results, meta));
console.log(`\nСводка: ${path.relative(repoRoot, path.join(outDir, 'report.md'))}`);
console.log(`Метрики: ${path.relative(repoRoot, path.join(outDir, 'metrics.json'))}`);

const record = await calibrationRecord(results, metrics, {
  startedAt,
  serverPath: CHANNELS.node.script,
  channels,
});
const { local, published } = writeRecords([record], {
  batchId: record.batchId,
  harness: 'calibration',
  label: channels.join('-'),
  publish: has('publish'),
});
console.log(`Запись прогона: ${path.relative(repoRoot, published ?? local)}`);

const baselineFile = path.join(
  repoRoot,
  'packages/reformer-mcp/eval/baselines/calibration-baseline.json'
);
let gateFailed = false;
if (has('save-baseline')) {
  const note = {
    date: startedAt.toISOString().slice(0, 10),
    inspector: INSPECTOR_VERSION,
    channels,
  };
  writeFileSync(baselineFile, `${JSON.stringify({ ...note, ...metrics }, null, 2)}\n`);
  console.log(`Baseline записан: ${path.relative(repoRoot, baselineFile)}`);
} else if (has('gate')) {
  const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
  const { regressions, improvements, incomparable } = compareCalibration(metrics, baseline);
  console.log(
    `\n## Против baseline: улучшений ${improvements.length}, ухудшений ${regressions.length}`
  );
  for (const line of improvements) console.log(`+ ${line}`);
  for (const line of incomparable) console.log(`· не сравнимо: ${line}`);
  for (const line of regressions) console.error(`✗ ${line}`);
  gateFailed = regressions.length > 0;
}

process.exitCode = gateFailed || results.smoke?.some((c) => c.status === 'fail') ? 1 : 0;

function printChecks(title, checks) {
  const icon = { pass: '✓', fail: '✗', info: '·' };
  console.log(`## ${title}`);
  for (const c of checks) {
    console.log(`${icon[c.status]} ${c.id.padEnd(6)} ${c.channel.padEnd(6)} ${c.title}`);
    if (c.status !== 'pass' && c.detail) console.log(`         ${c.detail}`);
  }
  const counts = ['pass', 'fail', 'info'].map(
    (s) => `${s} ${checks.filter((c) => c.status === s).length}`
  );
  console.log(counts.join(' · '));
}
