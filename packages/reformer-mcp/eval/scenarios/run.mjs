#!/usr/bin/env node
/**
 * Раннер сценариев: агент выполняет задание через MCP-сервер, верификатор судит результат.
 *
 *   npm run mcp:scenarios -- --matrix smoke
 *   npm run mcp:scenarios -- --agent ollama --model qwen3.8:27b-32k --scenario 'L1-*,L3-*' --repeats 3
 *   npm run mcp:scenarios -- --agent claude-code --model sonnet --scenario L1-feedback --max-usd-batch 2
 *
 *   --matrix <имя|файл>    оси прогона из matrices/
 *   --agent                replay | ollama | claude-code
 *   --approach a,b         подходы из approaches.json (по умолчанию bare)
 *   --target t             только этот таргет сценария
 *   --repeats N            повторов на ячейку; один прогон с агентом ничего не доказывает
 *   --concurrency K        параллельных прогонов
 *   --max-usd-batch X      потолок оценочной стоимости батча: дальше прогоны не начинаются
 *   --server <dist>        другая сборка сервера, для A/B
 *   --include-holdout      вместе с holdout (в отчётах он только агрегатом)
 *   --browser              с браузерной стадией: снимок доступности, axe, скриншоты
 *   --publish              положить записи в packages/reformer-mcp/eval/runs/
 *
 * Рабочий каталог агента — вне репозитория: иначе агент увидел бы исходники пакетов, и замерялся бы
 * не сервер. Результат копируется внутрь репозитория только для проверки: там резолвятся `@reformer/*`.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
import {
  collectSource,
  createRecord,
  fingerprintServer,
  newBatchId,
  packageDirectory,
  repoRoot,
  runsDirectory,
  writeRecords,
} from '../records/record.mjs';
import { verifyInBrowser } from '../verify/browser.mjs';
import { summarize, verifyBundle } from '../verify/index.mjs';
import { loadScenarios, scenariosDirectory } from './catalog.mjs';

const argv = process.argv.slice(2);
const has = (name) => argv.includes(`--${name}`);
const flag = (name, fallback = null) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] && !argv[index + 1].startsWith('--')
    ? argv[index + 1]
    : fallback;
};

function readMatrix() {
  const name = flag('matrix');
  if (name) {
    const file = existsSync(name)
      ? name
      : path.join(scenariosDirectory, 'matrices', `${name}.json`);
    return JSON.parse(readFileSync(file, 'utf8'));
  }
  const kind = flag('agent');
  if (!kind) {
    console.error('Нужен --matrix или --agent. См. шапку eval/scenarios/run.mjs.');
    process.exit(2);
  }
  return { agents: [{ kind, model: flag('model') }] };
}

const matrix = readMatrix();
const serverPath = path.resolve(flag('server', path.join(packageDirectory, 'dist/index.js')));
const allApproaches = JSON.parse(
  readFileSync(path.join(scenariosDirectory, 'approaches.json'), 'utf8')
);
const approachIds = flag('approach')?.split(',') ?? matrix.approaches ?? ['bare'];
const repeats = Number(flag('repeats', matrix.repeats ?? 1));
const concurrency = Number(flag('concurrency', matrix.concurrency ?? 1));
const maxUsdBatch = Number(flag('max-usd-batch', matrix.maxUsdBatch ?? 5));
const withBrowser = has('browser');
const scenarios = loadScenarios({
  pattern: flag('scenario', matrix.scenarios ?? '*'),
  includeHoldout: has('include-holdout'),
}).filter((scenario) => existsSync(scenario.contractFile));
const convention = readFileSync(
  path.join(scenariosDirectory, '_shared/output-convention.md'),
  'utf8'
);
const TARGET_WORDS = {
  core: '`@reformer/core`, разметку пишешь сам в JSX',
  'renderer-react': '`@reformer/renderer-react`, разметку рисует `FormRenderer` по схеме на TS',
  'renderer-json': '`@reformer/renderer-json`, разметка — документ JSON-схемы и реестр компонентов',
};

if (!existsSync(serverPath)) {
  console.error(
    `Нет сборки сервера ${path.relative(repoRoot, serverPath)}: npm run build -w @reformer/mcp`
  );
  process.exit(1);
}
for (const id of approachIds) {
  if (!allApproaches[id]) {
    console.error(`Нет подхода «${id}» в approaches.json`);
    process.exit(2);
  }
}

const adapters = new Map();
for (const agent of matrix.agents) {
  const adapter = adapters.get(agent.kind) ?? (await import(`../agents/${agent.kind}.mjs`));
  adapters.set(agent.kind, adapter);
  const problem = await adapter.preflight?.(agent.model);
  if (problem) {
    console.error(`✗ ${agent.kind}: ${problem}`);
    process.exit(1);
  }
}

/** Текст задания: один и тот же для всех агентов подхода. */
async function buildPrompt({ scenario, target, approach, workspaceDirectory }) {
  const task = readFileSync(scenario.promptFile, 'utf8').trim();
  const rules = convention.replace('{{target}}', TARGET_WORDS[target] ?? target);
  if (approach.serverPrompt) {
    const client = new McpClient(serverPath, { cwd: workspaceDirectory });
    try {
      await client.initialize();
      const reply = await client.request('prompts/get', {
        name: approach.serverPrompt,
        arguments: { description: task, target },
      });
      const text = (reply.result?.messages ?? [])
        .map((message) => message.content?.text ?? '')
        .join('\n\n');
      return `${text}\n\n${rules}`;
    } finally {
      client.close();
    }
  }
  return `${approach.promptPrefix ?? ''}${task}\n\n${rules}`;
}

/** Метрики процесса — из журнала сервера: они одинаковы для любого агента. */
function processMetrics(traceFile, toolCalls) {
  const entries = existsSync(traceFile)
    ? readFileSync(traceFile, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  const digests = entries.map((entry) => `${entry.name}:${entry.argumentsDigest}`);
  const lastWrite = toolCalls.findLastIndex((call) => /^(write_file|Write|Edit)$/.test(call.name));
  const lastValidate = toolCalls.findLastIndex((call) =>
    ['validate_form', 'form_build'].includes(call.name)
  );
  const metrics = [
    { id: 'process.mcpCalls', value: entries.length, better: 'none' },
    {
      id: 'process.mcpErrors',
      value: entries.filter((entry) => entry.isError).length,
      better: 'lower',
    },
    {
      id: 'process.mcpResultChars',
      value: entries.reduce((sum, entry) => sum + entry.resultChars, 0),
      better: 'none',
    },
    { id: 'process.repeatedCalls', value: digests.length - new Set(digests).size, better: 'lower' },
    {
      id: 'process.validatedAfterLastWrite',
      value: lastValidate > lastWrite && lastWrite >= 0 ? 1 : 0,
      better: 'higher',
    },
  ];
  const toolSequence = toolCalls
    .map((call) => `${call.name}${call.ok ? '' : '✗'}`)
    .join(' → ')
    .slice(0, 800);
  return { metrics, toolSequence };
}

/** Серверы MCP без живого родителя: только Windows, где снятие дерева не гарантировано. */
function orphanServerProcesses() {
  if (process.platform !== 'win32') return [];
  const listing = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      "$all = Get-CimInstance Win32_Process; $ids = $all.ProcessId; $all | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*reformer-mcp*dist*index.js*' -and $ids -notcontains $_.ParentProcessId } | ForEach-Object { $_.ProcessId }",
    ],
    { encoding: 'utf8' }
  );
  return (listing.stdout ?? '').split(/\s+/).filter(Boolean);
}

const processesBefore = orphanServerProcesses();
const batchId = newBatchId();
const source = collectSource();
const server = await fingerprintServer(serverPath);
const batchDirectory = path.join(runsDirectory, batchId);
const workspaceRoot = path.join(tmpdir(), 'reformer-mcp-runs', batchId);
const verifyClient = new McpClient(serverPath);
await verifyClient.initialize();

const cells = [];
for (const scenario of scenarios) {
  if (scenario.reference === undefined && matrix.agents.some((agent) => agent.kind === 'replay'))
    continue;
  for (const target of flag('target') ? [flag('target')] : scenario.targets) {
    for (const agent of matrix.agents) {
      for (const approachId of approachIds) {
        for (let index = 1; index <= repeats; index++) {
          cells.push({ scenario, target, agent, approachId, index });
        }
      }
    }
  }
}
console.log(
  `Батч ${batchId}: прогонов ${cells.length}, сценариев ${scenarios.length}, параллельно ${concurrency}.`
);

const outcomes = [];
let spentUsd = 0;

async function runCell(cell) {
  const { scenario, target, agent, approachId, index } = cell;
  const approach = { id: approachId, ...allApproaches[approachId] };
  const slug = [scenario.id, target, approachId, agent.model ?? agent.kind, `r${index}`]
    .join('.')
    .replace(/[^\w.-]+/g, '-');
  const runDirectory = path.join(batchDirectory, slug);
  const workspaceDirectory = path.join(workspaceRoot, slug);
  mkdirSync(runDirectory, { recursive: true });
  mkdirSync(path.join(workspaceDirectory, 'form'), { recursive: true });
  cpSync(path.join(scenariosDirectory, '_shared/workspace'), workspaceDirectory, {
    recursive: true,
  });
  if (scenario.specFile) cpSync(scenario.specFile, path.join(workspaceDirectory, 'spec.md'));

  const startedAt = new Date();
  const contractText = readFileSync(scenario.contractFile, 'utf8');
  const base = {
    batchId,
    harness: 'scenario',
    startedAt: startedAt.toISOString(),
    source,
    server,
    agent: {
      kind: agent.kind,
      model: agent.model ?? null,
      auth: agent.kind === 'claude-code' ? 'oauth' : null,
      settings: agent.settings ?? {},
    },
    approach: { id: approachId },
    scenario: {
      id: scenario.id,
      level: scenario.level,
      target,
      split: scenario.split,
      contractDigest: createHash('sha256').update(contractText).digest('hex').slice(0, 16),
    },
    repeat: { index, of: repeats },
    artifacts: { runDir: path.relative(repoRoot, runDirectory).replaceAll('\\', '/') },
  };

  if (spentUsd >= maxUsdBatch) {
    console.log(`· ${slug}: бюджет батча исчерпан ($${spentUsd.toFixed(2)})`);
    outcomes.push({ record: createRecord({ ...base, verdict: 'invalid', exitReason: 'budget' }) });
    return;
  }

  const prompt = await buildPrompt({ scenario, target, approach, workspaceDirectory });
  writeFileSync(path.join(runDirectory, 'prompt.md'), prompt);
  const traceFile = path.join(runDirectory, 'server-trace.jsonl');
  const adapter = adapters.get(agent.kind);
  const result = await adapter.runAgent({
    scenario,
    target,
    workspaceDirectory,
    runDirectory,
    prompt,
    model: agent.model ?? null,
    approach,
    serverPath,
    traceFile,
    settings: agent.settings,
    limits: {
      maxUsd: 1.5,
      maxSteps: 30,
      ...scenario.budget,
      timeoutMs: (scenario.budget?.timeoutMs ?? 600_000) * (adapter.timeoutFactor ?? 1),
    },
  });
  spentUsd += result.costUsd ?? 0;
  writeFileSync(path.join(runDirectory, 'final.txt'), result.finalText ?? '');

  const { metrics, toolSequence } = processMetrics(traceFile, result.toolCalls);
  for (const [id, value] of Object.entries(result.harness ?? {})) {
    metrics.push({ id: `harness.${id}`, value, better: 'none' });
  }
  const shared = {
    ...base,
    durationMs: result.durationMs,
    exitReason: result.exitReason,
    usage: result.usage
      ? {
          ...result.usage,
          toolCalls: result.toolCalls.length,
          toolErrors: result.toolCalls.filter((call) => !call.ok).length,
        }
      : null,
    toolSequence,
    metrics,
  };

  // Сломался прибор, а не форма: такой прогон не должен входить в статистику.
  const instrumentFailure = !result.isolation.ok
    ? `изоляция: ${result.isolation.problems.join('; ')}`
    : result.exitReason === 'error' && agent.kind !== 'replay'
      ? `сбой канала агента: ${result.finalText}`
      : null;
  if (instrumentFailure) {
    console.log(`! ${slug}: недействительно — ${instrumentFailure.slice(0, 200)}`);
    outcomes.push({
      record: createRecord({
        ...shared,
        verdict: 'invalid',
        checks: { instrument: ['fail', instrumentFailure.slice(0, 200)] },
      }),
    });
    return;
  }

  const bundleDirectory = path.join(runDirectory, 'bundle');
  rmSync(bundleDirectory, { recursive: true, force: true });
  mkdirSync(bundleDirectory, { recursive: true });
  cpSync(path.join(workspaceDirectory, 'form'), bundleDirectory, { recursive: true });

  const verification = await verifyBundle({
    directory: bundleDirectory,
    contractFile: scenario.contractFile,
    target,
    client: verifyClient,
  });
  writeFileSync(path.join(runDirectory, 'verify.json'), JSON.stringify(verification, null, 2));
  console.log(
    `${verification.verdict === 'pass' ? '✓' : '✗'} ${slug}: счёт ${verification.score}, ${Math.round(result.durationMs / 1000)} с, вызовов MCP ${metrics[0].value}${verification.failedGates.length ? `; не прошло: ${verification.failedGates.join(', ')}` : ''}`
  );
  outcomes.push({
    slug,
    bundleDirectory,
    contractFile: scenario.contractFile,
    shared,
    checks: verification.checks,
  });
}

// Простой пул: Ollama держит одну модель, Claude — несколько параллельных прогонов.
const queue = [...cells];
await Promise.all(
  Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) await runCell(queue.shift());
  })
);
verifyClient.close();

if (withBrowser) {
  const mountable = outcomes.filter((outcome) => outcome.checks?.['workspace.entry'] === 'pass');
  if (mountable.length > 0) {
    console.log(`\nБраузерная стадия: форм ${mountable.length}`);
    const browser = verifyInBrowser(
      mountable.map((outcome) => ({
        slot: outcome.slug.replace(/[^\w-]+/g, '-'),
        directory: outcome.bundleDirectory,
        contractFile: outcome.contractFile,
      })),
      { batchId, workDirectory: path.join(batchDirectory, '_browser') }
    );
    for (const outcome of mountable) {
      Object.assign(outcome.checks, browser[outcome.slug.replace(/[^\w-]+/g, '-')]);
    }
  }
}

const records = outcomes.map((outcome) => {
  if (outcome.record) return outcome.record;
  const contract = JSON.parse(readFileSync(outcome.contractFile, 'utf8'));
  const { verdict, score, gates } = summarize(contract, outcome.checks);
  return createRecord({ ...outcome.shared, verdict, score, gates, checks: outcome.checks });
});

const { local, published } = writeRecords(records, {
  batchId,
  harness: 'scenario',
  label: flag('label', matrix.agents.map((agent) => agent.model ?? agent.kind).join('-')).replace(
    /[^\w.-]+/g,
    '-'
  ),
  publish: has('publish'),
});

// Строки по ходу батча — до браузерной стадии; итог считается здесь, он же уходит в запись.
if (withBrowser) {
  console.log('\nИтог с браузерной стадией:');
  for (const record of records) {
    const mark = { pass: '✓', fail: '✗', invalid: '!' }[record.verdict];
    console.log(`${mark} ${record.runId.split('.').slice(1).join('.')}: счёт ${record.score}`);
  }
}

const passed = records.filter((record) => record.verdict === 'pass').length;
const invalid = records.filter((record) => record.verdict === 'invalid').length;
console.log(
  `\nИтог: прошло ${passed}/${records.length - invalid}${invalid ? `, недействительно ${invalid}` : ''}. Оценка стоимости: $${spentUsd.toFixed(2)}.`
);
console.log(`Записи: ${path.relative(repoRoot, published ?? local)}`);

// На Windows снятый агент оставляет дочерние процессы. Сирота — сервер, чей родитель уже мёртв: сервер
// с живым родителем принадлежит кому-то другому, например соседнему батчу или открытой сессии.
const leaked = orphanServerProcesses().filter((pid) => !processesBefore.includes(pid));
if (leaked.length > 0)
  console.warn(`⚠ После батча остались процессы сервера MCP: ${leaked.join(', ')}`);

process.exit(
  records.some((record) => record.verdict === 'fail' && record.agent.kind === 'replay') ? 1 : 0
);
