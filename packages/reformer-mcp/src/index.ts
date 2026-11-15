#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  createNodeServer,
  DEFAULT_SURFACE,
  SERVER_SURFACES,
  surfaceFromEnv,
} from './platform/cli/server.js';
import {
  createTraceSink,
  isTraceFull,
  TRACE_FILE_ENV,
  TRACE_FULL_ENV,
} from './platform/cli/trace-sink.js';

// Check debug mode
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

// Env config (set in the MCP server registration `.mcp.json` env, like REFORMER_DEBUG):
//   REFORMER_TRACE_FILE = <путь> → журнал вызовов для замеров, см. platform/cli/trace-sink.ts.
//   Раскладку модуля держит сама сборка (`form_build` пишет каноничные имена), поэтому прежнего
//   REFORMER_FORM_LAYOUT с 7.0 нет.

// Версия из package.json пакета — иначе клиент видел захардкоженный литерал (в 11.0.0
// сервер отдавал '6.0.0', что читалось как «npx отдаёт протухший кэш»). Читаем от dist/
// (../package.json относительно dist/index.js), с безопасным фолбэком.
function readServerVersion(): string {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Server instance
// REFORMER_SURFACE выбирает поверхность (SERVER_SURFACES в platform/cli/server.ts). По умолчанию —
// code-guided-dsl: search (чтение данных формы) и execute (конструктор форм), замер — страница
// документации «Замеры: с MCP и без». tools — прежний набор: сборка из intent, справка, ресурсы,
// промпты. code — Code Mode: один run_script (docs/mcp-eval/code-mode.md). guided — план от сервера
// и плоские правки для малых моделей (docs/plans/lucky-popping-wall.md). code-guided — API guided
// внутри run_script.
const surfaceEnv = process.env.REFORMER_SURFACE;
const knownSurface = surfaceFromEnv(surfaceEnv);
if (!knownSurface) {
  console.error(
    `REFORMER_SURFACE="${surfaceEnv}" is unknown — using ${DEFAULT_SURFACE}. Values: ${SERVER_SURFACES.join(', ')}.`
  );
}
const surface = knownSurface ?? DEFAULT_SURFACE;

const server = createNodeServer({
  version: readServerVersion(),
  debug: isDebugMode,
  surface,
  onCall: createTraceSink(process.env[TRACE_FILE_ENV], {
    full: isTraceFull(process.env[TRACE_FULL_ENV]),
  }),
});

// ==================== START SERVER ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout, which is used for MCP communication)
  console.error(`ReFormer MCP Server started${isDebugMode ? ' (DEBUG MODE)' : ''}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
