#!/usr/bin/env node
/**
 * stdio-переходник к бандлу MCP-сервера для Web Worker — чтобы внешний MCP-клиент (Inspector CLI)
 * говорил с тем самым `server.js`, который ассистент конструктора поднимает в воркере.
 *
 * Бандл знает только `self` воркера: `postMessage` и слушатели `message`, один кадр — одно
 * сообщение JSON-RPC (`src/platform/worker/port-transport.ts`). Здесь `self` — объект в контексте
 * `node:vm`, как в `tests/worker-bundle.test.ts`: строка stdin становится кадром для воркера,
 * кадр воркера — строкой stdout. Доставка асинхронная и через `structuredClone`, как у настоящего
 * `postMessage`.
 *
 * Консоль бандла уходит в stderr: в браузере она пишет в devtools, а не в канал, и stdout здесь
 * обязан оставаться чистым JSON-RPC.
 *
 * Запуск: `node worker-stdio.mjs [путь к server.js]`; по умолчанию — бандл образца конструктора,
 * переопределяется `REFORMER_WORKER_BUNDLE`.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../../..');
const bundleFile = path.resolve(
  process.argv[2] ??
    process.env.REFORMER_WORKER_BUNDLE ??
    path.join(repoRoot, 'projects/reformer-builder-playground/.ui_builder/mcp/reformer/server.js')
);

if (!existsSync(bundleFile)) {
  process.stderr.write(
    `worker-stdio: бандл ${bundleFile} не найден — соберите его: ` +
      'npm --prefix projects/reformer-builder-playground run mcp:build\n'
  );
  process.exit(1);
}

const toStderr = (...args) => process.stderr.write(`${args.map(String).join(' ')}\n`);
const workerConsole = {
  log: toStderr,
  info: toStderr,
  debug: toStderr,
  warn: toStderr,
  error: toStderr,
  trace: toStderr,
};

const workerListeners = new Set();
const self = {
  postMessage: (message) => process.stdout.write(`${JSON.stringify(message)}\n`),
  addEventListener: (_type, listener) => workerListeners.add(listener),
  removeEventListener: (_type, listener) => workerListeners.delete(listener),
};

const context = vm.createContext({
  self,
  console: workerConsole,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  queueMicrotask,
  structuredClone,
  AbortController,
  AbortSignal,
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  Event,
  EventTarget,
  crypto: globalThis.crypto,
});
vm.runInContext(readFileSync(bundleFile, 'utf8'), context, { filename: 'server.js' });

const input = readline.createInterface({ input: process.stdin });
input.on('line', (line) => {
  if (!line.trim()) return;
  let message;
  try {
    message = JSON.parse(line);
  } catch {
    toStderr(`worker-stdio: не JSON на stdin — ${line.slice(0, 120)}`);
    return;
  }
  const data = structuredClone(message);
  setTimeout(() => workerListeners.forEach((listener) => listener({ data })), 0);
});
// Клиент закрыл stdin — воркер хост бы остановил; ждать нечего.
input.on('close', () => process.exit(0));
