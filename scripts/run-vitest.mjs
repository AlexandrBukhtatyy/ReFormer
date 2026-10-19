#!/usr/bin/env node
/**
 * vitest-with-force-exit wrapper
 *
 * Vitest 4.0.x has a hanging-on-exit bug — see vitest-dev/vitest#8766. After
 * all tests pass, the process never returns control: workers idle in
 * uv_cond_wait, main process never reaps them. Locally reproduces with
 * Node 24, on CI with Node 20 the symptom is identical (Release @reformer/core
 * hung in_progress 30+ minutes, never publishes).
 *
 * We use IDLE detection:
 *
 *   1. Spawn `npx vitest run` with full arg passthrough; pipe stdout/stderr.
 *   2. After the child has been emitting output for `MIN_RUN_MS` (~5s) and
 *      then goes silent for `IDLE_KILL_MS` (default 60s) — kill it together with
 *      its children (on Windows the child is the shell, and killing it alone
 *      left vitest running — ReFormer-23l1) and decide the exit code from the
 *      output (`run-vitest-verdict.mjs`):
 *        - failure markers ("FAIL", "Tests X failed", coverage threshold) → 1;
 *        - the "Test Files … (N)" summary line → 0 — it is printed only once
 *          every file has reported;
 *        - no summary → compare the reported files with
 *          `vitest list --filesOnly --json`: all reported → 0, otherwise 1 with
 *          the missing files listed. A hang in the middle of the run used to
 *          pass as green while some files never reported (ReFormer-rchr).
 *   3. If vitest exits naturally first — inherit its exit code.
 *
 * Usage (drop-in for `vitest run`):
 *   node ../../scripts/run-vitest.mjs <vitest-args>
 *
 * Env:
 *   VITEST_IDLE_KILL_MS — ms of stdout silence before assuming hang. Default 60000.
 *   VITEST_MIN_RUN_MS   — ms of activity before idle detection arms. Default 5000.
 *
 * Live evaluations against a real model stay silent for minutes per step: raise
 * VITEST_IDLE_KILL_MS for them, or run `npx vitest run` directly.
 */
import { spawn, spawnSync } from 'node:child_process';
import {
  hasSummary,
  idleVerdict,
  listCommandArgs,
  treeKillCommand,
} from './run-vitest-verdict.mjs';

const args = process.argv.slice(2);
const COVERAGE = args.some((arg) => arg === '--coverage' || arg.startsWith('--coverage.'));
const IDLE_KILL_MS = Number(process.env.VITEST_IDLE_KILL_MS ?? 60000);
const MIN_RUN_MS = Number(process.env.VITEST_MIN_RUN_MS ?? 5000);
const LIST_TIMEOUT_MS = 60000;

// `--passWithNoTests` — для пакетов без .test.ts файлов (cdk, mcp).
// Иначе `vitest run` exit'ает с code 1 на "No test files found".
const child = spawn('npx', ['vitest', 'run', '--passWithNoTests', ...args], {
  stdio: ['inherit', 'pipe', 'pipe'],
  env: process.env,
  // shell: true — needed on Windows to resolve `npx` .cmd shim. Cross-platform safe:
  // on POSIX the args list is still passed verbatim to /bin/sh -c, no quoting issues.
  shell: true,
});

const startedAt = Date.now();
let lastDataAt = Date.now();
let buf = '';
// Решение по простою принято: выход убитого процесса больше не определяет код.
let deciding = false;

const handleData = (data, sink) => {
  sink.write(data);
  buf += data.toString();
  if (buf.length > 131072) buf = buf.slice(-131072); // keep last 128 KB
  lastDataAt = Date.now();
};

child.stdout.on('data', (d) => handleData(d, process.stdout));
child.stderr.on('data', (d) => handleData(d, process.stderr));

/**
 * Снять процесс вместе с потомками. Через `shell: true` дочерний процесс — оболочка, а vitest —
 * её потомок; на Windows `kill()` оболочки vitest не останавливает (`treeKillCommand`).
 */
function killTree(proc) {
  const command = treeKillCommand(proc.pid);
  if (command !== null) {
    const [cmd, cmdArgs] = command;
    if (spawnSync(cmd, cmdArgs, { stdio: 'ignore' }).status === 0) return;
  }
  try {
    proc.kill('SIGKILL');
  } catch {
    // Already dead.
  }
}

/** Файлы, которые vitest нашёл бы с теми же аргументами; `null`, если список получить не удалось. */
function expectedFiles() {
  return new Promise((resolve) => {
    const list = spawn('npx', listCommandArgs(args), {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: process.env,
      shell: true,
    });
    let out = '';
    const timer = setTimeout(() => {
      killTree(list);
      resolve(null);
    }, LIST_TIMEOUT_MS);
    list.stdout.on('data', (d) => (out += d));
    list.on('error', () => {
      clearTimeout(timer);
      resolve(null);
    });
    list.on('exit', (code) => {
      clearTimeout(timer);
      try {
        const parsed = JSON.parse(out.slice(out.indexOf('[')));
        resolve(code === 0 && Array.isArray(parsed) ? parsed : null);
      } catch {
        resolve(null);
      }
    });
  });
}

const idleCheck = setInterval(async () => {
  if (child.exitCode !== null || deciding) {
    clearInterval(idleCheck);
    return;
  }
  const sinceStart = Date.now() - startedAt;
  const sinceData = Date.now() - lastDataAt;
  if (sinceStart < MIN_RUN_MS) return;
  if (sinceData < IDLE_KILL_MS) return;

  // Stdout silent long enough — vitest finished or hung mid-run. Decide from the output.
  deciding = true;
  clearInterval(idleCheck);
  killTree(child);
  const expected = hasSummary(buf) ? undefined : await expectedFiles();
  const { code, reason } = idleVerdict({ output: buf, coverage: COVERAGE, expected });
  process.stderr.write(
    `\n[run-vitest] No stdout for ${IDLE_KILL_MS} ms — vitest hung. Forcing exit ${code}: ${reason}\n`
  );
  process.exit(code);
}, 2000);

child.on('exit', (code) => {
  if (deciding) return;
  clearInterval(idleCheck);
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  if (deciding) return;
  clearInterval(idleCheck);
  process.stderr.write(`[run-vitest] failed to spawn vitest: ${err}\n`);
  process.exit(1);
});
