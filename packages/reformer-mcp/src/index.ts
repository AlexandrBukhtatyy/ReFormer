#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createNodeServer } from './platform/cli/server.js';
import { createTraceSink, TRACE_FILE_ENV } from './platform/cli/trace-sink.js';

// Check debug mode
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

// Env config (set in the MCP server registration `.mcp.json` env, like REFORMER_DEBUG):
//   REFORMER_FORM_LAYOUT = 'minimalist' (default) | 'folders'
//     → default file layout the `create-form` prompt steers toward. Read in prompts/create-form.ts.
//     ВАЖНО: ручка действует только в prompt-канале, а он доходит не до всякого клиента — замер
//     показал агентов, у которых `prompts/list` и `prompts/get` недоступны в принципе. Поэтому
//     раскладку по умолчанию (`minimalist`) дублируют tool-поверхность (описания `plan_form` /
//     `generate_form`, чек-лист в манифесте) и вводный блок `reformer://guide`.
//   REFORMER_TRACE_FILE = <путь> → журнал вызовов для замеров, см. platform/cli/trace-sink.ts.

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
const server = createNodeServer({
  version: readServerVersion(),
  debug: isDebugMode,
  onCall: createTraceSink(process.env[TRACE_FILE_ENV]),
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
