#!/usr/bin/env node
/**
 * Верификатор формы: соответствует ли модуль формы контракту сценария.
 *
 *   npm run mcp:verify -- --dir <каталог> --contract <файл> [--target core]
 *   npm run mcp:verify -- --dir <каталог> --contract <файл> --module builder   модуль конструктора
 *   npm run mcp:verify -- --ladder <каталог>   прогон лестницы в ассистенте: <каталог>/ladder.json и
 *                                               модуль на сценарий; итог — <каталог>/verify.json
 *   npm run mcp:verify -- --golden [--scenario 'order-*'] эталон каждого сценария обязан пройти
 *   npm run mcp:verify -- --negative                     заведомо сломанные формы обязаны упасть
 *   npm run mcp:verify -- --reverify <батч>[,<батч>]     новая оценка сохранённых форм без модели
 *
 * Эталон доказывает, что контракт выполним; негативные фикстуры — что верификатор способен увидеть
 * ошибку. Без этого красный и зелёный вердикт верификатора ничего не значат.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { typecheckFiles } from '../lib/typecheck.mjs';
import { McpClient } from '../lib/client.mjs';
import { parseValidate } from '../calibration/tracks.mjs';
import {
  checkStatus,
  packageDirectory,
  readRecords,
  repoRoot,
  rewriteRecords,
  runsDirectory,
} from '../records/record.mjs';
import { loadScenarios, writeReferenceBundle, writeSeedBundle } from '../scenarios/catalog.mjs';
import { verifyInBrowser } from './browser.mjs';
import { contractText, readContract } from './contract.mjs';
import { stackProblem } from './stack.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const RUNTIME_TIMEOUT_MS = 60_000;
const SOURCE_FILE = /\.tsx?$/;

function listFiles(directory, prefix = '') {
  return readdirSync(directory).flatMap((name) => {
    const full = path.join(directory, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    return statSync(full).isDirectory() ? listFiles(full, relative) : [relative];
  });
}

/** Точка входа модуля конструктора: запись реестра форм (`FormEntry`), а не компонент. */
const BUILDER_ENTRY = 'application/entry.ts';

/**
 * Стадия static: точка входа, стек, раскладка, типы, проверка кода сервером.
 *
 * @param {object} options
 * @param {boolean} [options.reference] - эталон: на `core` он рисуется `FormRenderer` только ради
 *   браузерной стадии (`drawCoreForm`), поэтому стек у него на этом таргете не проверяется.
 * @param {'mcp'|'builder'} [options.module] - чей модуль: `builder` — кодоген конструктора, папки
 *   ролей и запись реестра форм; канон раскладки MCP (`kind=layout`) к нему не применяется, стек —
 *   всегда renderer-json.
 */
export async function verifyStatic({
  directory,
  target,
  client,
  reference = false,
  module = 'mcp',
}) {
  const builder = module === 'builder';
  const checks = {};
  const files = existsSync(directory) ? listFiles(directory) : [];
  const entryFile = builder ? BUILDER_ENTRY : 'index.tsx';
  const entry = path.join(directory, entryFile);
  const exportsEntry =
    existsSync(entry) &&
    (builder
      ? /export\s+const\s+\w+\s*:\s*FormEntry\b/
      : /export\s+(default\s+)?(function|const|class)\s+\w*|export\s+default\s+\w+/
    ).test(readFileSync(entry, 'utf8'));
  checks['workspace.entry'] = exportsEntry
    ? 'pass'
    : [
        'fail',
        files.length
          ? `${entryFile} не экспортирует ${builder ? 'запись FormEntry' : 'компонент'}`
          : 'каталог результата пуст',
      ];

  const sources = files.filter((file) => SOURCE_FILE.test(file));
  if (sources.length === 0) {
    checks['static.tsc'] = ['fail', 'нет исходников'];
    return checks;
  }

  if (!(reference && target === 'core')) {
    const problem = stackProblem(
      builder ? 'renderer-json' : target,
      sources.map((file) => readFileSync(path.join(directory, file), 'utf8'))
    );
    checks['static.stack'] = problem ? ['fail', problem] : 'pass';
  }

  const diagnostics = typecheckFiles(
    directory,
    sources.map((file) => path.join(directory, file))
  );
  checks['static.tsc'] = diagnostics.length
    ? [
        'fail',
        `${diagnostics.length} ошибок; ${diagnostics[0].file}:${diagnostics[0].line} ${diagnostics[0].message}`.slice(
          0,
          200
        ),
      ]
    : 'pass';

  // Канон раскладки — модуля MCP; у конструктора своя раскладка по папкам ролей.
  if (!builder) {
    const layout = parseValidate(
      (await client.callTool('validate_form', { kind: 'layout', files, target })).text
    );
    checks['workspace.layout'] = layout.errors
      ? ['fail', `${layout.errors} ошибок: ${layout.codes.join(', ')}`.slice(0, 200)]
      : 'pass';
  }

  let codeErrors = 0;
  const codes = new Set();
  for (const file of sources) {
    const code = readFileSync(path.join(directory, file), 'utf8');
    const report = parseValidate(
      (await client.callTool('validate_form', { kind: 'code', code })).text
    );
    codeErrors += report.errors ?? 0;
    for (const item of report.codes) codes.add(item.split(' ')[0]);
  }
  checks['static.validateCode'] = codeErrors
    ? ['fail', `${codeErrors}: ${[...codes].join(', ')}`.slice(0, 200)]
    : 'pass';
  return checks;
}

/** Стадия headless: отдельным процессом, с таймаутом. */
export function verifyRuntime({ directory, contractFile }) {
  const require = createRequire(path.join(packageDirectory, 'package.json'));
  const loader = pathToFileURL(require.resolve('tsx')).href;
  const result = spawnSync(
    process.execPath,
    ['--import', loader, path.join(here, 'runtime-child.mjs'), directory, contractFile],
    { encoding: 'utf8', timeout: RUNTIME_TIMEOUT_MS, cwd: repoRoot, maxBuffer: 1 << 26 }
  );
  if (result.error?.code === 'ETIMEDOUT') {
    return {
      checks: { 'runtime.load': ['fail', `зависание дольше ${RUNTIME_TIMEOUT_MS / 1000} с`] },
    };
  }
  const line = (result.stdout ?? '').trim().split('\n').at(-1);
  try {
    return JSON.parse(line);
  } catch {
    const reason =
      (result.stderr ?? '').trim().split('\n').slice(-3).join(' ') || `код ${result.status}`;
    return { checks: { 'runtime.load': ['fail', `процесс упал: ${reason}`.slice(0, 200)] } };
  }
}

/** Гейты: без чего форма не считается сделанной. Остальные проверки влияют только на счёт. */
export function gatesFor(contract, checks) {
  const gates = ['workspace.entry', 'static.tsc', 'runtime.load', 'runtime.structure.fields'];
  // Шаги мастера и удалённые поля — суть сценариев мастера и удаления: без них задание не сделано.
  if (contract.steps?.length) gates.push('runtime.structure.steps');
  if (contract.absent?.length) gates.push('runtime.structure.absent');
  for (const probe of contract.probes ?? []) {
    if (probe.gate && probe.where !== 'browser') gates.push(`runtime.probe.${probe.id}`);
  }
  // Пропущенная проверка не гейт: контракт мог не задавать снимок доступности, у эталона на core
  // стек не проверяется.
  for (const id of [
    'static.stack',
    'browser.render',
    'browser.aria',
    'browser.axe',
    'browser.absent',
    'browser.buttons',
  ]) {
    if (checks[id] !== undefined && checkStatus(checks[id]) !== 'skip') gates.push(id);
  }
  return gates;
}

/** Итог по проверкам: вердикт, счёт и упавшие гейты. */
export function summarize(contract, checks) {
  const gates = gatesFor(contract, checks);
  const counted = Object.values(checks).filter((check) => checkStatus(check) !== 'skip');
  const passed = counted.filter((check) => checkStatus(check) === 'pass').length;
  const failedGates = gates.filter((gate) => checkStatus(checks[gate]) !== 'pass');
  return {
    verdict: failedGates.length ? 'fail' : 'pass',
    score: counted.length ? +(passed / counted.length).toFixed(3) : 0,
    gates,
    failedGates,
  };
}

/** Полная проверка каталога: static + headless. */
export async function verifyBundle({ directory, contractFile, target, client, reference, module }) {
  const contract = readContract(contractFile);
  const checks = await verifyStatic({ directory, target, client, reference, module });
  const runtime = verifyRuntime({ directory, contractFile });
  Object.assign(checks, runtime.checks);
  return { checks, bound: runtime.bound ?? null, ...summarize(contract, checks) };
}

function printResult(title, result) {
  console.log(`${result.verdict === 'pass' ? '✓' : '✗'} ${title} — ${result.score}`);
  for (const [id, check] of Object.entries(result.checks)) {
    if (checkStatus(check) === 'pass') continue;
    console.log(`    ${id}: ${Array.isArray(check) ? check.join(' — ') : check}`);
  }
}

async function runGolden(client, pattern, workDirectory, withBrowser) {
  let failed = 0;
  const mounted = [];
  for (const scenario of loadScenarios({ pattern, includeHoldout: true })) {
    if (!scenario.reference) {
      console.log(`· ${scenario.id}: эталона нет (пишет пользователь или ещё не готов)`);
      continue;
    }
    for (const target of scenario.targets) {
      const directory = path.join(workDirectory, `${scenario.id}-${target}`);
      // Правка — поверх затравки, как у агента: эталон проверяет и пересборку готовой формы.
      await writeSeedBundle({ scenario, target, directory, client });
      await writeReferenceBundle({ scenario, target, directory, client });
      const result = await verifyBundle({
        directory,
        contractFile: scenario.contractFile,
        target,
        client,
        reference: true,
      });
      printResult(`${scenario.id} / ${target}`, result);
      if (result.verdict !== 'pass') failed++;
      mounted.push({
        slot: `${scenario.id}-${target}`.replace(/[^\w-]/g, '-'),
        directory,
        contractFile: scenario.contractFile,
        contract: readContract(scenario.contractFile),
        // Эталон на core рисуется схемой без слоя рендера (`intentForTarget` снимает видимость).
        renderLayer: target !== 'core',
      });
    }
  }
  if (withBrowser && mounted.length > 0) {
    const browser = verifyInBrowser(mounted, {
      batchId: 'golden',
      workDirectory: path.join(workDirectory, 'browser'),
    });
    for (const { slot, contract } of mounted) {
      const checks = browser[slot];
      const { score } = summarize(contract, checks);
      const failedBrowser = Object.values(checks).some((check) => checkStatus(check) === 'fail');
      printResult(`${slot} браузер`, { verdict: failedBrowser ? 'fail' : 'pass', score, checks });
      if (failedBrowser) failed++;
    }
  }
  return failed;
}

async function runNegative(client, workDirectory) {
  const fixtures = path.join(here, 'fixtures', 'negative');
  let failed = 0;
  for (const name of readdirSync(fixtures)
    .filter((file) => file.endsWith('.json'))
    .sort()) {
    const fixture = JSON.parse(readFileSync(path.join(fixtures, name), 'utf8'));
    const scenario = loadScenarios({ pattern: fixture.scenario, includeHoldout: true })[0];
    if (!scenario) throw new Error(`${name}: нет сценария ${fixture.scenario}`);
    const directory = path.join(workDirectory, `negative-${name.replace(/\.json$/, '')}`);
    await writeSeedBundle({ scenario, target: fixture.target, directory, client });
    // `seedOnly`: агент не сделал правку — в каталоге осталась затравка как есть.
    if (!fixture.seedOnly) {
      await writeReferenceBundle({ scenario, target: fixture.target, directory, client });
    }
    for (const { file, find, replace } of fixture.mutations) {
      const target = path.join(directory, file);
      const source = readFileSync(target, 'utf8');
      if (!source.includes(find)) throw new Error(`${name}: в ${file} нет «${find}»`);
      writeFileSync(target, source.split(find).join(replace));
    }
    const result = await verifyBundle({
      directory,
      contractFile: scenario.contractFile,
      target: fixture.target,
      client,
      reference: true,
    });
    const status = checkStatus(result.checks[fixture.expectFailure]);
    const caught = status === 'fail';
    console.log(
      `${caught ? '✓' : '✗'} ${name}: ${fixture.expectFailure} — ${caught ? 'поймано' : `не поймано (${status ?? 'нет проверки'})`}`
    );
    if (!caught) failed++;
  }
  return failed;
}

/**
 * Оценить сохранённые формы батчей нынешним прибором, не запуская модель: без этого прогоны до и после
 * правки контракта сравнивать нельзя. Браузерные проверки остаются из прогона. Holdout показан только
 * агрегатом, как в остальных отчётах: разбор его провалов превратил бы его в настроечный набор.
 */
async function runReverify(client, batchIds) {
  const scenarios = new Map(
    loadScenarios({ includeHoldout: true }).map((scenario) => [scenario.id, scenario])
  );
  for (const batchId of batchIds) {
    const local = path.join(runsDirectory, batchId, 'records.jsonl');
    const flips = [];
    const holdout = { before: 0, after: 0, total: 0 };
    const records = [];
    for (const record of readRecords(local)) {
      const scenario = scenarios.get(record.scenario?.id);
      const directory = record.artifacts?.runDir
        ? path.join(repoRoot, record.artifacts.runDir, 'bundle')
        : null;
      if (record.verdict === 'invalid' || !scenario || !directory || !existsSync(directory)) {
        records.push(record);
        continue;
      }
      const text = contractText(scenario.contractFile);
      const result = await verifyBundle({
        directory,
        contractFile: scenario.contractFile,
        target: record.scenario.target,
        client,
        reference: record.agent?.kind === 'replay',
      });
      const browser = Object.entries(record.checks).filter(([id]) => id.startsWith('browser.'));
      const checks = { ...result.checks, ...Object.fromEntries(browser) };
      const { verdict, score, gates, failedGates } = summarize(
        readContract(scenario.contractFile),
        checks
      );
      if (scenario.split === 'holdout') {
        holdout.total += 1;
        if (record.verdict === 'pass') holdout.before += 1;
        if (verdict === 'pass') holdout.after += 1;
      } else if (verdict !== record.verdict) {
        const why = failedGates.length ? `: ${failedGates.join(', ')}` : '';
        flips.push(
          `${record.runId.split('.').slice(1).join('.')} ${record.verdict} → ${verdict}${why}`
        );
      }
      records.push({
        ...record,
        verdict,
        score,
        gates,
        checks,
        source: { ...record.source, provenance: 'reverified' },
        scenario: {
          ...record.scenario,
          contractDigest: createHash('sha256').update(text).digest('hex').slice(0, 16),
        },
      });
    }
    rewriteRecords(records, [local]);
    const passed = records.filter((record) => record.verdict === 'pass').length;
    console.log(
      `${batchId}: прошло ${passed}/${records.length}; в историю: npm run mcp:history -- add ${batchId}`
    );
    for (const flip of flips) console.log(`  ${flip}`);
    if (holdout.total > 0) {
      console.log(
        `  holdout, агрегат: было ${holdout.before}/${holdout.total}, стало ${holdout.after}/${holdout.total}`
      );
    }
  }
}

/**
 * Прогон лестницы в ассистенте (`assistant-ladder.test.ts` с `EVAL_LADDER_OUT`): каждый модуль
 * конструктора — тем же контрактом сценария, что форма терминала. Сценарий, который ассистент не
 * собрал (`build_form` отказал), — провал без проверки модуля.
 *
 * @returns Число сценариев, не прошедших верификатор.
 */
export async function runLadder(client, directory) {
  const ladder = JSON.parse(readFileSync(path.join(directory, 'ladder.json'), 'utf8'));
  const scenarios = new Map(
    loadScenarios({ includeHoldout: true }).map((scenario) => [scenario.id, scenario])
  );
  const results = [];
  for (const run of ladder.results) {
    const scenario = scenarios.get(run.id);
    if (!scenario) throw new Error(`сценарий ${run.id} не найден в eval/scenarios`);
    const result = run.ok
      ? await verifyBundle({
          directory: path.join(directory, run.dir ?? run.id),
          contractFile: scenario.contractFile,
          target: 'renderer-json',
          module: 'builder',
          client,
        })
      : {
          verdict: 'fail',
          score: 0,
          gates: ['builder.build'],
          failedGates: ['builder.build'],
          checks: { 'builder.build': ['fail', String(run.error ?? '').slice(0, 200)] },
        };
    printResult(`${run.dir ?? run.id} (ассистент)`, result);
    results.push({
      id: run.id,
      repeat: run.repeat ?? 1,
      level: scenario.level,
      built: run.ok,
      seconds: run.seconds,
      tools: run.tools,
      ...result,
    });
  }
  writeFileSync(
    path.join(directory, 'verify.json'),
    `${JSON.stringify({ agent: ladder.agent, model: ladder.model, results }, null, 2)}\n`
  );
  return results.filter((result) => result.verdict !== 'pass').length;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
  const argv = process.argv.slice(2);
  const has = (name) => argv.includes(`--${name}`);
  const flag = (name, fallback = null) => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
  };
  const serverPath = path.resolve(flag('server', path.join(packageDirectory, 'dist/index.js')));
  const workDirectory = path.join(repoRoot, '.tmp', 'mcp-verify');
  rmSync(workDirectory, { recursive: true, force: true });
  mkdirSync(workDirectory, { recursive: true });
  const client = new McpClient(serverPath);
  await client.initialize();
  let failed = 0;
  try {
    if (has('golden')) {
      failed = await runGolden(client, flag('scenario', '*'), workDirectory, has('browser'));
    } else if (has('negative')) {
      failed = await runNegative(client, workDirectory);
    } else if (has('ladder')) {
      failed = await runLadder(client, path.resolve(flag('ladder', '')));
    } else if (has('reverify')) {
      await runReverify(client, flag('reverify', '').split(',').filter(Boolean));
    } else {
      const directory = path.resolve(flag('dir', ''));
      const result = await verifyBundle({
        directory,
        contractFile: path.resolve(flag('contract', '')),
        target: flag('target', 'renderer-react'),
        module: flag('module', 'mcp'),
        client,
      });
      printResult(path.relative(repoRoot, directory), result);
      failed = result.verdict === 'pass' ? 0 : 1;
    }
  } finally {
    client.close();
  }
  process.exit(failed ? 1 : 0);
}
