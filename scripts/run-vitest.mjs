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
 * The hang prevents `vitest run` from printing the final "Test Files X passed"
 * summary line — so we cannot key on it. Instead we use IDLE detection:
 *
 *   1. Spawn `npx vitest run` with full arg passthrough; pipe stdout/stderr.
 *   2. After the child has been emitting output for `MIN_RUN_MS` (~5s) and
 *      then goes silent for `IDLE_KILL_MS` (default 60s) — assume tests
 *      finished but vitest can't exit. Detect failures by scanning the buffer:
 *        - any "FAIL " or "✗" or "Tests   X failed" → exit 1
 *        - any "Test Files" line with "failed" → exit 1
 *        - otherwise → exit 0
 *      Then SIGKILL the child.
 *   3. If vitest exits naturally first — inherit its exit code.
 *
 * Usage (drop-in for `vitest run`):
 *   node ../../scripts/run-vitest.mjs <vitest-args>
 *
 * Env:
 *   VITEST_IDLE_KILL_MS — ms of stdout silence before assuming hang. Default 60000.
 *   VITEST_MIN_RUN_MS   — ms of activity before idle detection arms. Default 5000.
 */
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const IDLE_KILL_MS = Number(process.env.VITEST_IDLE_KILL_MS ?? 60000);
const MIN_RUN_MS = Number(process.env.VITEST_MIN_RUN_MS ?? 5000);

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

const handleData = (data, sink) => {
  sink.write(data);
  buf += data.toString();
  if (buf.length > 131072) buf = buf.slice(-131072); // keep last 128 KB
  lastDataAt = Date.now();
};

child.stdout.on('data', (d) => handleData(d, process.stdout));
child.stderr.on('data', (d) => handleData(d, process.stderr));

const idleCheck = setInterval(() => {
  if (child.exitCode !== null) {
    clearInterval(idleCheck);
    return;
  }
  const sinceStart = Date.now() - startedAt;
  const sinceData = Date.now() - lastDataAt;
  if (sinceStart < MIN_RUN_MS) return;
  if (sinceData < IDLE_KILL_MS) return;

  // Stdout silent long enough — assume vitest finished but is hung.
  // Decide exit code from buffered output.
  const hasFailMarker =
    /\bTest Files[^\n]*\bfailed\b/.test(buf) ||
    /\bTests\s+\d+\s+failed\b/.test(buf) ||
    / FAIL\b/.test(buf) ||
    /\bUnhandled\b/.test(buf);
  // Sanity check: did anything actually run?
  const hasPassMarker = /✓|\bpassed\b/.test(buf);
  let code;
  if (hasFailMarker) code = 1;
  else if (hasPassMarker) code = 0;
  else code = 1; // nothing ran — treat as failure

  process.stderr.write(
    `\n[run-vitest] No stdout for ${IDLE_KILL_MS} ms — vitest hung after run. ` +
      `Forcing exit ${code} (failures=${hasFailMarker}, passes=${hasPassMarker}).\n`
  );
  clearInterval(idleCheck);
  try {
    child.kill('SIGKILL');
  } catch {
    // Already dead.
  }
  process.exit(code);
}, 2000);

child.on('exit', (code) => {
  clearInterval(idleCheck);
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  clearInterval(idleCheck);
  process.stderr.write(`[run-vitest] failed to spawn vitest: ${err}\n`);
  process.exit(1);
});
