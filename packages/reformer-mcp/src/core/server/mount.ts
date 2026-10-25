/**
 * Подключить каталоги инструментов и ресурсов к серверу SDK — одинаково под Node и в воркере.
 *
 * Единственный модуль ядра, который трогает рантайм SDK: схемы запросов. Транспорт, знание и
 * промпты — забота платформы (`src/index.ts`, `platform/worker/server.ts`).
 *
 * @module reformer-mcp/core/server/mount
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ResourceCatalog } from './resource-catalog.js';
import type { ToolCatalog } from './tool-catalog.js';

export interface ReformerServerCatalogs {
  readonly tools: ToolCatalog;
  readonly resources: ResourceCatalog;
}

/** Повесить обработчики `tools/*` и `resources/*`. Сервер обязан объявить обе возможности. */
export function mountReformerServer(server: Server, catalogs: ReformerServerCatalogs): void {
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: catalogs.tools.list() }));
  server.setRequestHandler(CallToolRequestSchema, (request) =>
    catalogs.tools.call(request.params.name, request.params.arguments)
  );
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: catalogs.resources.list(),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, (request) =>
    catalogs.resources.read(request.params.uri)
  );
}
