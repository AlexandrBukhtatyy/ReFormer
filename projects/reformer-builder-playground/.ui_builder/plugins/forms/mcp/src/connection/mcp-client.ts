/**
 * Клиент MCP — отложенный модуль: SDK, транспорт воркера и HTTP-транспорты.
 *
 * Грузится динамическим импортом на первое подключение (`./openers`): клиент SDK тянет ajv и zod,
 * и в главном чанке плагина они стоили бы старта билдера каждому, кто MCP не пользуется.
 *
 * ## Валидатор схем — пропускающий
 *
 * Клиент SDK компилирует `outputSchema` каждого инструмента сервера своим ajv (draft-07), и
 * чужая схема другой редакции роняла бы весь `tools/list` — то есть сервер целиком. Ассистенту
 * проверка выхода не нужна: модель читает ответ текстом. Поэтому валидатор здесь признаёт
 * верным любой ответ.
 *
 * ## Удалённый сервер: Streamable HTTP, затем SSE
 *
 * Сначала — Streamable HTTP (текущая редакция протокола). Ответил 4xx на `initialize` (кроме
 * 401/403) — значит, сервер старой редакции, и тот же адрес пробуется SSE. Ошибка `fetch` в
 * браузере — почти всегда CORS: сервер не отдаёт заголовков, без которых страница не прочитает
 * ответ; называется она так, чтобы человек понял, что чинить её надо на сервере.
 *
 * @module plugins/forms/mcp/connection/mcp-client
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { jsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/types.js';
import { createPortTransport } from '@reformer/mcp/dist/platform/worker/port-transport.js';
import {
  MAX_TOOLS,
  TIMEOUTS,
  type McpCallResult,
  type McpSession,
  type McpTool,
  type OpenRemote,
  type OpenWorker,
  type SessionEvents,
} from './session';

/** Признаёт верным любой ответ — см. шапку модуля. */
const PERMISSIVE_VALIDATOR: jsonSchemaValidator = {
  getValidator: () => (input) => ({ valid: true, data: input as never, errorMessage: undefined }),
};

const CLIENT_INFO = { name: 'reformer-builder', version: '1.0.0' };

function newClient(events: SessionEvents): Client {
  return new Client(CLIENT_INFO, {
    capabilities: {},
    jsonSchemaValidator: PERMISSIVE_VALIDATOR,
    listChanged: {
      tools: {
        onChanged: (error, tools) => {
          if (error === null && tools !== null) events.onToolsChanged(tools.map(toolOf));
        },
      },
    },
  });
}

function toolOf(tool: { name: string; description?: string; inputSchema: object }): McpTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: tool.inputSchema,
  };
}

/** Сессия над подключённым клиентом. */
function sessionOf(client: Client, beforeClose?: () => Promise<void>): McpSession {
  return {
    async listTools(signal) {
      const tools: McpTool[] = [];
      let cursor: string | undefined;
      do {
        const page = await client.listTools(cursor === undefined ? undefined : { cursor }, {
          timeout: TIMEOUTS.listMs,
          ...(signal === undefined ? {} : { signal }),
        });
        tools.push(...page.tools.map(toolOf));
        cursor = page.nextCursor;
      } while (cursor !== undefined && tools.length < MAX_TOOLS);
      return tools.slice(0, MAX_TOOLS);
    },

    async callTool(name, args, signal) {
      const result = await client.callTool({ name, arguments: args }, undefined, {
        timeout: TIMEOUTS.callMs,
        ...(signal === undefined ? {} : { signal }),
      });
      return result as McpCallResult;
    },

    async close() {
      await beforeClose?.().catch(() => undefined);
      await client.close();
    },
  };
}

/** Воркер в объёме транспорта плюс остановка. */
export type WorkerLike = Pick<
  Worker,
  'postMessage' | 'addEventListener' | 'removeEventListener' | 'terminate'
>;

/** Создать воркер — подменяется в тестах. */
export type SpawnWorker = (url: string, name: string) => WorkerLike;

const spawnBrowserWorker: SpawnWorker = (url, name) => new Worker(url, { name: `mcp:${name}` });

/**
 * Открыть сервер-бандл: воркер из Blob, MCP через `postMessage`.
 *
 * Адрес Blob отзывается после `initialize`: к этому моменту скрипт воркера точно загружен, а
 * держать адрес дольше — значит держать копию мегабайтного текста в памяти страницы.
 */
export function createWorkerOpener(spawn: SpawnWorker = spawnBrowserWorker): OpenWorker {
  return async ({ name, script, onToolsChanged, lost }) => {
    const url = URL.createObjectURL(script);
    let revoked = false;
    const revoke = () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    };

    const worker = spawn(url, name);
    worker.addEventListener('error', (event: ErrorEvent) => {
      lost(new Error(`worker of MCP server ${name} failed: ${event.message || 'script error'}`));
    });
    worker.addEventListener('messageerror', () => {
      lost(new Error(`worker of MCP server ${name} sent a message that cannot be read`));
    });

    const transport = createPortTransport(worker, {
      onClose: () => {
        worker.terminate();
        revoke();
      },
    });
    const client = newClient({ onToolsChanged, lost });
    try {
      await client.connect(transport, { timeout: TIMEOUTS.connectMs });
    } catch (error) {
      worker.terminate();
      revoke();
      throw error;
    }
    revoke();
    return sessionOf(client);
  };
}

/** Открыть удалённый сервер. `fetch` — для тестов; в браузере — настоящий. */
export function createRemoteOpener(fetchImpl?: typeof fetch): OpenRemote {
  return async ({ name, kind, url, headers, onToolsChanged, lost }) => {
    const target = new URL(url);
    const options = {
      requestInit: { headers: { ...headers } },
      ...(fetchImpl === undefined ? {} : { fetch: fetchImpl }),
    };

    const attempt = async (transport: Transport) => {
      const client = newClient({ onToolsChanged, lost });
      await client.connect(transport, { timeout: TIMEOUTS.connectMs });
      // Сессия, оборвавшаяся сама, — падение; закрытие по нашей воле диспетчер отличит сам.
      client.onclose = () => lost(new Error(`connection to MCP server ${name} closed`));
      return client;
    };

    try {
      if (kind === 'sse') return sessionOf(await attempt(new SSEClientTransport(target, options)));

      const http = new StreamableHTTPClientTransport(target, options);
      try {
        const client = await attempt(http);
        // `DELETE` сессии при закрытии: сервер отпускает её сразу, а не по своему таймауту.
        return sessionOf(client, () => http.terminateSession());
      } catch (error) {
        if (!isLegacyServer(error)) throw error;
        return sessionOf(await attempt(new SSEClientTransport(target, options)));
      }
    } catch (error) {
      throw describeRemoteError(name, error);
    }
  };
}

/** 4xx на `initialize`, кроме авторизации, — сервер старой редакции протокола. */
function isLegacyServer(error: unknown): boolean {
  return (
    error instanceof StreamableHTTPError &&
    error.code !== undefined &&
    error.code >= 400 &&
    error.code < 500 &&
    error.code !== 401 &&
    error.code !== 403
  );
}

/** Ошибка подключения словами, по которым ясно, что чинить. */
function describeRemoteError(name: string, error: unknown): Error {
  if (error instanceof StreamableHTTPError && (error.code === 401 || error.code === 403)) {
    return new Error(
      `MCP server ${name} requires authorization (HTTP ${error.code}): set the header value via \${VAR} in the MCP panel`
    );
  }
  if (error instanceof TypeError) {
    return new Error(
      `MCP server ${name} is unreachable from the browser (CORS or network): the server must allow this origin`
    );
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`MCP server ${name}: ${message}`);
}
