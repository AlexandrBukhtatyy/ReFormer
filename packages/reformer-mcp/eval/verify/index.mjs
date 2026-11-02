#!/usr/bin/env node
/**
 * Верификатор формы: соответствует ли модуль формы контракту сценария.
 *
 *   npm run mcp:verify -- --dir <каталог> --contract <файл> [--target core]
 *   npm run mcp:verify -- --golden [--scenario 'L3-*']   эталон каждого сценария обязан пройти
 *   npm run mcp:verify -- --negative                     заведомо сломанные формы обязаны упасть
 *
 * Эталон доказывает, что контракт выполним; негативные фикстуры — что верификатор способен увидеть
 * ошибку. Без этого красный и зелёный вердикт верификатора ничего не значат.
 */

import { spawnSync } from 'node:child_process';
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
import { checkStatus, packageDirectory, repoRoot } from '../records/record.mjs';
import { loadScenarios, writeReferenceBundle } from '../scenarios/catalog.mjs';
import { verifyInBrowser } from './browser.mjs';

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

/** Стадия static: точка входа, раскладка, типы, проверка кода сервером. */
export async function verifyStatic({ directory, target, client }) {
  const checks = {};
  const files = existsSync(directory) ? listFiles(directory) : [];
  const entry = path.join(directory, 'index.tsx');
  const exportsComponent =
    existsSync(entry) &&
    /export\s+(default\s+)?(function|const|class)\s+\w*|export\s+default\s+\w+/.test(
      readFileSync(entry, 'utf8')
    );
  checks['workspace.entry'] = exportsComponent
    ? 'pass'
    : ['fail', files.length ? 'index.tsx не экспортирует компонент' : 'каталог результата пуст'];

  const sources = files.filter((file) => SOURCE_FILE.test(file));
  if (sources.length === 0) {
    checks['static.tsc'] = ['fail', 'нет исходников'];
    return checks;
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

  const layout = parseValidate(
    (await client.callTool('validate_form', { kind: 'layout', files, target })).text
  );
  checks['workspace.layout'] = layout.errors
    ? ['fail', `${layout.errors} ошибок: ${layout.codes.join(', ')}`.slice(0, 200)]
    : 'pass';

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
  for (const probe of contract.probes ?? []) {
    if (probe.gate && probe.where !== 'browser') gates.push(`runtime.probe.${probe.id}`);
  }
  // Пропущенная проверка не гейт: контракт мог не задавать снимок доступности.
  for (const id of ['browser.render', 'browser.aria', 'browser.axe']) {
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
export async function verifyBundle({ directory, contractFile, target, client }) {
  const contract = JSON.parse(readFileSync(contractFile, 'utf8'));
  const checks = await verifyStatic({ directory, target, client });
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
      await writeReferenceBundle({ scenario, target, directory, client });
      const result = await verifyBundle({
        directory,
        contractFile: scenario.contractFile,
        target,
        client,
      });
      printResult(`${scenario.id} / ${target}`, result);
      if (result.verdict !== 'pass') failed++;
      mounted.push({
        slot: `${scenario.id}-${target}`.replace(/[^\w-]/g, '-'),
        directory,
        contractFile: scenario.contractFile,
        contract: JSON.parse(readFileSync(scenario.contractFile, 'utf8')),
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
  for (const name of readdirSync(fixtures).sort()) {
    const fixture = JSON.parse(readFileSync(path.join(fixtures, name), 'utf8'));
    const scenario = loadScenarios({ pattern: fixture.scenario, includeHoldout: true })[0];
    const directory = path.join(workDirectory, `negative-${name.replace(/\.json$/, '')}`);
    await writeReferenceBundle({ scenario, target: fixture.target, directory, client });
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
    } else {
      const directory = path.resolve(flag('dir', ''));
      const result = await verifyBundle({
        directory,
        contractFile: path.resolve(flag('contract', '')),
        target: flag('target', 'renderer-react'),
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
