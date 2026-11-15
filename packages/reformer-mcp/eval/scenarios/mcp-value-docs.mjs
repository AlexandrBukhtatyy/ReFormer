#!/usr/bin/env node
/**
 * Данные страницы документации «Замеры: с MCP и без» из снимка отчёта подходов.
 *
 *   node packages/reformer-mcp/eval/scenarios/mcp-value-docs.mjs \
 *     packages/reformer-mcp/eval/runs/approaches/mcp-value-sonnet.json \
 *     projects/reformer-doc/src/data/mcp-benchmark.json
 *
 * Снимок — `npm run mcp:approaches -- <батч> --save <файл>`: по строке на прогон. Здесь прогоны
 * сводятся по плечам (подходам), видам задач и сценариям; повторы ячейки — k/n и медианы.
 * Страница только рисует этот файл: цифры не вычисляются в браузере.
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { scenariosDirectory } from './catalog.mjs';

const [snapshotFile, outputFile] = process.argv.slice(2);
if (!snapshotFile || !outputFile) {
  console.error('Использование: mcp-value-docs.mjs <снимок.json> <data.json>');
  process.exit(2);
}

/** Плечи сравнения в порядке страницы: нулевая точка, затем MCP. */
const ARMS = ['no-mcp', 'mcp-default', 'mcp-dsl'];
const OPERATIONS = ['create', 'edit', 'delete'];

const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8'));
const rows = snapshot.rows.filter((row) => ARMS.includes(row.approach));
if (rows.length === 0) {
  console.error(`В снимке нет прогонов подходов ${ARMS.join(', ')}`);
  process.exit(2);
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const sum = (values) => values.reduce((total, value) => total + value, 0);
const round = (value, digits) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
/** Правка и разбиение мастера на шаги — оба меняют готовую форму. */
const kindOf = (row) => (row.operation === 'split' ? 'edit' : row.operation);

/** Сводка набора прогонов одного плеча. */
function summarize(runs) {
  const passes = runs.filter((row) => row.verdict === 'pass').length;
  const cost = sum(runs.map((row) => row.cost));
  return {
    runs: runs.length,
    passes,
    score: round(sum(runs.map((row) => row.score ?? 0)) / (runs.length || 1), 3),
    minutesTotal: round(sum(runs.map((row) => row.minutes)), 1),
    minutesMedian: round(median(runs.map((row) => row.minutes)), 2),
    costTotal: round(cost, 2),
    costMedian: round(median(runs.map((row) => row.cost)), 3),
    costPerPass: passes ? round(cost / passes, 3) : null,
    turnsMedian: median(runs.map((row) => row.turns)),
    outputMedian: Math.round(median(runs.map((row) => row.outputTokens)) ?? 0),
    inputMedian: Math.round(median(runs.map((row) => row.inputAll)) ?? 0),
    mcpCalls: sum(runs.map((row) => row.mcpCalls)),
  };
}

/** Метаданные сценариев стенда: заголовок, уровень, вид задачи, теги. */
function scenarioMeta() {
  const meta = new Map();
  for (const family of readdirSync(scenariosDirectory, { withFileTypes: true })) {
    if (!family.isDirectory() || family.name.startsWith('_')) continue;
    const familyDir = path.join(scenariosDirectory, family.name);
    for (const entry of readdirSync(familyDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        const scenario = JSON.parse(
          readFileSync(path.join(familyDir, entry.name, 'scenario.json'), 'utf8')
        );
        meta.set(scenario.id, scenario);
      } catch {
        // каталог без scenario.json — не сценарий
      }
    }
  }
  return meta;
}

const meta = scenarioMeta();
const targets = [...new Set(rows.map((row) => row.target))].sort();
const scenarioIds = [...new Set(rows.map((row) => row.scenario))].sort(
  (a, b) => (meta.get(a)?.level ?? 0) - (meta.get(b)?.level ?? 0) || a.localeCompare(b)
);

const byArm = (arm, filter = () => true) =>
  rows.filter((row) => row.approach === arm && filter(row));

/** Частые причины провала создания по плечу: проверки и число прогонов с ними. */
function createFailures(arm) {
  const counts = new Map();
  for (const row of byArm(arm, (r) => kindOf(r) === 'create' && r.verdict !== 'pass')) {
    for (const check of row.failed) counts.set(check, (counts.get(check) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([check, runs]) => ({ check, runs }));
}

const batchIds = snapshot.batches ?? [];
const stamp = /^(\d{4})(\d{2})(\d{2})T/.exec(batchIds[0] ?? '');

const data = {
  batches: batchIds,
  date: stamp ? `${stamp[1]}-${stamp[2]}-${stamp[3]}` : null,
  model: 'sonnet',
  repeats: Math.max(...rows.map((row) => row.repeat ?? 1)),
  targets,
  arms: ARMS,
  summary: Object.fromEntries(
    ARMS.map((arm) => [
      arm,
      {
        ...summarize(byArm(arm)),
        operations: Object.fromEntries(
          OPERATIONS.map((kind) => {
            const runs = byArm(arm, (row) => kindOf(row) === kind);
            return [
              kind,
              {
                runs: runs.length,
                passes: runs.filter((row) => row.verdict === 'pass').length,
                minutesMedian: round(median(runs.map((row) => row.minutes)), 2),
                costTotal: round(sum(runs.map((row) => row.cost)), 2),
              },
            ];
          })
        ),
        createFailures: createFailures(arm),
      },
    ])
  ),
  scenarios: scenarioIds.map((id) => {
    const scenario = meta.get(id) ?? {};
    return {
      id,
      title: scenario.title ?? id,
      level: scenario.level ?? null,
      operation: scenario.operation ?? null,
      tags: scenario.tags ?? [],
      arms: Object.fromEntries(
        ARMS.map((arm) => {
          const runs = byArm(arm, (row) => row.scenario === id);
          return [
            arm,
            {
              ...summarize(runs),
              targets: Object.fromEntries(
                targets.map((target) => {
                  const cell = runs.filter((row) => row.target === target);
                  return [
                    target,
                    {
                      runs: cell.length,
                      passes: cell.filter((row) => row.verdict === 'pass').length,
                    },
                  ];
                })
              ),
            },
          ];
        })
      ),
    };
  }),
};

mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(data, null, 2)}\n`);
console.error(
  `${outputFile}: ${rows.length} прогонов, ${data.scenarios.length} сценариев, плечи ${ARMS.join(', ')}`
);
