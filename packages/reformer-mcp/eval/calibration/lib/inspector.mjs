/**
 * Вызовы MCP-сервера через MCP Inspector CLI — по двум каналам, которыми сервер доходит до агентов.
 *
 *   node   — stdio-сервер `dist/index.js` (профиль node): внешние агенты по `.mcp.json`;
 *   worker — бандл воркера конструктора через `worker-stdio.mjs` (профиль browser): ассистент
 *            зовёт его фасадом `mcp_call`.
 *
 * Каждый вызов — отдельный запуск CLI, как в документации Inspector: сервер поднимается, отвечает
 * на один запрос и завершается. Так меряется и то, что сервер стартует и выходит чисто.
 *
 * Inspector ставится один раз в `.tmp/mcp-calibration/inspector` с закреплённой версией: `npx`
 * тратит на разрешение пакета секунды на КАЖДЫЙ вызов, а вызовов в прогоне — сотни.
 *
 * ## Длинные аргументы
 *
 * У CLI аргументы инструмента приходят только строкой `--tool-args-json`, а командная строка
 * Windows ограничена 32 767 символами. Intent сложной формы туда не влезает. Такие вызовы идут
 * тем же каналом через SDK-клиент харнесса eval (`../../lib/client.mjs`), и результат помечен
 * `via: 'sdk'` — отчёт называет их отдельно.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpClient } from '../../lib/client.mjs';

export const INSPECTOR_VERSION = '2.12.0';

const here = path.dirname(fileURLToPath(import.meta.url));
export const calDir = path.resolve(here, '..');
export const pkgDir = path.resolve(calDir, '../..');
export const repoRoot = path.resolve(pkgDir, '../..');
export const tmpDir = path.join(repoRoot, '.tmp', 'mcp-calibration');

const inspectorDir = path.join(tmpDir, 'inspector');
const launcher = path.join(
  inspectorDir,
  'node_modules/@modelcontextprotocol/inspector/clients/launcher/build/index.js'
);

/** Предел длины JSON аргументов, после которого вызов уходит в SDK-клиент. С запасом под прочие флаги. */
const ARGV_JSON_LIMIT = 24_000;

export const CHANNELS = {
  node: {
    label: 'stdio dist/index.js (профиль node)',
    // Другая сборка сервера — например мутант из `eval/mutations`.
    script: process.env.REFORMER_MCP_SERVER
      ? path.resolve(process.env.REFORMER_MCP_SERVER)
      : path.join(pkgDir, 'dist', 'index.js'),
  },
  worker: {
    label: 'бандл воркера через worker-stdio (профиль browser)',
    script: path.join(calDir, 'worker-stdio.mjs'),
  },
};

/** Поставить Inspector, если его ещё нет. Возвращает путь к запускаемому файлу CLI. */
export function ensureInspector() {
  if (existsSync(launcher)) return launcher;
  mkdirSync(inspectorDir, { recursive: true });
  console.error(`… ставлю @modelcontextprotocol/inspector@${INSPECTOR_VERSION} в ${inspectorDir}`);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const r = spawnSync(
    npm,
    [
      'i',
      '--prefix',
      inspectorDir,
      `@modelcontextprotocol/inspector@${INSPECTOR_VERSION}`,
      '--no-audit',
      '--no-fund',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' }
  );
  if (r.status !== 0 || !existsSync(launcher)) {
    throw new Error(`не удалось поставить Inspector (exit ${r.status})`);
  }
  return launcher;
}

/** Текст результата: content у tools/call, contents у resources/read, messages у prompts/get. */
export function textOf(result) {
  if (!result) return '';
  const parts = [];
  for (const c of result.content ?? []) if (typeof c.text === 'string') parts.push(c.text);
  for (const c of result.contents ?? []) if (typeof c.text === 'string') parts.push(c.text);
  for (const m of result.messages ?? []) {
    if (typeof m.content?.text === 'string') parts.push(m.content.text);
  }
  return parts.join('\n');
}

function lastJsonLine(text) {
  const lines = String(text).trim().split(/\r?\n/).reverse();
  for (const line of lines) {
    try {
      return JSON.parse(line);
    } catch {
      // не JSON — дальше
    }
  }
  return null;
}

/**
 * Один запрос к серверу канала.
 *
 * @param {'node'|'worker'} channel
 * @param {string} method - метод MCP (`initialize`, `tools/list`, `tools/call`, …)
 * @param {object} [opts]
 * @param {string} [opts.toolName]
 * @param {object} [opts.toolArgs]
 * @param {string} [opts.uri]
 * @param {string} [opts.promptName]
 * @param {Record<string,string>} [opts.promptArgs]
 * @param {Record<string,string>} [opts.env]
 * @param {boolean} [opts.strict]
 * @param {string[]} [opts.target] - своя команда сервера вместо канала (например `--config`)
 * @param {number} [opts.timeoutMs]
 */
export async function inspect(channel, method, opts = {}) {
  const argsJson = opts.toolArgs === undefined ? undefined : JSON.stringify(opts.toolArgs);
  if (argsJson !== undefined && argsJson.length > ARGV_JSON_LIMIT) {
    return viaSdk(channel, method, opts);
  }

  const cli = ensureInspector();
  const target = opts.target ?? [process.execPath, CHANNELS[channel].script];
  const args = [cli, '--cli', ...target, '--method', method, '--format', 'json', '-q'];
  for (const [k, v] of Object.entries(opts.env ?? {})) args.push('-e', `${k}=${v}`);
  if (opts.toolName) args.push('--tool-name', opts.toolName);
  if (argsJson !== undefined) args.push('--tool-args-json', argsJson);
  if (opts.uri) args.push('--uri', opts.uri);
  if (opts.promptName) args.push('--prompt-name', opts.promptName);
  const promptPairs = Object.entries(opts.promptArgs ?? {}).map(([k, v]) => `${k}=${v}`);
  if (promptPairs.length) args.push('--prompt-args', ...promptPairs);
  if (opts.strict) args.push('--strict');

  const t0 = performance.now();
  const { exit, stdout, stderr } = await run(process.execPath, args, opts.timeoutMs ?? 120_000);
  const ms = Math.round(performance.now() - t0);

  let json = null;
  try {
    json = stdout.trim() ? JSON.parse(stdout) : null;
  } catch {
    json = null;
  }
  const envelope = exit === 0 ? null : (lastJsonLine(stderr)?.error ?? null);
  const result = json?.result ?? null;
  return {
    channel,
    method,
    via: 'inspector',
    exit,
    ok: exit === 0,
    json,
    result,
    error: envelope,
    text: textOf(result),
    stdout,
    stderr,
    ms,
  };
}

/** Вызов тем же каналом через SDK-клиент — для аргументов длиннее командной строки. */
async function viaSdk(channel, method, opts) {
  const client = new McpClient(CHANNELS[channel].script, { env: opts.env ?? {} });
  const t0 = performance.now();
  try {
    await client.initialize();
    let r;
    if (method === 'tools/call') {
      r = await client.request(
        'tools/call',
        { name: opts.toolName, arguments: opts.toolArgs },
        opts.timeoutMs ?? 120_000
      );
    } else {
      throw new Error(`SDK-путь калибровки поддерживает только tools/call, а не ${method}`);
    }
    const result = r.result;
    const isError = result?.isError === true;
    const exit = r.error ? 1 : isError ? 5 : 0;
    return {
      channel,
      method,
      via: 'sdk',
      exit,
      ok: exit === 0,
      json: r.error ? null : { result },
      result,
      error: r.error ?? (isError ? { code: 'tool_is_error' } : null),
      text: textOf(result),
      stdout: '',
      stderr: '',
      ms: Math.round(performance.now() - t0),
    };
  } finally {
    client.close();
  }
}

function run(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d) => (stderr += d.toString('utf8')));
    const timer = setTimeout(() => {
      stderr += `\n[calibration] timeout ${timeoutMs} ms — процесс остановлен`;
      child.kill();
    }, timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exit: code ?? -1, stdout, stderr });
    });
  });
}

/** Выполнить задачи с ограничением параллельности, сохранив порядок результатов. */
export async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}
