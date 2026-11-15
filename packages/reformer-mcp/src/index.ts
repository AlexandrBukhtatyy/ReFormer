#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createNodeServer } from './platform/cli/server.js';
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
// REFORMER_SURFACE=code — эксперимент Code Mode: один инструмент run_script, API сервера в песочнице
// QuickJS (замер — docs/mcp-eval/code-mode.md). REFORMER_SURFACE=guided — профиль для малых моделей:
// план от сервера и плоские правки (docs/plans/lucky-popping-wall.md). REFORMER_SURFACE=code-guided —
// их связка: API guided внутри run_script. REFORMER_SURFACE=code-guided-dsl — та же связка с
// конструктором форм: search (чтение данных формы) и execute (правки цепочками).
// Иначе — обычный набор.
const SURFACES = ['code', 'guided', 'code-guided', 'code-guided-dsl'] as const;
const surfaceEnv = process.env.REFORMER_SURFACE;
const surface = SURFACES.find((name) => name === surfaceEnv) ?? 'tools';

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
