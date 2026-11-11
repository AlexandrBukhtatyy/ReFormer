/**
 * Прогон стенда одним диалогом: `npm run mcp:log -- <прогон | батч> [--max N] [--print]`.
 *
 * Пишет `dialog.md` в каталог каждого прогона: задание, ход модели, вызовы с аргументами и ответами
 * сервера, длительность и ошибки вызовов, итог модели и проверки, которые не прошли
 * (`../lib/run-log.mjs`). Сырьё прогона при этом не меняется.
 *
 * Что принимает:
 * - путь к каталогу прогона или батча;
 * - id батча из `.tmp/mcp-runs` (`20261111T140202Z-340a`) либо `latest` — последний батч;
 * - id прогона из записи (`<батч>.<прогон>`).
 *
 * `--max N` — предел знаков на ответ и аргументы в диалоге (по умолчанию 4000, `0` — целиком);
 * `--print` — у одного прогона ещё и вывести диалог в консоль.
 *
 * @module reformer-mcp/eval/records/log
 */

import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { readRun, renderRun } from '../lib/run-log.mjs';
import { repoRoot } from './record.mjs';

const RUNS = path.join(repoRoot, '.tmp', 'mcp-runs');

const isDirectory = (dir) => existsSync(dir) && statSync(dir).isDirectory();
const isBatch = (dir) => existsSync(path.join(dir, 'records.jsonl'));
const isRun = (dir) =>
  ['server-trace.jsonl', 'prompt.md', 'transcript.jsonl'].some((file) =>
    existsSync(path.join(dir, file))
  );

/** Последний батч по времени изменения. */
function latestBatch() {
  if (!isDirectory(RUNS)) return null;
  const batches = readdirSync(RUNS)
    .map((name) => path.join(RUNS, name))
    .filter(isDirectory)
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return batches[0] ?? null;
}

/** Каталог по аргументу: путь, id батча, id прогона или `latest`. */
function resolveTarget(argument) {
  if (argument === undefined || argument === 'latest') return latestBatch();
  for (const candidate of [
    path.resolve(argument),
    path.join(repoRoot, argument),
    path.join(RUNS, argument),
  ]) {
    if (isDirectory(candidate)) return candidate;
  }
  // id прогона — `<батч>.<прогон>`: у батча точек нет, у прогона они есть.
  const dot = argument.indexOf('.');
  if (dot > 0) {
    const run = path.join(RUNS, argument.slice(0, dot), argument.slice(dot + 1));
    if (isDirectory(run)) return run;
  }
  return null;
}

function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { max: { type: 'string' }, print: { type: 'boolean', default: false } },
  });
  const target = resolveTarget(positionals[0]);
  if (target === null) {
    console.error(
      `Не нашёл прогон или батч «${positionals[0] ?? 'latest'}». Батчи лежат в ${path.relative(repoRoot, RUNS)}.`
    );
    process.exit(2);
  }
  const max = values.max === undefined ? 4000 : Number(values.max);
  const runs = isRun(target)
    ? [target]
    : readdirSync(target)
        .map((name) => path.join(target, name))
        .filter((dir) => isDirectory(dir) && isRun(dir));
  if (runs.length === 0) {
    const why = isBatch(target)
      ? 'в батче только записи: так пишет калибровка, сырья прогонов у неё нет'
      : 'в каталоге нет ни прогона, ни батча';
    console.error(`${path.relative(repoRoot, target)}: ${why}.`);
    process.exit(2);
  }

  for (const directory of runs) {
    const run = readRun(directory);
    const text = renderRun(run, { max });
    const file = path.join(directory, 'dialog.md');
    writeFileSync(file, text);
    const verdict = run.record?.verdict ?? '—';
    const score = run.record?.score ?? '—';
    console.log(
      `${String(verdict).padEnd(8)} ${String(score).padEnd(5)} ${path.relative(repoRoot, file)}`
    );
    if (values.print && runs.length === 1) console.log(`\n${text}`);
  }
}

main();
