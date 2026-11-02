#!/usr/bin/env node
/**
 * Сравнить два набора прогонов: `npm run mcp:compare -- <A> <B>`.
 *
 * A и B — файл `.jsonl`, идентификатор батча (ищется в опубликованных и в `.tmp/mcp-runs`) либо
 * `baseline:<ключ>` из `packages/reformer-mcp/eval/runs/baselines.json`.
 *
 *   --show-holdout   показать holdout по сценариям (по умолчанию только агрегатом)
 *   --gate           выйти с кодом 1 при регрессии
 *   --md <файл>      записать отчёт в файл
 *
 * Прогоны с вердиктом `invalid` (сломался прибор, а не форма) в статистику не входят.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkStatus,
  publishedDirectory,
  readRecords,
  repoRoot,
  runsDirectory,
} from './record.mjs';
import { fisherExact, median, passAtK, passPowerK, signTest, wilsonInterval } from './stats.mjs';

const SIGNIFICANCE = 0.05;

const modelOf = (record) => record.agent.model ?? record.agent.kind;
const COMPARABLE_AXES = {
  подход: (record) => record.approach.id,
  модель: modelOf,
};

/**
 * Оси, по которым наборы разведены полностью: A на одном подходе, B на другом. Это и есть предмет
 * сравнения, поэтому из ключа ячейки такая ось уходит, иначе ни одна ячейка не сопоставится.
 */
function comparedAxes(recordsA, recordsB) {
  return Object.entries(COMPARABLE_AXES).flatMap(([name, read]) => {
    const valuesA = new Set(recordsA.map(read));
    const valuesB = new Set(recordsB.map(read));
    const disjoint =
      valuesA.size > 0 && valuesB.size > 0 && ![...valuesA].some((value) => valuesB.has(value));
    return disjoint
      ? [{ name, read, from: [...valuesA].join(', '), to: [...valuesB].join(', ') }]
      : [];
  });
}

/** Ключ ячейки: оси, по которым прогоны сопоставимы; сравниваемые оси в него не входят. */
const cellKey = (record, axes) =>
  [
    record.harness,
    record.scenario.id,
    record.scenario.target ?? '-',
    ...Object.entries(COMPARABLE_AXES)
      .filter(([name]) => !axes.some((axis) => axis.name === name))
      .map(([, read]) => read(record)),
  ].join(' | ');

function findPublished(directory, batchId) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return findPublished(full, batchId);
    return entry.name.startsWith(batchId) && entry.name.endsWith('.jsonl') ? [full] : [];
  });
}

/** Разобрать аргумент сравнения в записи. */
export function loadBatch(reference) {
  let target = reference;
  if (target.startsWith('baseline:')) {
    const file = path.join(publishedDirectory, 'baselines.json');
    const baselines = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    const key = target.slice('baseline:'.length);
    if (!baselines[key]) throw new Error(`В baselines.json нет ключа «${key}»`);
    target = baselines[key];
  }
  if (existsSync(target)) return readRecords(target);
  const relative = path.join(repoRoot, target);
  if (existsSync(relative)) return readRecords(relative);
  const published = findPublished(publishedDirectory, target);
  if (published.length > 0) return published.flatMap(readRecords);
  const local = path.join(runsDirectory, target, 'records.jsonl');
  if (existsSync(local)) return readRecords(local);
  throw new Error(`Не найден набор прогонов «${reference}»`);
}

function summarizeCell(records) {
  const counted = records.filter((record) => record.verdict !== 'invalid');
  const passed = counted.filter((record) => record.verdict === 'pass').length;
  const usage = (field) =>
    median(counted.map((record) => record.usage?.[field]).filter((value) => value != null));
  return {
    passed,
    total: counted.length,
    invalid: records.length - counted.length,
    interval: wilsonInterval(passed, counted.length),
    split: records[0].scenario.split,
    tokens: usage('inputTokens'),
    costUsd: usage('costUsd'),
    calls: usage('toolCalls'),
    // Статус проверки в ячейке — по большинству прогонов: одиночный промах в серии не переворот.
    checks: majorityChecks(counted),
    metrics: Object.fromEntries(
      (counted.at(-1)?.metrics ?? []).map((metric) => [metric.id, metric])
    ),
  };
}

function majorityChecks(records) {
  const votes = {};
  for (const record of records) {
    for (const [id, check] of Object.entries(record.checks)) {
      const status = checkStatus(check);
      (votes[id] ??= {})[status] ??= 0;
      votes[id][status]++;
    }
  }
  return Object.fromEntries(
    Object.entries(votes).map(([id, counts]) => [
      id,
      Object.entries(counts).sort((first, second) => second[1] - first[1])[0][0],
    ])
  );
}

const metricNumber = (metric) =>
  metric.value !== undefined ? metric.value : metric.hit / (metric.total || 1);

/** Сравнить наборы. Чистая функция: печать и код выхода — забота CLI. */
export function compareBatches(recordsA, recordsB) {
  const axes = comparedAxes(recordsA, recordsB);
  const group = (records) => {
    const cells = new Map();
    for (const record of records) {
      const key = cellKey(record, axes);
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(record);
    }
    return cells;
  };
  const cellsA = group(recordsA);
  const cellsB = group(recordsB);
  const keys = [...new Set([...cellsA.keys(), ...cellsB.keys()])].sort();

  const cells = [];
  const regressions = [];
  const improvements = [];
  let improvedCells = 0;
  let regressedCells = 0;

  for (const key of keys) {
    const a = cellsA.has(key) ? summarizeCell(cellsA.get(key)) : null;
    const b = cellsB.has(key) ? summarizeCell(cellsB.get(key)) : null;
    if (!a || !b) {
      cells.push({ key, a, b, onlyIn: a ? 'A' : 'B' });
      continue;
    }
    const pValue = fisherExact(a.passed, a.total - a.passed, b.passed, b.total - b.passed);
    const rateA = a.total ? a.passed / a.total : 0;
    const rateB = b.total ? b.passed / b.total : 0;
    if (rateB > rateA) improvedCells++;
    if (rateB < rateA) regressedCells++;

    const flips = [];
    for (const id of new Set([...Object.keys(a.checks), ...Object.keys(b.checks)])) {
      if (a.checks[id] !== b.checks[id]) {
        flips.push({ id, from: a.checks[id] ?? '—', to: b.checks[id] ?? '—' });
      }
    }
    const metricChanges = [];
    for (const [id, metricB] of Object.entries(b.metrics)) {
      const metricA = a.metrics[id];
      if (!metricA) continue;
      const before = metricNumber(metricA);
      const after = metricNumber(metricB);
      if (before === after) continue;
      const worse =
        (metricB.better === 'higher' && after < before) ||
        (metricB.better === 'lower' && after > before);
      metricChanges.push({ id, metricA, metricB, worse });
    }

    const entry = { key, a, b, pValue, flips, metricChanges };
    cells.push(entry);

    const tuned = b.split !== 'holdout';
    if (tuned && rateB < rateA && pValue < SIGNIFICANCE) {
      regressions.push(
        `${key}: ${a.passed}/${a.total} → ${b.passed}/${b.total} (p=${pValue.toFixed(3)})`
      );
    }
    if (tuned && a.total === 1 && b.total === 1) {
      // Детерминированный стенд: повторов нет, поэтому значим любой ухудшившийся показатель.
      for (const change of metricChanges.filter((metric) => metric.worse)) {
        regressions.push(
          `${key}: ${change.id} ${formatMetric(change.metricA)} → ${formatMetric(change.metricB)}`
        );
      }
      for (const flip of flips.filter((item) => item.from === 'pass')) {
        regressions.push(`${key}: ${flip.id} pass → ${flip.to}`);
      }
    }
    if (rateB > rateA && pValue < SIGNIFICANCE) {
      improvements.push(`${key}: ${a.passed}/${a.total} → ${b.passed}/${b.total}`);
    }
  }

  return {
    axes: axes.map(({ name, from, to }) => ({ name, from, to })),
    cells,
    regressions,
    improvements,
    pairedSignTest: signTest(improvedCells, regressedCells),
    improvedCells,
    regressedCells,
    aggregates: { A: aggregate(recordsA), B: aggregate(recordsB) },
    provenance: { A: provenance(recordsA), B: provenance(recordsB) },
  };
}

function aggregate(records) {
  const groups = {};
  for (const record of records) {
    if (record.verdict === 'invalid') continue;
    const split = record.scenario.split ?? 'tuned';
    const level = record.scenario.level ?? '—';
    for (const key of [`split ${split}`, ...(split === 'holdout' ? [] : [`уровень ${level}`])]) {
      const item = (groups[key] ??= { passed: 0, total: 0 });
      item.total++;
      if (record.verdict === 'pass') item.passed++;
    }
  }
  return Object.fromEntries(
    Object.entries(groups).map(([key, { passed, total }]) => [
      key,
      {
        passed,
        total,
        interval: wilsonInterval(passed, total),
        passAt3: passAtK(passed, total, 3),
        passPower3: passPowerK(passed, total, 3),
      },
    ])
  );
}

function provenance(records) {
  const distinct = (read) => [...new Set(records.map(read))].join(', ');
  return {
    batches: distinct((record) => record.batchId),
    gitSha: distinct((record) => record.source.gitSha + (record.source.dirty ? '+dirty' : '')),
    dirtyDigest: distinct((record) => record.source.dirtyDigest ?? '—'),
    surfaceDigest: distinct((record) => record.server.surfaceDigest ?? '—'),
    buildDigest: distinct((record) => record.server.buildDigest ?? '—'),
    knowledgeDigest: distinct((record) => record.server.knowledgeDigest ?? '—'),
    staticTokens: distinct((record) => record.server.staticTokens ?? '—'),
  };
}

function formatMetric(metric) {
  return metric.value !== undefined ? String(metric.value) : `${metric.hit}/${metric.total}`;
}

const percent = (value) => `${Math.round(value * 100)}%`;
const interval = ([low, high]) => `[${percent(low)}…${percent(high)}]`;

/** Отчёт сравнения в markdown. */
export function renderComparison(result, { showHoldout = false } = {}) {
  const lines = ['# Сравнение прогонов', ''];
  lines.push('| | A | B |', '| --- | --- | --- |');
  for (const [title, field] of [
    ['батч', 'batches'],
    ['коммит', 'gitSha'],
    ['правки', 'dirtyDigest'],
    ['поверхность', 'surfaceDigest'],
    ['сборка', 'buildDigest'],
    ['знание', 'knowledgeDigest'],
    ['цена подключения, tok', 'staticTokens'],
  ]) {
    const a = result.provenance.A[field];
    const b = result.provenance.B[field];
    lines.push(`| ${title} | ${a} | ${a === b ? '=' : b} |`);
  }
  lines.push('');

  for (const axis of result.axes)
    lines.push(`Сравнивается ${axis.name}: ${axis.from} → ${axis.to}.`, '');

  const visible = result.cells.filter((cell) => {
    const split = cell.b?.split ?? cell.a?.split;
    return showHoldout || split !== 'holdout';
  });
  const changed = visible.filter(
    (cell) =>
      cell.onlyIn ||
      cell.flips.length > 0 ||
      cell.metricChanges.length > 0 ||
      cell.a.passed / (cell.a.total || 1) !== cell.b.passed / (cell.b.total || 1)
  );

  if (changed.length === 0) {
    lines.push('Изменений нет: вердикты, проверки и метрики совпадают.', '');
  } else {
    lines.push('## Ячейки', '');
    lines.push(
      '| ячейка | A | B | p | токены A→B | стоимость A→B |',
      '| --- | --- | --- | --- | --- | --- |'
    );
    for (const cell of changed) {
      if (cell.onlyIn) {
        const side = cell.a ?? cell.b;
        lines.push(
          `| ${cell.key} | только в ${cell.onlyIn}: ${side.passed}/${side.total} | | | | |`
        );
        continue;
      }
      const { a, b } = cell;
      lines.push(
        `| ${cell.key} | ${a.passed}/${a.total} ${interval(a.interval)} | ${b.passed}/${b.total} ${interval(b.interval)} | ${cell.pValue.toFixed(3)} | ${a.tokens ?? '—'}→${b.tokens ?? '—'} | ${a.costUsd ?? '—'}→${b.costUsd ?? '—'} |`
      );
    }
    lines.push('');
    const flips = changed.filter((cell) => cell.flips?.length > 0);
    if (flips.length > 0) {
      lines.push('## Перевороты проверок', '');
      for (const cell of flips) {
        for (const flip of cell.flips)
          lines.push(`- ${cell.key}: \`${flip.id}\` ${flip.from} → ${flip.to}`);
      }
      lines.push('');
    }
    const metrics = changed.filter((cell) => cell.metricChanges?.length > 0);
    if (metrics.length > 0) {
      lines.push('## Метрики', '');
      for (const cell of metrics) {
        for (const change of cell.metricChanges) {
          lines.push(
            `- ${cell.key}: \`${change.id}\` ${formatMetric(change.metricA)} → ${formatMetric(change.metricB)}${change.worse ? ' ✗' : ''}`
          );
        }
      }
      lines.push('');
    }
  }

  lines.push(
    '## Агрегаты',
    '',
    '| группа | A | B | pass@3 B | pass^3 B |',
    '| --- | --- | --- | --- | --- |'
  );
  const groups = new Set([
    ...Object.keys(result.aggregates.A),
    ...Object.keys(result.aggregates.B),
  ]);
  for (const group of [...groups].sort()) {
    const format = (item) =>
      item ? `${item.passed}/${item.total} ${interval(item.interval)}` : '—';
    const b = result.aggregates.B[group];
    const share = (value) => (value == null ? '—' : percent(value));
    lines.push(
      `| ${group} | ${format(result.aggregates.A[group])} | ${format(b)} | ${share(b?.passAt3)} | ${share(b?.passPower3)} |`
    );
  }
  lines.push(
    '',
    `Парный знаковый тест по ячейкам: лучше ${result.improvedCells}, хуже ${result.regressedCells}, p=${result.pairedSignTest.toFixed(3)}.`,
    '',
    'При трёх повторах значим только переход 0/3 ↔ 3/3 (и то p=0.1): для решений нужно N=5 и больше.',
    ''
  );
  if (result.regressions.length > 0) {
    lines.push('## Регрессии', '');
    for (const regression of result.regressions) lines.push(`- ${regression}`);
    lines.push('');
  }
  return lines.join('\n');
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const argv = process.argv.slice(2);
  const has = (name) => argv.includes(`--${name}`);
  const flagValue = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? argv[index + 1] : null;
  };
  const markdownFile = flagValue('md');
  const references = argv.filter(
    (argument, index) => !argument.startsWith('--') && argv[index - 1] !== '--md'
  );
  if (references.length !== 2) {
    console.error(
      'Использование: npm run mcp:compare -- <A> <B> [--show-holdout] [--gate] [--md файл]'
    );
    process.exit(2);
  }
  const result = compareBatches(loadBatch(references[0]), loadBatch(references[1]));
  const report = renderComparison(result, { showHoldout: has('show-holdout') });
  console.log(report);
  if (markdownFile) {
    mkdirSync(path.dirname(path.resolve(markdownFile)), { recursive: true });
    writeFileSync(path.resolve(markdownFile), report);
  }
  if (has('gate') && result.regressions.length > 0) process.exit(1);
}
