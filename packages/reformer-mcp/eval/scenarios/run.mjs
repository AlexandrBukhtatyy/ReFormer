#!/usr/bin/env node
/**
 * Раннер сценариев: агент выполняет задание через MCP-сервер, верификатор судит результат.
 *
 *   npm run mcp:scenarios -- --matrix smoke
 *   npm run mcp:scenarios -- --matrix accept-7.0-ollama --model qwen3.5:4b
 *   npm run mcp:scenarios -- --agent ollama --model qwen3.8:27b --scenario 'registration-*' --repeats 3
 *   npm run mcp:scenarios -- --agent claude-code --model sonnet --scenario order-edit --max-usd-batch 2
 *
 *   --matrix <имя|файл>    оси прогона из matrices/
 *   --model m              с --matrix — только агенты этой модели (модель не помещается на машине)
 *   --agent                replay | ollama | claude-code
 *   --approach a,b         подходы из approaches.json (по умолчанию bare)
 *   --target t             каждый сценарий — на этом таргете вместо своих (renderer-json: формы
 *                          откроются в ui-builder, их схема — form.schema.json)
 *   --repeats N            повторов на ячейку; один прогон с агентом ничего не доказывает
 *   --concurrency K        параллельных прогонов
 *   --max-usd-batch X      потолок оценочной стоимости батча: дальше прогоны не начинаются
 *   --server <dist>        другая сборка сервера, для A/B
 *   --include-holdout      вместе с holdout (в отчётах он только агрегатом)
 *   --browser              с браузерной стадией: снимок доступности, axe, скриншоты
 *   --shared-ollama        начать батч, хотя на той же Ollama идёт другой: шаги обоих ждут друг
 *                          друга, их время не сравнимо с прочими батчами
 *
 * Ход ячейки — в stderr: строка на старт, у агента с пошаговым циклом (Ollama) — строка на шаг и
 * пульс, пока модель отвечает дольше минуты. Итог ячейки — в stdout.
 *
 * Сценарий правки (`seed`) начинается с готовой формы: до старта агента стенд собирает в `form/`
 * эталон сценария-затравки; его intent остаётся в `<прогон>/seed.intent.json`.
 *
 * Рабочий каталог агента — вне репозитория: иначе агент увидел бы исходники пакетов, и замерялся бы
 * не сервер. После прогона он копируется в каталог прогона: форма — в `bundle/` (там резолвятся
 * `@reformer/*`, там её и проверяют), остальное — в `workspace/`.
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
  recordsSummary,
  rejectPublishFlag,
  repoRoot,
  runsDirectory,
  writeRecords,
} from '../records/record.mjs';
import { verifyInBrowser } from '../verify/browser.mjs';
import { contractText, readContract } from '../verify/contract.mjs';
import { summarize, verifyBundle } from '../verify/index.mjs';
import { loadScenarios, scenariosDirectory, writeSeedBundle } from './catalog.mjs';

const argv = process.argv.slice(2);
rejectPublishFlag(argv);
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
    const matrix = JSON.parse(readFileSync(file, 'utf8'));
    // Модель матрицы, которая на этой машине не помещается, отсекается: остальные оси — как в матрице.
    const only = flag('model');
    if (!only) return matrix;
    const agents = matrix.agents.filter((agent) => agent.model === only);
    if (agents.length === 0) {
      const known = matrix.agents.map((agent) => agent.model).join(', ');
      console.error(`В матрице ${name} нет модели ${only}; есть: ${known}`);
      process.exit(2);
    }
    return { ...matrix, agents };
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
  includeHoldout: has('include-holdout') || matrix.includeHoldout === true,
}).filter((scenario) => existsSync(scenario.contractFile));
const convention = readFileSync(
  path.join(scenariosDirectory, '_shared/output-convention.md'),
  'utf8'
);
/** Откуда начинается работа: с пустого `form/` или с готовой формы, которую надо изменить. */
const FORM_WORDS = {
  fresh: 'Положи модуль формы в каталог `form/` текущего рабочего каталога.',
  seeded:
    'Форма, которую нужно изменить, уже лежит в каталоге `form/` текущего рабочего каталога: меняй её там, новую не создавай.',
};
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
  const problem = await adapter.preflight?.(agent.model, { sharedOllama: has('shared-ollama') });
  if (problem) {
    console.error(`✗ ${agent.kind}: ${problem}`);
    process.exit(1);
  }
}

/** Текст задания: один и тот же для всех агентов подхода. */
async function buildPrompt({ scenario, target, approach, workspaceDirectory }) {
  const task = readFileSync(scenario.promptFile, 'utf8').trim();
  const rules = convention
    .replace('{{target}}', TARGET_WORDS[target] ?? target)
    .replace('{{form}}', scenario.seedScenario ? FORM_WORDS.seeded : FORM_WORDS.fresh);
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

/** Каталоги рабочего каталога агента, которых нет в `workspace/` прогона. */
const NOT_SNAPSHOTTED = new Set(['form', 'node_modules']);

/**
 * Рабочий каталог агента — в `<прогон>/workspace/`: он лежит во временном каталоге системы, а в прогоне
 * должно остаться, с чем агент работал (`spec.md`, `package.json`) и что оставил вне `form/`. Сама
 * форма — в `bundle/`; снимок делается до проверки изоляции, поэтому есть и у недействительного прогона.
 */
function snapshotWorkspace(workspaceDirectory, runDirectory) {
  const target = path.join(runDirectory, 'workspace');
  rmSync(target, { recursive: true, force: true });
  cpSync(workspaceDirectory, target, {
    recursive: true,
    filter: (source) =>
      !NOT_SNAPSHOTTED.has(path.relative(workspaceDirectory, source).split(path.sep)[0]),
  });
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
// Предполётная проверка: сервер, который не видит пакеты, судил бы окружение, а не себя, — такой
// батч недействителен целиком (ReFormer-qo9b.34). `--allow-incomplete-knowledge` — для осознанного
// замера именно такого окружения.
if (!server.loaded.ready && !has('allow-incomplete-knowledge')) {
  console.error(
    `Батч не стартует: сервер ${serverPath} не видит пакеты @reformer/* ` +
      `(${server.loaded.source}): ${server.loaded.gaps.join('; ') || 'нет подробностей'}.\n` +
      'Соберите пакеты (llms-index.json) или запустите с --allow-incomplete-knowledge.'
  );
  process.exit(2);
}
const batchDirectory = path.join(runsDirectory, batchId);
const workspaceRoot = path.join(tmpdir(), 'reformer-mcp-runs', batchId);
const verifyClient = new McpClient(serverPath);
await verifyClient.initialize();

/**
 * Затравка правки: эталон сценария-затравки в `form/` рабочего каталога агента. Сервер пишет только
 * внутри своего проекта, поэтому клиент — с рабочим каталогом агента и корнем монорепо для пакетов
 * `@reformer/*`, как у агентов. Без трассы: сборка затравки не входит в метрики агента.
 */
async function seedWorkspace({ scenario, target, workspaceDirectory, runDirectory }) {
  const client = new McpClient(serverPath, {
    env: { REFORMER_TYPECHECK_ROOT: repoRoot },
    cwd: workspaceDirectory,
  });
  try {
    await client.initialize();
    await writeSeedBundle({
      scenario,
      target,
      directory: path.join(workspaceDirectory, 'form'),
      client,
    });
  } finally {
    client.close();
  }
  cpSync(
    path.join(workspaceDirectory, 'form', 'form.intent.json'),
    path.join(runDirectory, 'seed.intent.json')
  );
}

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
// Потраченные токены батча: вход — сумма по всем шагам (контекст каждого шага), выход — ответы модели.
const spentTokens = { input: 0, output: 0 };

/** Токены строкой: 15887 → «15.9k». */
function tokens(count) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
}

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
  const base = {
    batchId,
    harness: 'scenario',
    startedAt: startedAt.toISOString(),
    source,
    server,
    agent: {
      kind: agent.kind,
      model: agent.model ?? null,
      auth: adapters.get(agent.kind)?.authKind?.() ?? null,
      settings: agent.settings ?? {},
    },
    approach: { id: approachId },
    scenario: {
      id: scenario.id,
      level: scenario.level,
      target,
      split: scenario.split,
      ...(scenario.seed ? { seed: scenario.seed } : {}),
      ...(scenario.operation ? { operation: scenario.operation } : {}),
      contractDigest: createHash('sha256')
        .update(contractText(scenario.contractFile))
        .digest('hex')
        .slice(0, 16),
    },
    repeat: { index, of: repeats },
    artifacts: { runDir: path.relative(repoRoot, runDirectory).replaceAll('\\', '/') },
  };

  if (spentUsd >= maxUsdBatch) {
    console.log(`· ${slug}: бюджет батча исчерпан ($${spentUsd.toFixed(2)})`);
    outcomes.push({ record: createRecord({ ...base, verdict: 'invalid', exitReason: 'budget' }) });
    return;
  }

  if (scenario.seedScenario) {
    // Правка начинается с готовой формы. Не собралась затравка — сломан стенд, а не агент.
    try {
      await seedWorkspace({ scenario, target, workspaceDirectory, runDirectory });
    } catch (error) {
      const reason = `затравка ${scenario.seed}: ${error?.message ?? error}`.slice(0, 200);
      console.log(`! ${slug}: недействительно — ${reason}`);
      outcomes.push({
        record: createRecord({
          ...base,
          verdict: 'invalid',
          exitReason: 'error',
          checks: { instrument: ['fail', reason] },
        }),
      });
      return;
    }
  }

  const prompt = await buildPrompt({ scenario, target, approach, workspaceDirectory });
  writeFileSync(path.join(runDirectory, 'prompt.md'), prompt);
  const traceFile = path.join(runDirectory, 'server-trace.jsonl');
  const adapter = adapters.get(agent.kind);
  // Строка итога появится только в конце ячейки, а она идёт до получаса: без строки старта и строк
  // шагов живой прогон не отличить от зависшего (ReFormer-qo9b.41).
  const progress = (line) => process.stderr.write(`${line}\n`);
  progress(`→ ${startedAt.toTimeString().slice(0, 8)} · ${slug}`);
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
    onProgress: progress,
    limits: {
      maxUsd: 1.5,
      maxSteps: 30,
      ...scenario.budget,
      timeoutMs: (scenario.budget?.timeoutMs ?? 600_000) * (adapter.timeoutFactor ?? 1),
    },
  });
  spentUsd += result.costUsd ?? 0;
  spentTokens.input += result.usage?.inputTokens ?? 0;
  spentTokens.output += result.usage?.outputTokens ?? 0;
  writeFileSync(path.join(runDirectory, 'final.txt'), result.finalText ?? '');
  snapshotWorkspace(workspaceDirectory, runDirectory);

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
    reference: agent.kind === 'replay',
  });
  writeFileSync(path.join(runDirectory, 'verify.json'), JSON.stringify(verification, null, 2));
  console.log(
    `${verification.verdict === 'pass' ? '✓' : '✗'} ${slug}: счёт ${verification.score}, ${Math.round(result.durationMs / 1000)} с, вызовов MCP ${metrics[0].value}, токенов ${tokens(result.usage?.inputTokens ?? 0)} вход / ${tokens(result.usage?.outputTokens ?? 0)} выход${verification.failedGates.length ? `; не прошло: ${verification.failedGates.join(', ')}` : ''}`
  );
  outcomes.push({
    slug,
    bundleDirectory,
    contractFile: scenario.contractFile,
    // Эталон на core рисуется схемой без слоя рендера: видимость ему проверять нечем.
    renderLayer: !(target === 'core' && agent.kind === 'replay'),
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
        renderLayer: outcome.renderLayer,
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
  const { verdict, score, gates } = summarize(readContract(outcome.contractFile), outcome.checks);
  return createRecord({ ...outcome.shared, verdict, score, gates, checks: outcome.checks });
});

const { local } = writeRecords(records, { batchId });

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
  `\nИтог: прошло ${passed}/${records.length - invalid}${invalid ? `, недействительно ${invalid}` : ''}. Токенов: ${tokens(spentTokens.input)} вход / ${tokens(spentTokens.output)} выход. Оценка стоимости: $${spentUsd.toFixed(2)}.`
);
console.log(recordsSummary(local, batchId));

// На Windows снятый агент оставляет дочерние процессы. Сирота — сервер, чей родитель уже мёртв: сервер
// с живым родителем принадлежит кому-то другому, например соседнему батчу или открытой сессии.
const leaked = orphanServerProcesses().filter((pid) => !processesBefore.includes(pid));
if (leaked.length > 0)
  console.warn(`⚠ После батча остались процессы сервера MCP: ${leaked.join(', ')}`);

process.exit(
  records.some((record) => record.verdict === 'fail' && record.agent.kind === 'replay') ? 1 : 0
);
