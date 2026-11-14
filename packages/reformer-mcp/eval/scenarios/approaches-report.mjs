#!/usr/bin/env node
/**
 * Отчёт «было/стало» по подходам стенда сценариев:
 *
 *   npm run mcp:approaches -- <батч> [<батч> …] [--sequence] [--save <снимок.json>]
 *   npm run mcp:approaches -- <снимок.json> [--sequence]
 *
 * Печатает markdown в stdout: вердикт и счёт по сценариям, ход каждого прогона (шаги, токены,
 * вызовы MCP, сборки, скрипты `run_script`), сводку по подходам и не пройденные проверки. Так
 * собран отчёт [Code Mode](../../../../docs/mcp-eval/code-mode.md).
 *
 * Что принимает:
 * - id батча из `.tmp/mcp-runs` (`20261113T010642Z-594a`) или путь к каталогу батча;
 * - несколько батчей: одна ячейка «сценарий × таргет × подход» в нескольких батчах берётся из
 *   последнего по порядку аргументов — так перезапуск заменяет сорванный прогон;
 * - снимок — `.json`, сохранённый `--save`: отчёт по нему тот же, что по батчам, но сырьё не нужно.
 *
 * `--sequence` — ещё и последовательность вызовов MCP по прогонам: `run_script` в скобках,
 * вложенные вызовы через «+», `✗` — ошибка вызова, `!` — ошибка скрипта.
 *
 * `--save <файл>` — сохранить снимок: посчитанные строки отчёта и последовательности вызовов, по
 * строке на прогон. Сырьё батчей лежит в `.tmp` и в git не едет, а снимок — несколько КБ: его
 * коммитят в `eval/runs/approaches/`, чтобы отчёт пересобирался после клона.
 *
 * Источники одного прогона — сырьё в `.tmp/mcp-runs/<батч>/<прогон>/`: запись, журнал модели
 * (`transcript.jsonl`) и трасса сервера (`server-trace.jsonl`). Опубликованной записи для отчёта
 * мало: в ней нет вложенных вызовов скриптов и ответов сервера.
 *
 * Батч без `records.jsonl` (остановлен или упал) читается восстановленными записями
 * (`../records/batch-records.mjs`): по `verify.json`, журналу модели и логу батча.
 *
 * @module reformer-mcp/eval/scenarios/approaches-report
 */

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readBatchRecords, readJsonl as jsonl, runDirectories } from '../records/batch-records.mjs';
import { repoRoot, runsDirectory } from '../records/record.mjs';

/** Формат снимка: строки отчёта и последовательности вызовов, без сырья. */
const SNAPSHOT_FORMAT = 'reformer-mcp-approaches/1';

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    sequence: { type: 'boolean', default: false },
    save: { type: 'string' },
  },
});

if (positionals.length === 0) {
  console.error(
    'Использование: npm run mcp:approaches -- <батч> [<батч> …] [--sequence] [--save <снимок.json>]\n' +
      '               npm run mcp:approaches -- <снимок.json> [--sequence]'
  );
  process.exit(2);
}

const isDirectory = (dir) => existsSync(dir) && statSync(dir).isDirectory();
const isFile = (file) => existsSync(file) && statSync(file).isFile();

/** Каталог батча по аргументу: путь или id из `.tmp/mcp-runs`. */
function resolveBatch(argument) {
  for (const candidate of [
    path.resolve(argument),
    path.join(repoRoot, argument),
    path.join(runsDirectory, argument),
  ]) {
    if (isDirectory(candidate)) return candidate;
  }
  console.error(`Батч не найден: ${argument}`);
  process.exit(2);
}

/** Записи батча стенда сценариев: из `records.jsonl` или восстановленные по сырью. */
const loadRecords = (batch) =>
  readBatchRecords(batch).records.filter((record) => record.harness === 'scenario');

/** Вызовы MCP прогона по трассе сервера. */
const toolTrace = (runDir) =>
  jsonl(path.join(runDir, 'server-trace.jsonl')).filter((entry) => entry.kind === 'tool');

/** Ход прогона: сборки, скрипты, вызовы — из журнала модели и трассы сервера. */
function processRow(batch, record) {
  const runDir = path.join(batch, path.basename(record.artifacts?.runDir ?? ''));
  const transcript = jsonl(path.join(runDir, 'transcript.jsonl'));
  const trace = toolTrace(runDir);
  const steps = transcript.filter((entry) => entry.role === 'assistant');
  const toolEntries = transcript.filter((entry) => entry.role === 'tool');
  const peak = Math.max(0, ...steps.map((entry) => entry.usage?.inputTokens ?? 0));
  // Сборки: прямые form_build и вложенные в run_script. Запрос грамматики (`grammar`) сборкой не
  // считается; успех — «✓ form_build: written» в ответе.
  const builds = [];
  for (const entry of trace) {
    const args = JSON.stringify(entry.arguments ?? entry.argumentsPreview ?? '');
    const written = (entry.result ?? '').match(/✓ form_build: written/g)?.length ?? 0;
    if (entry.name === 'form_build' && !/grammar/.test(args)) builds.push({ ok: written > 0 });
    // Профиль guided: form_edit правит intent и собирает той же сборкой — это сборка, если в ответе
    // есть её строка (все правки отклонены — сборки не было).
    if (entry.name === 'form_edit' && /form_build:/.test(entry.result ?? '')) {
      builds.push({ ok: written > 0 });
    }
    if (entry.name === 'run_script') {
      // В связке с guided сборку делает и вложенный form_edit.
      const innerBuilds = (entry.inner ?? []).filter(
        (inner) => inner.name === 'form_build' || inner.name === 'form_edit'
      ).length;
      const grammarOnly =
        /grammar/.test(args) && !/formBuild\(\s*\{\s*dir/.test(args) ? innerBuilds : 0;
      for (let i = 0; i < innerBuilds - grammarOnly; i++) builds.push({ ok: i < written });
    }
  }
  const scripts = trace.filter((entry) => entry.name === 'run_script');
  const metric = (id) => record.metrics?.find((item) => item.id === id)?.value;
  return {
    scenario: record.scenario.id,
    level: record.scenario.level,
    target: record.scenario.target,
    approach: record.approach.id,
    verdict: record.verdict,
    score: record.score,
    exitReason: record.exitReason,
    turns: record.usage?.turns ?? steps.length,
    inputTokens: record.usage?.inputTokens ?? 0,
    outputTokens: record.usage?.outputTokens ?? 0,
    peak,
    minutes: (record.durationMs ?? 0) / 60000,
    mcpCalls: trace.length,
    mcpErrors: trace.filter((entry) => entry.isError).length,
    fileCalls: toolEntries.filter((entry) => entry.source === 'workspace').length,
    wroteIntent: toolEntries.some(
      (entry) =>
        entry.name === 'write_file' &&
        /form\.intent\.json/.test(JSON.stringify(entry.arguments ?? {}))
    ),
    builds: builds.length,
    buildsOk: builds.filter((build) => build.ok).length,
    scripts: scripts.length,
    scriptErrors: scripts.filter((entry) => entry.isError).length,
    inner: scripts.reduce((sum, entry) => sum + (entry.inner?.length ?? 0), 0),
    truncations: metric('harness.truncations') ?? 0,
    textualCalls: metric('harness.textualCalls') ?? 0,
    failed: Object.entries(record.checks ?? {})
      .filter(([, value]) => Array.isArray(value) && value[0] === 'fail')
      .map(([id]) => id),
    batch: path.basename(batch),
    run: path.basename(runDir),
  };
}

/** Последовательность вызовов MCP прогона: `run_script` — в скобках со вложенными вызовами. */
const callSequence = (runDir) =>
  toolTrace(runDir).map((entry) => {
    if (entry.name !== 'run_script') return `${entry.name}${entry.isError ? '✗' : ''}`;
    const inner =
      (entry.inner ?? []).map((call) => call.name + (call.ok ? '' : '✗')).join('+') || '∅';
    const error = (entry.result ?? '').match(/script error: ([A-Za-z]+Error)/)?.[1] ?? '';
    return `[${inner}${error ? ` !${error}` : ''}]`;
  });

/** Снимок по сырью батчей: строки отчёта и последовательности вызовов всех прогонов. */
function collect(batchDirectories) {
  // Одна ячейка в нескольких батчах: берётся последний по порядку аргументов.
  const latest = new Map();
  for (const batch of batchDirectories) {
    for (const record of loadRecords(batch)) {
      const key = `${record.scenario.id}.${record.scenario.target}.${record.approach.id}`;
      latest.set(key, { batch, record });
    }
  }
  return {
    format: SNAPSHOT_FORMAT,
    batches: batchDirectories.map((batch) => path.basename(batch)),
    rows: [...latest.values()].map(({ batch, record }) => processRow(batch, record)),
    sequences: batchDirectories.flatMap((batch) =>
      runDirectories(batch).map((runDir) => ({
        batch: path.basename(batch),
        run: path.basename(runDir),
        calls: callSequence(runDir),
      }))
    ),
  };
}

/** Снимок файлом: по строке на прогон — изменение одного прогона видно в diff одной строкой. */
function saveSnapshot(file, snapshot) {
  const lines = (items) => items.map((item) => `    ${JSON.stringify(item)}`).join(',\n');
  const text = [
    '{',
    `  "format": ${JSON.stringify(snapshot.format)},`,
    `  "batches": ${JSON.stringify(snapshot.batches)},`,
    '  "rows": [',
    lines(snapshot.rows),
    '  ],',
    '  "sequences": [',
    lines(snapshot.sequences),
    '  ]',
    '}',
    '',
  ].join('\n');
  mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  writeFileSync(file, text);
}

function loadSnapshot(file) {
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  if (snapshot.format !== SNAPSHOT_FORMAT) {
    console.error(`${file}: формат ${snapshot.format}, ожидался ${SNAPSHOT_FORMAT}`);
    process.exit(2);
  }
  return snapshot;
}

const fromSnapshot = positionals.length === 1 && positionals[0].endsWith('.json');
if (fromSnapshot && !isFile(positionals[0])) {
  console.error(`Снимок не найден: ${positionals[0]}`);
  process.exit(2);
}
if (fromSnapshot && options.save) {
  console.error('--save собирает снимок по батчам, а не по другому снимку');
  process.exit(2);
}
const snapshot = fromSnapshot
  ? loadSnapshot(positionals[0])
  : collect(positionals.map(resolveBatch));
if (options.save) {
  saveSnapshot(options.save, snapshot);
  console.error(`Снимок: ${options.save}`);
}
const { rows } = snapshot;

const approaches = [...new Set(rows.map((row) => row.approach))];
const scenarios = [...new Set(rows.map((row) => row.scenario))].sort();
const pick = (scenario, approach) =>
  rows.find((row) => row.scenario === scenario && row.approach === approach);
const verdictMark = (row) =>
  !row ? '—' : row.verdict === 'pass' ? '✅' : row.verdict === 'invalid' ? '⚠️' : '❌';
const num = (value, digits = 0) =>
  value === undefined || value === null ? '—' : Number(value).toFixed(digits);
const k = (value) => (value === undefined ? '—' : `${(value / 1000).toFixed(1)}k`);
const sum = (rs, field) => rs.reduce((total, row) => total + row[field], 0);
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

console.log(`## По сценариям\n`);
console.log(
  '| Сценарий | Таргет | ' +
    approaches.map((a) => `${a}: вердикт · счёт · выход`).join(' | ') +
    ' |'
);
console.log('| --- | --- | ' + approaches.map(() => '---').join(' | ') + ' |');
for (const scenario of scenarios) {
  const any = rows.find((row) => row.scenario === scenario);
  const cells = approaches.map((approach) => {
    const row = pick(scenario, approach);
    return row ? `${verdictMark(row)} ${num(row.score, 2)} · ${row.exitReason}` : '—';
  });
  console.log(`| ${scenario} | ${any.target} | ${cells.join(' | ')} |`);
}

console.log(`\n## Процесс по сценариям\n`);
console.log(
  '| Сценарий | Подход | шагов | вход, ток. | пик шага | выход, ток. | мин | MCP | файлов | intent | сборок ✓/всего | скриптов (ошибок) | внутр. вызовов | усечений |'
);
console.log(
  '| --- | --- | --: | --: | --: | --: | --: | --: | --: | :-: | --: | --: | --: | --: |'
);
for (const scenario of scenarios) {
  for (const approach of approaches) {
    const row = pick(scenario, approach);
    if (!row) continue;
    const cells = [
      scenario,
      approach,
      row.turns,
      k(row.inputTokens),
      k(row.peak),
      k(row.outputTokens),
      num(row.minutes, 1),
      row.mcpCalls,
      row.fileCalls,
      row.wroteIntent ? '✓' : '—',
      `${row.buildsOk}/${row.builds}`,
      row.scripts ? `${row.scripts} (${row.scriptErrors})` : '—',
      row.inner || '—',
      row.truncations,
    ];
    console.log(`| ${cells.join(' | ')} |`);
  }
}

console.log(`\n## Итог\n`);
console.log('| Показатель | ' + approaches.join(' | ') + ' |');
console.log('| --- | ' + approaches.map(() => '--:').join(' | ') + ' |');
const line = (label, fn) =>
  console.log(
    `| ${label} | ${approaches.map((approach) => fn(rows.filter((row) => row.approach === approach))).join(' | ')} |`
  );
line('Прогонов', (rs) => rs.length);
line('Пройдено (pass)', (rs) => `${rs.filter((r) => r.verdict === 'pass').length}`);
line('Недействительных', (rs) => rs.filter((r) => r.verdict === 'invalid').length);
line('Средний счёт', (rs) => num(rs.reduce((s, r) => s + (r.score ?? 0), 0) / (rs.length || 1), 3));
line('Записали form.intent.json', (rs) => rs.filter((r) => r.wroteIntent).length);
line('Хоть одна успешная сборка', (rs) => rs.filter((r) => r.buildsOk > 0).length);
line('Закончили сами (completed)', (rs) => rs.filter((r) => r.exitReason === 'completed').length);
line(
  'Таймаут / предел шагов',
  (rs) =>
    `${rs.filter((r) => r.exitReason === 'timeout').length} / ${rs.filter((r) => r.exitReason === 'maxSteps').length}`
);
line('Шагов модели, медиана', (rs) => num(median(rs.map((r) => r.turns))));
line('Входных токенов, медиана', (rs) => k(median(rs.map((r) => r.inputTokens))));
line('Пик входа за шаг, медиана', (rs) => k(median(rs.map((r) => r.peak))));
line('Выходных токенов, медиана', (rs) => k(median(rs.map((r) => r.outputTokens))));
line('Время прогона, мин, медиана', (rs) => num(median(rs.map((r) => r.minutes)), 1));
line('Вызовов MCP, всего', (rs) => sum(rs, 'mcpCalls'));
line('Ошибок MCP, всего', (rs) => sum(rs, 'mcpErrors'));
line('Скриптов / с ошибкой', (rs) => `${sum(rs, 'scripts')} / ${sum(rs, 'scriptErrors')}`);
line('Вызовов внутри скриптов', (rs) => sum(rs, 'inner'));
line('Вызовов «текстом»', (rs) => sum(rs, 'textualCalls'));
line('Усечений стенда', (rs) => sum(rs, 'truncations'));

console.log(`\n## Не пройденные проверки\n`);
for (const row of rows.filter((r) => r.verdict !== 'pass')) {
  console.log(`- ${row.scenario} · ${row.approach}: ${row.failed.slice(0, 6).join(', ') || '—'}`);
}

if (options.sequence) {
  console.log(`\n## Последовательность вызовов MCP\n`);
  for (const batch of snapshot.batches) {
    console.log(`### ${batch}\n`);
    for (const { run, calls } of snapshot.sequences.filter((item) => item.batch === batch)) {
      console.log(`- ${run}: ${calls.join(' → ') || '—'}`);
    }
    console.log('');
  }
}
