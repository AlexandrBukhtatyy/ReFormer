#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { cliKnowledge } from './platform/cli/knowledge.js';
import { mountReformerServer } from './core/server/mount.js';
import { createResourceCatalog } from './core/server/resource-catalog.js';
import { createToolCatalog } from './core/server/tool-catalog.js';

// Prompts
import {
  debugPromptDefinition,
  getDebugPrompt,
  startHerePromptDefinition,
  getStartHerePrompt,
  reviewPromptDefinition,
  getReviewPrompt,
  planFormPromptDefinition,
  getPlanFormPrompt,
  createFormPromptDefinition,
  getCreateFormPrompt,
  addFeaturePromptDefinition,
  getAddFeaturePrompt,
  toRendererPromptDefinition,
  getToRendererPrompt,
  discoverContextPromptDefinition,
  getDiscoverContextPrompt,
} from './prompts/index.js';

// Check debug mode
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

// Env config (set in the MCP server registration `.mcp.json` env, like REFORMER_DEBUG):
//   REFORMER_FORM_LAYOUT = 'minimalist' (default) | 'folders'
//     → default file layout the `create-form` prompt steers toward. Read in prompts/create-form.ts.
//     ВАЖНО: ручка действует только в prompt-канале, а он доходит не до всякого клиента — замер
//     показал агентов, у которых `prompts/list` и `prompts/get` недоступны в принципе. Поэтому
//     раскладку по умолчанию (`minimalist`) дублируют tool-поверхность (описания `plan_form` /
//     `generate_form`, чек-лист в манифесте) и вводный блок `reformer://guide`.

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
const server = new Server(
  {
    name: 'reformer-mcp',
    version: readServerVersion(),
  },
  {
    // `sampling` здесь НЕ объявляем: это capability КЛИЕНТА, а не сервера — сервер лишь
    // запрашивает sampling через `server.createMessage(...)`. SDK ≥1.30 типом это и
    // фиксирует (ServerCapabilities больше не принимает `sampling`). На сам механизм
    // это не влияет: `isSamplingSupported()` смотрит `server.getClientCapabilities()`.
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ==================== TOOLS & RESOURCES ====================
//
// Список и диспетчер инструментов, схема адресов ресурсов — в `core/server`: те же каталоги
// поднимает браузерный воркер (`platform/worker/server.ts`), и копия здесь разъехалась бы с ними.
// Под Node знание — над файлами пакетов (`cliKnowledge`), профиль `node`: с `report_issue`,
// `debug` по флагу и `specPath` у `plan_form`.

mountReformerServer(server, {
  tools: createToolCatalog(cliKnowledge, { profile: 'node', debug: isDebugMode }),
  resources: createResourceCatalog(cliKnowledge, { debug: isDebugMode }),
});

// ==================== PROMPTS ====================

type AnyPromptDefinition =
  | typeof startHerePromptDefinition
  | typeof reviewPromptDefinition
  | typeof debugPromptDefinition
  | typeof planFormPromptDefinition
  | typeof createFormPromptDefinition
  | typeof addFeaturePromptDefinition
  | typeof toRendererPromptDefinition
  | typeof discoverContextPromptDefinition;

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts: AnyPromptDefinition[] = [
    startHerePromptDefinition,
    discoverContextPromptDefinition,
    reviewPromptDefinition,
    planFormPromptDefinition,
    createFormPromptDefinition,
    addFeaturePromptDefinition,
    toRendererPromptDefinition,
  ];
  if (isDebugMode) {
    prompts.push(debugPromptDefinition);
  }
  return { prompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'debug':
      if (!isDebugMode) {
        throw new Error(`Unknown prompt: ${name}`);
      }
      return await getDebugPrompt(args as { code: string });

    case 'start-here':
      return getStartHerePrompt();

    case 'review':
      return await getReviewPrompt(args as { code: string });

    case 'plan-form':
      return await getPlanFormPrompt(
        args as { specPath: string; target?: string; projectPath?: string },
        server
      );

    case 'create-form':
      return await getCreateFormPrompt(
        args as { description: string; target?: string; projectPath?: string },
        server
      );

    case 'discover-context':
      return await getDiscoverContextPrompt(
        args as { description: string; projectPath?: string },
        server
      );

    case 'add-feature':
      return await getAddFeaturePrompt(
        args as { feature?: string; code?: string; requirements?: string; steps?: string }
      );

    case 'to-renderer':
      return await getToRendererPrompt(args as { code?: string; target?: string });

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
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
