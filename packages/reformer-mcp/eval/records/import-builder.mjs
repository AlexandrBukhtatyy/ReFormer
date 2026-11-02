#!/usr/bin/env node
/**
 * Импорт прогона ассистента конструктора (`.tmp/eval/form-scenarios-*.json`) в записи прогонов:
 * `npm run mcp:import-builder -- <файл> [--publish] [--reasoning off]`.
 *
 * Сам стенд живёт в тесте плагина и запускается на живой модели; здесь только перевод результата,
 * чтобы его итоги сравнивались теми же средствами, что и остальные стенды. Коммит в запись
 * ставится текущий, а не коммит прогона: `provenance: imported` об этом предупреждает.
 */

import path from 'node:path';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { collectSource, createRecord, newBatchId, repoRoot, writeRecords } from './record.mjs';

/** Записи из отчёта стенда. Чистая функция — проверяется тестом. */
export function builderRecords(report, { batchId, startedAt, source, reasoning = 'default' }) {
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
      approach: { id: `structured-${reasoning}` },
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
      ],
      usage: {
        inputTokens: result.inputTokens ?? null,
        outputTokens: result.outputTokens ?? null,
        reasoningTokens: result.reasoningTokens ?? null,
        costUsd: 0,
        toolCalls: result.tools?.length ?? 0,
        toolErrors: result.failedTools ?? 0,
      },
      toolSequence: (result.tools ?? []).join(' → ').slice(0, 800),
    })
  );
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const argv = process.argv.slice(2);
  const reasoningIndex = argv.indexOf('--reasoning');
  const reasoning = reasoningIndex >= 0 ? argv[reasoningIndex + 1] : 'default';
  const file = argv.find(
    (argument, index) => !argument.startsWith('--') && argv[index - 1] !== '--reasoning'
  );
  if (!file) {
    console.error(
      'Использование: npm run mcp:import-builder -- <form-scenarios-*.json> [--publish]'
    );
    process.exit(2);
  }
  const report = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  // Время прогона — из имени файла стенда, иначе тренды легли бы на дату импорта.
  const stamp = /(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/.exec(path.basename(file));
  const startedAt = stamp
    ? new Date(`${stamp[1]}T${stamp[2]}:${stamp[3]}:${stamp[4]}Z`)
    : new Date();
  const batchId = newBatchId(startedAt);
  const records = builderRecords(report, {
    batchId,
    startedAt,
    source: collectSource(),
    reasoning,
  });
  const { local, published } = writeRecords(records, {
    batchId,
    harness: 'builder',
    label: String(report.model).replace(/[^\w.-]+/g, '-'),
    publish: argv.includes('--publish'),
  });
  console.log(`${records.length} записей → ${path.relative(repoRoot, published ?? local)}`);
}
