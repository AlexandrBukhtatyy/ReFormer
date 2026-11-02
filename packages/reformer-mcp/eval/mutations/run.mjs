#!/usr/bin/env node
/**
 * Чувствительность приборов: `npm run mcp:mutate [-- --only id,id]`.
 *
 * Зелёный прибор что-то значит только тогда, когда он умеет краснеть. В истории стенда приборы не раз
 * молча врали (`docs/mcp-eval/README.md`, «Три раза прибор оказывался хрупким»). Здесь собранный сервер
 * намеренно ломается, и указанный прибор обязан упасть.
 *
 * Статусы: killed — прибор заметил; survived — не заметил; stale — якорь правки не найден, каталог
 * устарел. Выживший без пометки `documentedSurvivor` и stale дают код 1.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageDirectory, repoRoot } from '../records/record.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(path.join(here, 'catalog.json'), 'utf8'));
const workDirectory = path.join(repoRoot, '.tmp', 'mcp-mutants');
const argv = process.argv.slice(2);
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex >= 0 ? new Set(argv[onlyIndex + 1].split(',')) : null;

function prepareCopy(id) {
  const copy = path.join(workDirectory, id);
  rmSync(copy, { recursive: true, force: true });
  mkdirSync(copy, { recursive: true });
  for (const entry of ['dist', 'llms.txt', 'llms-index.json', 'docs/llms', 'package.json']) {
    const source = path.join(packageDirectory, entry);
    if (existsSync(source)) cpSync(source, path.join(copy, entry), { recursive: true });
  }
  return copy;
}

const calibrate = (track) => ({
  args: [
    'packages/reformer-mcp/eval/calibration/run.mjs',
    '--no-smoke',
    '--channel',
    'node',
    '--tracks',
    track,
    '--gate',
    '--out',
    path.join(workDirectory, `_calibration-${track}`),
  ],
});

/** Прибор: как запустить его против копии сервера. Падение — ненулевой код выхода. */
function instrument(name, serverPath) {
  if (name === 'retrieval') {
    return {
      args: ['packages/reformer-mcp/eval/runner.mjs', '--server', serverPath],
    };
  }
  if (name.startsWith('calibration:')) return calibrate(name.slice('calibration:'.length));
  if (name === 'golden') {
    return {
      args: [
        'packages/reformer-mcp/eval/verify/index.mjs',
        '--golden',
        '--server',
        serverPath,
        '--scenario',
        'L2-*,L3-*,L5-loan',
      ],
    };
  }
  if (name === 'golden-browser') {
    return {
      args: [
        'packages/reformer-mcp/eval/verify/index.mjs',
        '--golden',
        '--browser',
        '--server',
        serverPath,
        '--scenario',
        'L1-feedback',
      ],
    };
  }
  if (name.startsWith('unit:')) {
    return { unit: name.slice('unit:'.length) };
  }
  throw new Error(`Неизвестный прибор ${name}`);
}

/**
 * Юнит-тесты импортируют исходники, а не `dist`, поэтому здесь правка идёт в исходник на время
 * прогона. Единственный случай, когда мутант трогает `src`: исходник всегда возвращается обратно.
 */
function runUnit(mutant, testName) {
  const sourceFile = path.join(packageDirectory, 'src', mutant.file.replace(/\.js$/, '.ts'));
  const original = readFileSync(sourceFile, 'utf8');
  if (!original.includes(mutant.find)) return { status: 0, stale: true };
  try {
    writeFileSync(sourceFile, original.replace(mutant.find, mutant.replace));
    const result = spawnSync(
      process.execPath,
      ['../../scripts/run-vitest.mjs', `tests/${testName}.test.ts`],
      { cwd: packageDirectory, encoding: 'utf8', maxBuffer: 1 << 26 }
    );
    return { status: result.status };
  } finally {
    writeFileSync(sourceFile, original);
  }
}

const results = [];
for (const mutant of catalog.mutants) {
  if (only && !only.has(mutant.id)) continue;
  const copy = prepareCopy(mutant.id);
  const target = path.join(copy, 'dist', mutant.file);
  const source = readFileSync(target, 'utf8');
  if (!source.includes(mutant.find)) {
    console.log(`? ${mutant.id}: якорь не найден в ${mutant.file}`);
    results.push({ ...mutant, status: 'stale' });
    continue;
  }
  writeFileSync(target, source.replace(mutant.find, mutant.replace));
  const serverPath = path.join(copy, 'dist', 'index.js');
  const detectedBy = [];
  let stale = false;
  for (const name of mutant.expectRedIn) {
    const started = Date.now();
    const spec = instrument(name, serverPath);
    let status;
    if (spec.unit) {
      const unit = runUnit(mutant, spec.unit);
      stale ||= unit.stale === true;
      status = unit.status;
    } else {
      status = spawnSync(process.execPath, spec.args, {
        cwd: repoRoot,
        encoding: 'utf8',
        maxBuffer: 1 << 27,
        env: { ...process.env, REFORMER_MCP_SERVER: serverPath },
      }).status;
    }
    console.log(
      `  ${mutant.id} · ${name}: код ${status}, ${Math.round((Date.now() - started) / 1000)} с`
    );
    if (status !== 0) detectedBy.push(name);
  }
  const status = stale ? 'stale' : detectedBy.length > 0 ? 'killed' : 'survived';
  console.log(
    `${status === 'killed' ? '✓' : status === 'stale' ? '?' : '✗'} ${mutant.id}: ${status}`
  );
  results.push({ ...mutant, status, detectedBy });
  rmSync(copy, { recursive: true, force: true });
}

const unexpected = results.filter(
  (result) =>
    result.status === 'stale' || (result.status === 'survived' && !result.documentedSurvivor)
);
const lines = [
  '# Чувствительность приборов',
  '',
  '| мутант | итог | прибор |',
  '| --- | --- | --- |',
];
for (const result of results) {
  lines.push(
    `| ${result.id} | ${result.status}${result.documentedSurvivor ? ' (задокументировано)' : ''} | ${(result.detectedBy ?? result.expectRedIn).join(', ') || '—'} |`
  );
}
mkdirSync(workDirectory, { recursive: true });
writeFileSync(path.join(workDirectory, 'report.md'), `${lines.join('\n')}\n`);
console.log(`\n${lines.join('\n')}`);
process.exit(unexpected.length > 0 ? 1 : 0);
