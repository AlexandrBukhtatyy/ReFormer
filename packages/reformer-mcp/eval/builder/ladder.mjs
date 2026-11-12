#!/usr/bin/env node
/**
 * Лестница сценариев MCP в ассистенте конструктора — одной командой (фаза 7 аудита, ReFormer-11oe.8):
 *
 *   npm run mcp:builder-ladder -- [--matrix builder-smoke] [--model <модель>] [--scenario 'L1-*']
 *                                 [--repeats 3] [--publish]
 *
 * Цепочка на каждого агента матрицы: ход ассистента (`assistant-ladder.test.ts` плагина — мост, стек
 * форм, `build_form`, кодоген) → модули в `.tmp/eval/builder/<батч>/<агент>/` → верификатор MCP теми
 * же контрактами, что формы терминала (`verify --ladder`) → записи прогонов (`ladderRecords`). Агент
 * без модели проходит эталоны сценариев; живая модель — `model` в матрице или `--model`, канал —
 * переменные `EVAL_KIND`, `EVAL_BASE_URL`, `EVAL_API_KEY`, `EVAL_REASONING` теста лестницы.
 *
 * Записи сравниваются с терминалом: `npm run mcp:compare -- <батч терминала> <батч ассистента>`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
import { ladderRecords } from '../records/import-builder.mjs';
import {
  collectSource,
  newBatchId,
  packageDirectory,
  repoRoot,
  writeRecords,
} from '../records/record.mjs';
import { runLadder } from '../verify/index.mjs';

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const flag = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
    ? argv[index + 1]
    : fallback;
};

const matrixName = flag('matrix', 'builder-smoke');
const matrixFile = path.join(packageDirectory, 'eval/scenarios/matrices', `${matrixName}.json`);
if (!existsSync(matrixFile)) {
  console.error(`✗ матрицы ${matrixName} нет: ${path.relative(repoRoot, matrixFile)}`);
  process.exit(2);
}
const matrix = JSON.parse(readFileSync(matrixFile, 'utf8'));
const model = flag('model');
const agents = model ? [{ model }] : matrix.agents;
const pattern = flag('scenario', matrix.scenarios ?? '*');
const repeats = Number(flag('repeats', matrix.repeats ?? 1));

const integration = path.join(
  repoRoot,
  'projects/reformer-builder-playground/.ui_builder/plugins/reformer/integration'
);
const startedAt = new Date();
const batchId = newBatchId(startedAt);
const client = new McpClient(path.join(packageDirectory, 'dist/index.js'));
await client.initialize();

let failed = 0;
try {
  for (const agent of agents) {
    const label = agent.model ?? 'replay';
    const out = path.join(repoRoot, '.tmp/eval/builder', batchId, label.replace(/[^\w.-]+/g, '-'));
    mkdirSync(out, { recursive: true });
    console.log(`→ ассистент · ${label} · ${pattern} · ×${agent.model ? repeats : 1}`);
    const run = spawnSync('npx', ['vitest', 'run', 'assistant-ladder.test.ts'], {
      cwd: integration,
      stdio: 'inherit',
      env: {
        ...process.env,
        EVAL_LADDER_OUT: out,
        EVAL_LADDER: pattern === '*' ? '' : pattern,
        EVAL_REPEATS: String(repeats),
        ...(agent.model ? { EVAL_MODEL: agent.model } : {}),
      },
    });
    // Без модели падение теста — эталон не собрался: это провал, но отчёт лестницы всё равно есть.
    if (!existsSync(path.join(out, 'ladder.json'))) {
      console.error(`✗ ${label}: тест лестницы не дал ladder.json (код ${run.status})`);
      failed += 1;
      continue;
    }
    failed += await runLadder(client, out);
    const report = JSON.parse(readFileSync(path.join(out, 'verify.json'), 'utf8'));
    const records = ladderRecords(report, { batchId, startedAt, source: collectSource() });
    const { local, published } = writeRecords(records, {
      batchId,
      harness: 'builder',
      label,
      publish: has('publish'),
    });
    console.log(`  ${records.length} записей → ${path.relative(repoRoot, published ?? local)}`);
  }
} finally {
  client.close();
}
process.exitCode = failed > 0 ? 1 : 0;
