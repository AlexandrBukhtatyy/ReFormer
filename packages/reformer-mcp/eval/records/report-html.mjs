#!/usr/bin/env node
/**
 * Сводка опубликованных прогонов: `npm run mcp:report [-- --out <файл>] [--local]`.
 *
 * Самодостаточный HTML (встроенные стили и SVG, без сети) строится из `packages/reformer-mcp/eval/runs/**` и
 * потому в репозиторий не кладётся. `--local` добавляет батчи из `.tmp/mcp-runs`.
 *
 * Holdout показан только агрегатом: разбор его провалов по сценариям превратил бы его в обычный
 * настроечный набор.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { publishedDirectory, readRecords, repoRoot, runsDirectory } from './record.mjs';
import { median, wilsonInterval } from './stats.mjs';

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"]/g, (character) => `&#${character.charCodeAt(0)};`);

function jsonlFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return jsonlFiles(full);
    return entry.name.endsWith('.jsonl') ? [full] : [];
  });
}

const metricValue = (metric) =>
  metric.value !== undefined ? metric.value : metric.hit / (metric.total || 1);

/** Линия тренда: по точке на батч; подпись последней точки и её дата. */
function sparkline(points, format) {
  const width = 240;
  const height = 48;
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const spread = high - low || 1;
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * (width - 8) + 4;
    const y = height - 6 - ((point.value - low) / spread) * (height - 12);
    return { x, y, point };
  });
  const line = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const dots = coordinates
    .map(
      ({ x, y, point }) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.5"><title>${escapeHtml(point.date)}: ${escapeHtml(format(point.value))}</title></circle>`
    )
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Тренд"><polyline points="${line}"/>${dots}</svg>`;
}

/** Метрики детерминированных стендов (по записи на батч), сгруппированные во времени. */
function trendSeries(records) {
  const series = new Map();
  for (const record of records) {
    if (record.harness !== 'retrieval' && record.harness !== 'calibration') continue;
    for (const metric of record.metrics) {
      const key = `${record.harness} · ${record.approach.id} · ${metric.id}`;
      if (!series.has(key)) series.set(key, { key, metric, points: [] });
      series
        .get(key)
        .points.push({ date: record.startedAt.slice(0, 10), value: metricValue(metric) });
    }
  }
  return [...series.values()];
}

/** Доля прошедших по батчам сценариев: уровень × модель × подход. */
function scenarioTrends(records) {
  const groups = new Map();
  for (const record of records) {
    if (record.harness !== 'scenario' && record.harness !== 'builder') continue;
    if (record.verdict === 'invalid' || record.scenario.split === 'holdout') continue;
    const series = `${record.harness} · ${record.agent.model ?? record.agent.kind} · ${record.approach.id}`;
    const batches = groups.get(series) ?? new Map();
    groups.set(series, batches);
    const batch = batches.get(record.batchId) ?? {
      date: record.startedAt.slice(0, 10),
      passed: 0,
      total: 0,
    };
    batches.set(record.batchId, batch);
    batch.total++;
    if (record.verdict === 'pass') batch.passed++;
  }
  return [...groups.entries()].map(([key, batches]) => ({
    key,
    points: [...batches.values()].map((batch) => ({
      date: batch.date,
      value: batch.passed / batch.total,
      passed: batch.passed,
      total: batch.total,
    })),
  }));
}

/** Последний батч каждой конфигурации: сценарий × (модель, подход) → k/n. */
function latestMatrix(records) {
  const tuned = records.filter(
    (record) =>
      (record.harness === 'scenario' || record.harness === 'builder') &&
      record.scenario.split !== 'holdout'
  );
  const latestBatch = new Map();
  for (const record of tuned) {
    const column = `${record.agent.model ?? record.agent.kind} · ${record.approach.id}`;
    const current = latestBatch.get(column);
    if (!current || record.batchId > current) latestBatch.set(column, record.batchId);
  }
  const cells = new Map();
  for (const record of tuned) {
    const column = `${record.agent.model ?? record.agent.kind} · ${record.approach.id}`;
    if (latestBatch.get(column) !== record.batchId || record.verdict === 'invalid') continue;
    const row = `${record.scenario.id}${record.scenario.target ? ` (${record.scenario.target})` : ''}`;
    const key = `${row}\u0000${column}`;
    const cell = cells.get(key) ?? { passed: 0, total: 0, costs: [] };
    cells.set(key, cell);
    cell.total++;
    if (record.verdict === 'pass') cell.passed++;
    if (record.usage?.costUsd != null) cell.costs.push(record.usage.costUsd);
  }
  const rows = [...new Set([...cells.keys()].map((key) => key.split('\u0000')[0]))].sort();
  return { rows, columns: [...latestBatch.keys()].sort(), cells };
}

function holdoutAggregate(records) {
  const groups = new Map();
  for (const record of records) {
    if (record.scenario.split !== 'holdout' || record.verdict === 'invalid') continue;
    const key = `${record.agent.model ?? record.agent.kind} · ${record.approach.id}`;
    const group = groups.get(key) ?? { passed: 0, total: 0 };
    groups.set(key, group);
    group.total++;
    if (record.verdict === 'pass') group.passed++;
  }
  return [...groups.entries()];
}

const percent = (value) => `${Math.round(value * 100)}%`;

/** Страница сводки. Чистая функция — проверяется тестом. */
export function renderReportHtml(records) {
  const sorted = [...records].sort((first, second) =>
    first.startedAt.localeCompare(second.startedAt)
  );
  const trends = trendSeries(sorted);
  const scenarios = scenarioTrends(sorted);
  const matrix = latestMatrix(sorted);
  const holdout = holdoutAggregate(sorted);
  const batches = new Set(sorted.map((record) => record.batchId)).size;

  const trendCards = trends
    .map(({ key, points, metric }) => {
      const last = points.at(-1).value;
      const format = (value) =>
        metric.total !== undefined || metric.better === 'higher'
          ? String(+value.toFixed(3))
          : String(value);
      return `<figure><figcaption>${escapeHtml(key)}</figcaption>${sparkline(points, format)}<strong>${escapeHtml(format(last))}</strong></figure>`;
    })
    .join('');
  const scenarioCards = scenarios
    .map(({ key, points }) => {
      const last = points.at(-1);
      return `<figure><figcaption>${escapeHtml(key)}</figcaption>${sparkline(points, percent)}<strong>${last.passed}/${last.total}</strong></figure>`;
    })
    .join('');

  const matrixRows = matrix.rows
    .map((row) => {
      const cells = matrix.columns.map((column) => {
        const cell = matrix.cells.get(`${row}\u0000${column}`);
        if (!cell) return '<td class="empty">—</td>';
        const [low, high] = wilsonInterval(cell.passed, cell.total);
        const rate = cell.passed / cell.total;
        const tone = rate === 1 ? 'pass' : rate === 0 ? 'fail' : 'mixed';
        const cost = median(cell.costs);
        return `<td class="${tone}" title="Уилсон 95%: ${percent(low)}…${percent(high)}${cost ? `; медиана $${cost.toFixed(2)}` : ''}">${cell.passed}/${cell.total}</td>`;
      });
      return `<tr><th scope="row">${escapeHtml(row)}</th>${cells.join('')}</tr>`;
    })
    .join('');
  const matrixHead = matrix.columns
    .map((column) => `<th scope="col">${escapeHtml(column)}</th>`)
    .join('');

  const holdoutRows = holdout
    .map(([key, { passed, total }]) => {
      const [low, high] = wilsonInterval(passed, total);
      return `<tr><th scope="row">${escapeHtml(key)}</th><td>${passed}/${total}</td><td>${percent(low)}…${percent(high)}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Прогоны MCP</title>
<style>
:root { color-scheme: light dark; --ink: #1f2328; --muted: #656d76; --line: #d0d7de; --surface: #ffffff; --pass: #1a7f37; --fail: #cf222e; --mixed: #9a6700; }
@media (prefers-color-scheme: dark) { :root { --ink: #e6edf3; --muted: #8d96a0; --line: #30363d; --surface: #0d1117; --pass: #3fb950; --fail: #f85149; --mixed: #d29922; } }
body { margin: 0 auto; max-width: 1080px; padding: 24px 16px 64px; font: 15px/1.5 system-ui, sans-serif; color: var(--ink); background: var(--surface); }
h1 { font-size: 24px; margin: 0 0 4px; } h2 { font-size: 17px; margin: 32px 0 12px; }
p { color: var(--muted); margin: 0 0 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; }
figure { margin: 0; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; min-width: 0; }
figcaption { font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
figure strong { font-variant-numeric: tabular-nums; }
svg { display: block; width: 100%; height: 48px; margin: 4px 0; }
polyline { fill: none; stroke: currentColor; stroke-width: 1.5; } circle { fill: currentColor; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { border: 1px solid var(--line); padding: 4px 10px; text-align: left; font-weight: 400; }
thead th { font-size: 12px; color: var(--muted); }
td.pass { color: var(--pass); font-weight: 600; } td.fail { color: var(--fail); font-weight: 600; } td.mixed { color: var(--mixed); font-weight: 600; } td.empty { color: var(--muted); }
</style>
</head>
<body>
<h1>Прогоны MCP</h1>
<p>${records.length} записей, ${batches} батчей. Токены — оценка chars/4 у стендов без модели и данные провайдера у агентов.</p>
<h2>Сценарии: доля прошедших по батчам</h2>
${scenarioCards ? `<div class="grid">${scenarioCards}</div>` : '<p>Опубликованных прогонов сценариев пока нет.</p>'}
<h2>Последний батч: сценарий × модель и подход</h2>
${matrix.rows.length ? `<div class="scroll"><table><thead><tr><th scope="col">Сценарий</th>${matrixHead}</tr></thead><tbody>${matrixRows}</tbody></table></div>` : '<p>Нет данных.</p>'}
<h2>Holdout: только агрегат</h2>
${holdoutRows ? `<div class="scroll"><table><thead><tr><th scope="col">Модель и подход</th><th scope="col">Прошло</th><th scope="col">Уилсон 95%</th></tr></thead><tbody>${holdoutRows}</tbody></table></div>` : '<p>Нет данных.</p>'}
<h2>Стенды без модели: тренды метрик</h2>
${trendCards ? `<div class="grid">${trendCards}</div>` : '<p>Нет данных.</p>'}
</body>
</html>
`;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const argv = process.argv.slice(2);
  const outIndex = argv.indexOf('--out');
  const out = path.resolve(
    outIndex >= 0 ? argv[outIndex + 1] : path.join(repoRoot, '.tmp/mcp-eval/report/index.html')
  );
  const files = [...jsonlFiles(publishedDirectory)];
  if (argv.includes('--local')) files.push(...jsonlFiles(runsDirectory));
  const seen = new Set();
  const records = files.flatMap(readRecords).filter((record) => {
    if (seen.has(record.runId)) return false;
    seen.add(record.runId);
    return true;
  });
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, renderReportHtml(records));
  console.log(`${records.length} записей → ${path.relative(repoRoot, out)}`);
}
