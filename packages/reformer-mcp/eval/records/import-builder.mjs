#!/usr/bin/env node
/**
 * Импорт прогона ассистента конструктора (`.tmp/eval/form-scenarios-*.json`) в записи прогонов:
 * `npm run mcp:import-builder -- <файл> [--reasoning off] [--price-in 3 --price-out 15]`.
 * Прогон лестницы сценариев MCP — его `verify.json` (`mcp:verify -- --ladder <каталог>`): записи с
 * проверками верификатора, сравнимые с терминалом (`ladderRecords`).
 *
 * Подход — `structured-<рассуждение>`, с `build_form` в наборе — `structured-<рассуждение>-build-form`
 * (флаг стенда `EVAL_BUILD_FORM`, план mcp-misty-graham, этап 2): без этого `mcp:compare` сложил бы
 * базу и эксперимент в одну ячейку. Цена — по тарифу за миллион токенов, если он передан: у локальной
 * модели её нет, и ноль там честнее выдуманной.
 *
 * Сам стенд живёт в тесте плагина и запускается на живой модели; здесь только перевод результата,
 * чтобы его итоги сравнивались теми же средствами, что и остальные стенды. Коммит в запись
 * ставится текущий, а не коммит прогона: `provenance: imported` об этом предупреждает.
 */

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  collectSource,
  createRecord,
  newBatchId,
  recordsSummary,
  rejectPublishFlag,
  writeRecords,
} from './record.mjs';

/** Записи из отчёта стенда. Чистая функция — проверяется тестом. */
export function builderRecords(
  report,
  { batchId, startedAt, source, reasoning = 'default', price = null }
) {
  const approach = `structured-${reasoning}${report.buildForm ? '-build-form' : ''}`;
  const costOf = (result) =>
    price === null
      ? 0
      : ((result.inputTokens ?? 0) * price.input + (result.outputTokens ?? 0) * price.output) / 1e6;
  return report.results.map((result) =>
    createRecord({
      batchId,
      harness: 'builder',
      startedAt: startedAt.toISOString(),
      durationMs: (result.seconds ?? 0) * 1000,
      source: { ...source, provenance: 'imported' },
      server: { channel: 'worker' },
      agent: {
        kind: 'builder-bridge',
        model: report.model,
        auth: null,
        settings: { reasoning },
      },
      approach: { id: approach },
      scenario: { id: result.id },
      verdict: result.pass ? 'pass' : 'fail',
      exitReason: result.timedOut ? 'timeout' : result.error ? 'error' : 'completed',
      gates: ['scenario.check'],
      checks: {
        'scenario.check': result.pass
          ? 'pass'
          : ['fail', String(result.reason ?? '').slice(0, 200)],
      },
      metrics: [
        { id: 'process.toolCalls', value: result.tools?.length ?? 0, better: 'none' },
        { id: 'process.failedTools', value: result.failedTools ?? 0, better: 'none' },
        ...(result.requests === undefined
          ? []
          : [{ id: 'process.requests', value: result.requests, better: 'lower' }]),
        ...(result.createdForms === undefined
          ? []
          : [{ id: 'process.createdForms', value: result.createdForms, better: 'none' }]),
        // Лишние поля и поля образца грамматики — у сценариев, где заказ известен
        // (ReFormer-9a9c): «поле есть» засчитывало форму с переписанным образцом.
        ...(typeof result.extraCount === 'number'
          ? [
              { id: 'quality.extraFields', value: result.extraCount, better: 'lower' },
              {
                id: 'quality.leakedExample',
                value: result.leakedExample?.length ?? 0,
                better: 'lower',
              },
            ]
          : []),
        // Покрытие сценариев крупной сборки: вердикт «прошёл / нет» на них грубый.
        ...(result.coverage
          ? [
              {
                id: 'quality.fields',
                hit: result.coverage.fields[0],
                total: result.coverage.fields[1],
                better: 'higher',
              },
              {
                id: 'quality.rules',
                hit: result.coverage.rules[0],
                total: result.coverage.rules[1],
                better: 'higher',
              },
            ]
          : []),
      ],
      usage: {
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        reasoningTokens: result.reasoningTokens ?? null,
        costUsd: costOf(result),
        toolCalls: result.tools?.length ?? 0,
        toolErrors: result.failedTools ?? 0,
      },
      toolSequence: (result.tools ?? []).join(' → ').slice(0, 800),
    })
  );
}

/**
 * Записи из прогона лестницы в ассистенте (`mcp:verify -- --ladder <каталог>` → `verify.json`):
 * вердикт, гейты и проверки — верификатора MCP, теми же контрактами, что у терминала. Поэтому запись
 * — ячейка того же сценария и подхода `bare` (задание словами пользователя), а канал различает
 * агент: `builder-replay` (эталон без модели) или `builder-bridge` (живая модель).
 */
export function ladderRecords(report, { batchId, startedAt, source, reasoning = 'default' }) {
  const replay = report.agent === 'replay';
  const repeats = new Map();
  for (const result of report.results) {
    repeats.set(result.id, Math.max(repeats.get(result.id) ?? 0, result.repeat ?? 1));
  }
  return report.results.map((result) =>
    createRecord({
      batchId,
      harness: 'builder',
      startedAt: startedAt.toISOString(),
      durationMs: (result.seconds ?? 0) * 1000,
      source: { ...source, provenance: 'imported' },
      server: { channel: 'worker' },
      agent: {
        kind: replay ? 'builder-replay' : 'builder-bridge',
        model: report.model ?? null,
        auth: null,
        settings: replay ? {} : { reasoning },
      },
      approach: { id: 'bare' },
      scenario: { id: result.id, level: result.level, target: 'renderer-json' },
      repeat: { index: result.repeat ?? 1, of: repeats.get(result.id) },
      verdict: result.verdict,
      score: result.score,
      exitReason: result.built ? 'completed' : 'error',
      gates: result.gates,
      checks: result.checks,
      metrics: [
        { id: 'process.toolCalls', value: result.tools?.length ?? 0, better: 'none' },
        {
          id: 'process.buildFormCalls',
          value: (result.tools ?? []).filter((name) => name === 'build_form').length,
          better: 'lower',
        },
      ],
      toolSequence: (result.tools ?? []).join(' → ').slice(0, 800),
    })
  );
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  rejectPublishFlag();
  const argv = process.argv.slice(2);
  const valueOf = (flag) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined);
  const reasoning = valueOf('--reasoning') ?? 'default';
  const priceIn = valueOf('--price-in');
  const priceOut = valueOf('--price-out');
  const price =
    priceIn === undefined && priceOut === undefined
      ? null
      : { input: Number(priceIn ?? 0), output: Number(priceOut ?? 0) };
  const valued = new Set(['--reasoning', '--price-in', '--price-out']);
  const file = argv.find(
    (argument, index) => !argument.startsWith('--') && !valued.has(argv[index - 1])
  );
  if (!file) {
    console.error('Использование: npm run mcp:import-builder -- <form-scenarios-*.json>');
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  // Отчёт верификатора лестницы (`verify.json`) — свой перевод: проверки верификатора, а не стенда.
  const fromLadder = path.basename(file) === 'verify.json';
  // Время прогона — из имени файла стенда, иначе тренды легли бы на дату импорта.
  const stamp = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(path.basename(file));
  const startedAt = stamp
    ? new Date(`${stamp[1]}T${stamp[2]}:${stamp[3]}:${stamp[4]}Z`)
    : new Date();
  const batchId = newBatchId(startedAt);
  const records = (fromLadder ? ladderRecords : builderRecords)(report, {
    batchId,
    startedAt,
    source: collectSource(),
    reasoning,
    price,
  });
  const { local } = writeRecords(records, { batchId });
  console.log(`${records.length} записей. ${recordsSummary(local, batchId)}`);
}
