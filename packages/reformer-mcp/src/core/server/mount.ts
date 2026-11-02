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
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ResourceCatalog } from './resource-catalog.js';
import type { ToolCatalog } from './tool-catalog.js';

export interface ReformerServerCatalogs {
  readonly tools: ToolCatalog;
  readonly resources: ResourceCatalog;
}

/** Завершившийся вызов сервера: инструмент, ресурс или промпт. */
export interface ReformerServerCall {
  readonly kind: 'tool' | 'resource' | 'prompt';
  readonly name: string;
  readonly arguments: unknown;
  /** Размер ответа, как его увидит клиент. У вызова, упавшего исключением, — 0. */
  readonly resultChars: number;
  /** Ответ с `isError` либо исключение. */
  readonly isError: boolean;
  /** Текст исключения; `null`, если вызов вернул ответ (пусть и с `isError`). */
  readonly protocolError: string | null;
  readonly durationMs: number;
}

export interface MountOptions {
  /**
   * Наблюдатель вызовов — для замеров. Не задан — обработчики те же, что без него: ни таймера, ни
   * подсчёта размера ответа.
   */
  readonly onCall?: (call: ReformerServerCall) => void;
}

/**
 * Выполнить вызов и сообщить о нём наблюдателю. Исключение пробрасывается дальше: SDK превращает
 * его в ошибку JSON-RPC, наблюдатель этого не меняет.
 */
export async function observeCall<Result>(
  onCall: (call: ReformerServerCall) => void,
  call: Pick<ReformerServerCall, 'kind' | 'name' | 'arguments'>,
  run: () => Result | Promise<Result>
): Promise<Result> {
  const startedAt = performance.now();
  try {
    const result = await run();
    onCall({
      ...call,
      resultChars: JSON.stringify(result)?.length ?? 0,
      isError: (result as { isError?: boolean } | null)?.isError === true,
      protocolError: null,
      durationMs: performance.now() - startedAt,
    });
    return result;
  } catch (error) {
    onCall({
      ...call,
      resultChars: 0,
      isError: true,
      protocolError: error instanceof Error ? error.message : String(error),
      durationMs: performance.now() - startedAt,
    });
    throw error;
  }
}

/** Повесить обработчики `tools/*` и `resources/*`. Сервер обязан объявить обе возможности. */
export function mountReformerServer(
  server: Server,
  catalogs: ReformerServerCatalogs,
  options: MountOptions = {}
): void {
  const { onCall } = options;
  server.setRequestHandler(ListToolsRequestSchema, () => ({ tools: catalogs.tools.list() }));
  server.setRequestHandler(
    CallToolRequestSchema,
    onCall
      ? (request) =>
          observeCall(
            onCall,
            { kind: 'tool', name: request.params.name, arguments: request.params.arguments },
            () => catalogs.tools.call(request.params.name, request.params.arguments)
          )
      : (request) => catalogs.tools.call(request.params.name, request.params.arguments)
  );
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: catalogs.resources.list(),
  }));
  server.setRequestHandler(
    ReadResourceRequestSchema,
    onCall
      ? (request) =>
          observeCall(
            onCall,
            { kind: 'resource', name: request.params.uri, arguments: undefined },
            () => catalogs.resources.read(request.params.uri)
          )
      : (request) => catalogs.resources.read(request.params.uri)
  );
  // Схема адресов секций — шаблоном: клиент с поддержкой шаблонов видит её без чтения каталога.
  // Раньше метода не было вовсе (-32601; калибровка, smoke S08).
  server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({
    resourceTemplates: catalogs.resources.templates(),
  }));
}
