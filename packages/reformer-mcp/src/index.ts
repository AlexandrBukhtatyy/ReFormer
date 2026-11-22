#!/usr/bin/env node
/**
 * `reformer-mcp` — MCP-сервер ReFormer для агента по stdio, тонкий клиент сервиса ReFormer.
 *
 * Инструменты, справку и сборку формы даёт сервис; здесь — то, что живёт на машине пользователя:
 * каталог формы, проверка типов компилятором проекта, чтение спеки, отчёты `.reformer`.
 *
 * Окружение (задаётся в регистрации сервера, `.mcp.json`):
 * - `REFORMER_API_KEY` — ключ сервиса;
 * - `REFORMER_SERVICE_URL` — адрес сервиса без пути, по умолчанию облачный; свой — для
 *   развёрнутого у себя;
 * - `REFORMER_SURFACE` — поверхность инструментов (`@reformer/mcp/contract/surfaces`);
 * - `REFORMER_TRACE_FILE`, `REFORMER_TRACE_FULL` — журнал вызовов.
 *
 * @module @reformer/mcp
 */

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { DEFAULT_SURFACE, SERVER_SURFACES, surfaceFromEnv } from './contract/surfaces.js';
import { connectServiceProxy } from './host/proxy.js';
import {
  createTraceSink,
  isTraceFull,
  TRACE_FILE_ENV,
  TRACE_FULL_ENV,
} from './local/trace-sink.js';

/** Облачный сервис ReFormer. */
export const DEFAULT_SERVICE_URL = 'https://mcp.reformer.dev';

/** Версия из `package.json` пакета (от `dist/index.js` — на уровень вверх). */
function readVersion(): string {
  try {
    const path = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return (JSON.parse(readFileSync(path, 'utf-8')) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const surfaceEnv = process.env.REFORMER_SURFACE;
const knownSurface = surfaceFromEnv(surfaceEnv);
if (!knownSurface) {
  console.error(
    `REFORMER_SURFACE="${surfaceEnv}" is unknown — using ${DEFAULT_SURFACE}. Values: ${SERVER_SURFACES.join(', ')}.`
  );
}
const surface = knownSurface ?? DEFAULT_SURFACE;
const serviceUrl = process.env.REFORMER_SERVICE_URL?.trim() || DEFAULT_SERVICE_URL;
const apiKey = process.env.REFORMER_API_KEY?.trim() || undefined;

async function main(): Promise<void> {
  // Облаку без ключа отвечать нечем: лучше сказать это сразу, чем отказом на первом вызове.
  if (!apiKey && serviceUrl === DEFAULT_SERVICE_URL) {
    console.error(
      'REFORMER_API_KEY is not set: the ReFormer service needs a key. Set it in the MCP server ' +
        'registration (env), or point REFORMER_SERVICE_URL to your own service.'
    );
    process.exit(1);
  }
  const onCall = createTraceSink(process.env[TRACE_FILE_ENV], {
    full: isTraceFull(process.env[TRACE_FULL_ENV]),
  });
  const proxy = await connectServiceProxy({
    url: serviceUrl,
    surface,
    ...(apiKey ? { apiKey } : {}),
    version: readVersion(),
    ...(onCall ? { onCall } : {}),
  });
  await proxy.connect(new StdioServerTransport());
  console.error(`ReFormer MCP client started → ${serviceUrl} (${surface})`);
}

main().catch((error: unknown) => {
  console.error('Failed to start the ReFormer MCP client:', error);
  process.exit(1);
});
