#!/usr/bin/env node
/**
 * История метрик `@reformer/mcp`: `packages/reformer-mcp/eval/runs/history.json`.
 *
 * Сырьё и записи прогонов остаются в `.tmp/mcp-runs`. В git лежит только история: точка на батч ×
 * серию и события — что менялось между точками. По ней строится дашборд (`npm run mcp:report`).
 *
 *   npm run mcp:history -- add <батч | records.jsonl>… [--tag <тег>]…   точки батча (заменяет прежние)
 *   npm run mcp:history -- add --all [--tag <тег>]…                     все батчи `.tmp/mcp-runs`
 *   npm run mcp:history -- tag <батч> <тег>… | untag <батч> <тег>…
 *   npm run mcp:history -- event --kind <вид> --title <текст> [--date Г-М-Д] [--refs a,b] [--commit sha]
 *   npm run mcp:history -- events-from-git [--since Г-М-Д]               события из коммитов с Refs
 *   npm run mcp:history -- list                                          серии и число точек
 *   npm run mcp:history -- check                                         формат файла
 *
 * **Серия** — стенд · агент · подход: сравнивать значения можно только внутри неё. Набор ячеек
 * «сценарий × таргет» и отпечаток прибора хранятся в точке: дашборд рвёт линию, где они сменились.
 *
 * **Теги** отбирают точки на графики. Автоматические: `smoke` (агент `replay` — путь без модели),
 * `dirty` (прогон на незакоммиченном дереве), `reconstructed` (батч без `records.jsonl`, записи
 * восстановлены по сырью), `reverified`, `imported` (из `source.provenance`). Свои — `--tag` и `tag`.
 * При повторном `add` свои теги батча сохраняются.
 *
 * **События** — вертикальные отметки на графиках. Виды: `server` (правка сервера), `knowledge`
 * (корпус знаний), `instrument` (верификатор, контракты, стенд — скачок метрики здесь не улучшение),
 * `agent` (модель, промпт агента). `events-from-git` берёт коммиты с `Refs:`; ручные — `event`.
 *
 * Holdout в точке только агрегатом (`holdout: [pass, всего]`): по ячейкам его не разбирают.
 *
 * Файл пишется по строке на точку и на событие (diff читается построчно) и исключён из Prettier.
 *
 * @module reformer-mcp/eval/records/history
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { batchStartedAt, readBatchRecords, readJsonl } from './batch-records.mjs';
import { packageDirectory, repoRoot, runsDirectory } from './record.mjs';
import { median } from './stats.mjs';

export const HISTORY_FORMAT = 'reformer-mcp-history/1';
export const historyFile = path.join(packageDirectory, 'eval', 'runs', 'history.json');

/** Теги, которые `add` ставит сам; остальные — свои, их `add` сохраняет. */
export const AUTO_TAGS = ['smoke', 'dirty', 'reconstructed', 'reverified', 'imported'];
export const EVENT_KINDS = ['server', 'knowledge', 'instrument', 'agent'];
const SMOKE_AGENTS = new Set(['replay', 'builder-replay']);
const BATCH_ID = /^\d{8}T\d{6}Z-[0-9a-f]{4}$/;

const digest = (value) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const round = (value) =>
  value == null || Number.isNaN(value)
    ? null
    : Number.isInteger(value)
      ? value
      : Math.round(value * 1e4) / 1e4;
const metricValue = (metric) =>
  metric.value !== undefined ? metric.value : metric.hit / (metric.total || 1);

/** Ключ серии: стенд · агент · подход. */
export const seriesKey = (point) => `${point.harness} · ${point.agent} · ${point.approach}`;

/** Медианы метрик записей по id; нечисловые значения пропускаются. */
function recordMetrics(records) {
  const values = new Map();
  for (const record of records) {
    for (const metric of record.metrics ?? []) {
      const value = metricValue(metric);
      if (typeof value !== 'number' || Number.isNaN(value)) continue;
      if (!values.has(metric.id)) values.set(metric.id, []);
      values.get(metric.id).push(value);
    }
  }
  return Object.fromEntries([...values].map(([id, list]) => [id, round(median(list))]));
}

/** Агрегаты прогонов с моделью или replay: доля pass, счёт, ход работы — по настроечным ячейкам. */
function runMetrics(counted) {
  const passed = counted.filter((record) => record.verdict === 'pass').length;
  const scores = counted.map((record) => record.score).filter((score) => score != null);
  const usage = (field) =>
    counted.map((record) => record.usage?.[field]).filter((value) => value != null);
  const costs = usage('costUsd');
  const minutes = counted
    .map((record) => record.durationMs)
    .filter((value) => value != null && value > 0)
    .map((value) => value / 60000);
  const metrics = {
    passRate: counted.length ? passed / counted.length : null,
    score: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
    turns: median(usage('turns')),
    inputTokens: median(usage('inputTokens')),
    outputTokens: median(usage('outputTokens')),
    toolCalls: median(usage('toolCalls')),
    costUsd: costs.length ? costs.reduce((sum, cost) => sum + cost, 0) : null,
    minutes: median(minutes),
    ...recordMetrics(counted),
  };
  return Object.fromEntries(
    Object.entries(metrics)
      .filter(([, value]) => value != null)
      .map(([id, value]) => [id, round(value)])
  );
}

/**
 * Ячейки серии: `сценарий.таргет` → `[pass, всего, средний счёт, контракт]`. Контракт — первые
 * 8 знаков `contractDigest`: прибор сравнивается по ячейке, иначе смена набора ячеек выглядела бы
 * сменой прибора. У восстановленной записи контракта нет — `null`, «неизвестен», а не «другой».
 */
function cellsOf(counted) {
  const cells = {};
  for (const record of counted) {
    const key = `${record.scenario.id}.${record.scenario.target ?? '-'}`;
    const cell = (cells[key] ??= { passed: 0, total: 0, scores: [], contract: undefined });
    cell.total++;
    if (record.verdict === 'pass') cell.passed++;
    if (record.score != null) cell.scores.push(record.score);
    const contract = record.scenario?.contractDigest?.slice(0, 8) ?? null;
    cell.contract = cell.contract === undefined || cell.contract === contract ? contract : null;
  }
  return Object.fromEntries(
    Object.keys(cells)
      .sort()
      .map((key) => {
        const { passed, total, scores, contract } = cells[key];
        const score = scores.length
          ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
          : null;
        return [key, [passed, total, score, contract ?? null]];
      })
  );
}

/**
 * Отпечаток прибора у стендов без контракта (извлечение знания, калибровка) — набор проверок:
 * добавленный кейс корпуса меняет прибор. У сценариев и конструктора прибор — в ячейках.
 */
function instrumentOf(records) {
  if (records[0].harness === 'scenario' || records[0].harness === 'builder') return null;
  const checks = [...new Set(records.flatMap((record) => Object.keys(record.checks ?? {})))].sort();
  return checks.length > 0 ? digest(checks) : null;
}

/** Ячейки, у которых в обеих точках известен контракт и он разный. */
export function changedContracts(previous, point) {
  return Object.entries(point.cells ?? {})
    .filter(([key, cell]) => {
      const before = previous.cells?.[key]?.[3];
      return before && cell[3] && before !== cell[3];
    })
    .map(([key]) => key);
}

/**
 * Точки батча: по одной на серию.
 *
 * @param {object[]} records записи одного батча
 * @param {{ reconstructed?: boolean, tags?: string[] }} [options]
 */
export function pointsFromRecords(records, { reconstructed = false, tags = [] } = {}) {
  const groups = new Map();
  for (const record of records) {
    const agent = record.agent?.model ?? record.agent?.kind ?? 'none';
    const key = `${record.harness}\u0000${agent}\u0000${record.approach?.id ?? '-'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  return [...groups.values()].map((group) => {
    const first = group[0];
    const source = first.source;
    const server = first.server;
    const provenance = new Set(group.map((record) => record.source?.provenance).filter(Boolean));
    const autoTags = [
      SMOKE_AGENTS.has(first.agent?.kind) && 'smoke',
      source?.dirty && 'dirty',
      reconstructed && 'reconstructed',
      provenance.has('reverified') && 'reverified',
      provenance.has('imported') && 'imported',
    ].filter(Boolean);
    // Дата — начало батча по его id: у всех точек батча одна, у восстановленного тоже.
    const point = {
      batch: first.batchId,
      date:
        batchStartedAt(first.batchId) ??
        group
          .map((record) => record.startedAt)
          .filter(Boolean)
          .sort()[0],
      harness: first.harness,
      agent: first.agent?.model ?? first.agent?.kind ?? 'none',
      agentKind: first.agent?.kind ?? null,
      approach: first.approach?.id ?? '-',
      tags: [...new Set([...autoTags, ...tags])].sort(),
      git: source ? { sha: source.gitSha, branch: source.branch, dirty: source.dirty } : null,
      server: server
        ? {
            version: server.version ?? null,
            surface: server.surfaceDigest ?? null,
            build: server.buildDigest ?? null,
            knowledge: server.knowledgeDigest ?? null,
          }
        : null,
      instrument: instrumentOf(group),
      runs: group.length,
    };
    if (first.harness === 'scenario' || first.harness === 'builder') {
      const valid = group.filter((record) => record.verdict !== 'invalid');
      const tuned = valid.filter((record) => record.scenario?.split !== 'holdout');
      const holdout = valid.filter((record) => record.scenario?.split === 'holdout');
      Object.assign(point, {
        invalid: group.length - valid.length,
        passed: tuned.filter((record) => record.verdict === 'pass').length,
        counted: tuned.length,
        metrics: runMetrics(tuned),
        cells: cellsOf(tuned),
      });
      if (holdout.length > 0) {
        point.holdout = [
          holdout.filter((record) => record.verdict === 'pass').length,
          holdout.length,
        ];
      }
    } else {
      point.metrics = recordMetrics(group);
    }
    return point;
  });
}

const comparePoints = (first, second) =>
  first.date.localeCompare(second.date) ||
  first.batch.localeCompare(second.batch) ||
  seriesKey(first).localeCompare(seriesKey(second));
const compareEvents = (first, second) =>
  first.date.localeCompare(second.date) || first.id.localeCompare(second.id);

export function readHistory(file = historyFile) {
  if (!existsSync(file)) return { format: HISTORY_FORMAT, points: [], events: [] };
  const history = JSON.parse(readFileSync(file, 'utf8'));
  if (history.format !== HISTORY_FORMAT) {
    throw new Error(`${file}: формат ${history.format}, ожидался ${HISTORY_FORMAT}`);
  }
  return history;
}

/** Текст файла: по строке на точку и событие — изменение одного батча видно в diff одной строкой. */
export function serializeHistory(history) {
  const lines = (items) => items.map((item) => `    ${JSON.stringify(item)}`).join(',\n');
  const points = [...history.points].sort(comparePoints);
  const events = [...history.events].sort(compareEvents);
  return [
    '{',
    `  "format": ${JSON.stringify(HISTORY_FORMAT)},`,
    `  "points": [${points.length ? `\n${lines(points)}\n  ` : ''}],`,
    `  "events": [${events.length ? `\n${lines(events)}\n  ` : ''}]`,
    '}',
    '',
  ].join('\n');
}

export function writeHistory(history, file = historyFile) {
  writeFileSync(file, serializeHistory(history));
}

/** Проблемы файла истории. Пусто — файл годен. */
export function validateHistory(history) {
  const problems = [];
  if (history.format !== HISTORY_FORMAT) problems.push(`format: ${history.format}`);
  const seen = new Set();
  for (const point of history.points ?? []) {
    const where = `точка ${point.batch} · ${seriesKey(point)}`;
    for (const field of ['batch', 'date', 'harness', 'agent', 'approach']) {
      if (typeof point[field] !== 'string') problems.push(`${where}: нет поля ${field}`);
    }
    if (!Array.isArray(point.tags)) problems.push(`${where}: tags не массив`);
    if (typeof point.metrics !== 'object' || point.metrics === null) {
      problems.push(`${where}: нет metrics`);
    }
    const key = `${point.batch}\u0000${seriesKey(point)}`;
    if (seen.has(key)) problems.push(`${where}: точка повторяется`);
    seen.add(key);
  }
  const ids = new Set();
  for (const event of history.events ?? []) {
    const where = `событие ${event.id}`;
    if (!event.id || ids.has(event.id)) problems.push(`${where}: нет id или он повторяется`);
    ids.add(event.id);
    if (!/^\d{4}-\d{2}-\d{2}/.test(event.date ?? '')) problems.push(`${where}: дата ${event.date}`);
    if (!EVENT_KINDS.includes(event.kind)) problems.push(`${where}: вид ${event.kind}`);
    if (!event.title) problems.push(`${where}: нет title`);
  }
  return problems;
}

/**
 * Добавить точки батча: прежние точки того же батча заменяются, их свои теги сохраняются.
 *
 * @returns {object[]} добавленные точки
 */
export function addPoints(history, points) {
  const batches = new Set(points.map((point) => point.batch));
  const ownTags = new Map();
  for (const point of history.points) {
    if (!batches.has(point.batch)) continue;
    const own = point.tags.filter((tag) => !AUTO_TAGS.includes(tag));
    ownTags.set(`${point.batch}\u0000${seriesKey(point)}`, own);
  }
  history.points = history.points.filter((point) => !batches.has(point.batch));
  for (const point of points) {
    const own = ownTags.get(`${point.batch}\u0000${seriesKey(point)}`) ?? [];
    point.tags = [...new Set([...point.tags, ...own])].sort();
    history.points.push(point);
  }
  return points;
}

function git(args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 1 << 26 });
  return result.status === 0 ? result.stdout : null;
}

/** Пути коммита по видам события: первый в списке — главный. */
const EVENT_PATHS = [
  ['server', ['packages/reformer-mcp/src']],
  [
    'knowledge',
    [
      ':(glob)packages/*/docs/llms/**',
      ':(glob)packages/*/llms.txt',
      ':(glob)packages/*/llms-index.json',
    ],
  ],
  ['instrument', ['packages/reformer-mcp/eval']],
];
const SKIPPED_TYPES = /^(docs|chore|style|ci|build)(\(|:|!)/;

/** Коммиты с `Refs:` по видам событий; `range` — диапазон git либо `--since=…`. */
export function commitEvents(range) {
  const events = new Map();
  for (const [kind, paths] of EVENT_PATHS) {
    const log = git([
      'log',
      '--no-merges',
      '--date=short',
      '--format=%h%x1f%ad%x1f%s%x1f%b%x1e',
      range,
      '--',
      ...paths,
    ]);
    for (const entry of (log ?? '').split('\x1e')) {
      const [sha, date, subject, body] = entry.trim().split('\x1f');
      if (!sha || SKIPPED_TYPES.test(subject)) continue;
      const refs = (body ?? '').match(/^Refs:\s*(.+)$/m)?.[1];
      if (!refs) continue;
      const existing = events.get(sha);
      if (existing) {
        if (!existing.kinds.includes(kind)) existing.kinds.push(kind);
        continue;
      }
      events.set(sha, {
        id: sha,
        date,
        kind,
        kinds: [kind],
        title: subject,
        refs: refs.split(/,\s*/).filter(Boolean),
        commit: sha,
        source: 'git',
      });
    }
  }
  return [...events.values()].map(({ kinds, ...event }) =>
    kinds.length > 1 ? { ...event, also: kinds.slice(1) } : event
  );
}

/** Что сменилось между двумя точками серии: отпечатки и коммиты с `Refs`. */
export function describeChange(previous, point) {
  const changed = [];
  const contracts = changedContracts(previous, point);
  if (contracts.length > 0) changed.push(`контракт: ${contracts.join(', ')}`);
  if (previous.instrument && previous.instrument !== point.instrument) changed.push('прибор');
  for (const [field, label] of [
    ['surface', 'поверхность'],
    ['build', 'сборка'],
    ['knowledge', 'знание'],
  ]) {
    if (previous.server?.[field] && previous.server[field] !== point.server?.[field]) {
      changed.push(label);
    }
  }
  const cells = (item) => Object.keys(item.cells ?? {}).join();
  if (cells(previous) !== cells(point)) changed.push('набор ячеек');
  const from = previous.git?.sha;
  const to = point.git?.sha;
  const known = (sha) => sha && git(['cat-file', '-e', `${sha}^{commit}`]) !== null;
  const commits =
    from && to && from !== to && known(from) && known(to) ? commitEvents(`${from}..${to}`) : [];
  return { changed, commits };
}

/** Каталог батча или файл записей по аргументу. */
function resolveSource(argument) {
  for (const candidate of [
    path.resolve(argument),
    path.join(repoRoot, argument),
    path.join(runsDirectory, argument),
  ]) {
    if (!existsSync(candidate)) continue;
    if (statSync(candidate).isDirectory()) return { directory: candidate };
    return { file: candidate };
  }
  return null;
}

/** Записи по аргументу `add`: батч `.tmp/mcp-runs` или файл `records.jsonl`. */
function loadSource(argument) {
  const source = resolveSource(argument);
  if (!source) throw new Error(`Не найден батч или файл записей: ${argument}`);
  if (source.file) return { records: readJsonl(source.file), reconstructed: false };
  return readBatchRecords(source.directory);
}

function runCli() {
  const [command, ...rest] = process.argv.slice(2);
  const { values, positionals } = parseArgs({
    args: rest,
    allowPositionals: true,
    options: {
      tag: { type: 'string', multiple: true, default: [] },
      all: { type: 'boolean', default: false },
      kind: { type: 'string' },
      title: { type: 'string' },
      date: { type: 'string' },
      refs: { type: 'string' },
      commit: { type: 'string' },
      since: { type: 'string', default: '2026-10-01' },
    },
  });
  const history = readHistory();

  if (command === 'add') {
    const sources = values.all
      ? readdirSync(runsDirectory).filter((name) => BATCH_ID.test(name))
      : positionals;
    if (sources.length === 0) throw new Error('add: укажите батч, файл записей или --all');
    for (const argument of sources) {
      const { records, reconstructed } = loadSource(argument);
      if (records.length === 0) {
        console.log(`· ${argument}: записей нет — пропущен`);
        continue;
      }
      const before = history.points.slice();
      const points = addPoints(
        history,
        pointsFromRecords(records, { reconstructed, tags: values.tag })
      );
      for (const point of points) {
        const previous = before
          .filter(
            (item) =>
              seriesKey(item) === seriesKey(point) &&
              item.batch !== point.batch &&
              comparePoints(item, point) < 0
          )
          .sort(comparePoints)
          .at(-1);
        const summary = point.counted
          ? `pass ${point.passed}/${point.counted}`
          : point.holdout
            ? `holdout pass ${point.holdout[0]}/${point.holdout[1]}`
            : `метрик ${Object.keys(point.metrics).length}`;
        console.log(
          `+ ${point.batch} · ${seriesKey(point)}: ${summary} [${point.tags.join(', ')}]`
        );
        if (!previous || values.all) continue;
        const { changed, commits } = describeChange(previous, point);
        if (changed.length) console.log(`  с ${previous.batch} сменились: ${changed.join(', ')}`);
        for (const commit of commits) {
          console.log(
            `  ${commit.commit} ${commit.kind}: ${commit.title} (${commit.refs.join(', ')})`
          );
        }
      }
    }
  } else if (command === 'tag' || command === 'untag') {
    const [batch, ...tags] = positionals;
    const points = history.points.filter((point) => point.batch === batch);
    if (points.length === 0 || tags.length === 0) {
      throw new Error(`${command}: нужны батч из истории и теги`);
    }
    for (const point of points) {
      point.tags =
        command === 'tag'
          ? [...new Set([...point.tags, ...tags])].sort()
          : point.tags.filter((tag) => !tags.includes(tag));
    }
    console.log(`${batch}: точек ${points.length}, теги ${points[0].tags.join(', ') || '—'}`);
  } else if (command === 'event') {
    if (!EVENT_KINDS.includes(values.kind) || !values.title) {
      throw new Error(`event: нужны --kind (${EVENT_KINDS.join(' | ')}) и --title`);
    }
    const date = values.date ?? new Date().toISOString().slice(0, 10);
    const sameDay = history.events.filter((event) => event.id.startsWith(`m-${date}`)).length;
    const event = {
      id: `m-${date}-${sameDay + 1}`,
      date,
      kind: values.kind,
      title: values.title,
      refs: values.refs ? values.refs.split(/,\s*/) : [],
      ...(values.commit ? { commit: values.commit } : {}),
      source: 'manual',
    };
    history.events.push(event);
    console.log(`+ ${event.id} ${event.kind}: ${event.title}`);
  } else if (command === 'events-from-git') {
    const known = new Set(history.events.map((event) => event.id));
    const fresh = commitEvents(`--since=${values.since}`).filter((event) => !known.has(event.id));
    history.events.push(...fresh);
    for (const event of fresh) console.log(`+ ${event.id} ${event.kind}: ${event.title}`);
    console.log(`Событий из git: ${fresh.length}`);
    return writeHistory(history);
  } else if (command === 'list') {
    const series = new Map();
    for (const point of history.points) {
      const key = seriesKey(point);
      series.set(key, [...(series.get(key) ?? []), point]);
    }
    for (const [key, points] of [...series].sort()) {
      const tags = [...new Set(points.flatMap((point) => point.tags))].sort().join(', ');
      console.log(`${key}: точек ${points.length}${tags ? ` [${tags}]` : ''}`);
    }
    console.log(`Событий: ${history.events.length}`);
    return;
  } else if (command === 'check') {
    const problems = validateHistory(history);
    for (const problem of problems) console.error(problem);
    const text = existsSync(historyFile) ? readFileSync(historyFile, 'utf8') : '';
    if (text && text !== serializeHistory(history)) {
      console.error('Файл записан не по форме: перезапишите его командой истории');
      process.exitCode = 1;
    }
    if (problems.length > 0) process.exitCode = 1;
    console.log(`Точек ${history.points.length}, событий ${history.events.length}`);
    return;
  } else {
    console.error(
      'Команды: add <батч>… [--tag t] | add --all | tag | untag | event | events-from-git | list | check'
    );
    process.exitCode = 2;
    return;
  }
  const problems = validateHistory(history);
  if (problems.length > 0) throw new Error(`История не годится:\n  ${problems.join('\n  ')}`);
  writeHistory(history);
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  try {
    runCli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
