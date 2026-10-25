/**
 * Сессия MCP-сервера — то, что остальной плагин знает о соединении, без SDK.
 *
 * Клиент SDK тянет ajv и zod, и в главный чанк плагина ему нельзя: плагин активируется на старте
 * билдера у каждого, а MCP нужен немногим. Поэтому типы здесь свои и лёгкие, а сам клиент живёт
 * в отложенном модуле (`./mcp-client`), который грузится на первое подключение.
 *
 * @module plugins/forms/mcp/connection/session
 */

import type { Session } from './supervisor';

/** Инструмент сервера, как его отдал `tools/list`. */
export interface McpTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: object;
}

/** Часть ответа инструмента. Неизвестные виды фасад описывает строкой. */
export interface McpContent {
  readonly type: string;
  readonly text?: string;
  readonly mimeType?: string;
  readonly data?: string;
  readonly resource?: { readonly uri?: string; readonly text?: string; readonly mimeType?: string };
  readonly uri?: string;
}

/** Ответ `tools/call`. */
export interface McpCallResult {
  readonly content: readonly McpContent[];
  readonly structuredContent?: unknown;
  readonly isError?: boolean;
}

/** Открытое соединение с сервером. */
export interface McpSession extends Session {
  /** Все инструменты сервера (постранично, не больше {@link MAX_TOOLS}). */
  listTools(signal?: AbortSignal): Promise<McpTool[]>;
  callTool(
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<McpCallResult>;
}

/** Больше инструментов у одного сервера не читается: список уходит модели текстом. */
export const MAX_TOOLS = 200;

/**
 * Пределы ожидания. Вызов — меньше минуты: сторож канала к модели рвёт ход после 60 секунд
 * тишины и продолжает считать во время исполнения инструмента, а умолчание SDK — ровно 60.
 */
export const TIMEOUTS = Object.freeze({ connectMs: 15_000, listMs: 15_000, callMs: 45_000 });

/** Что открывающему нужно, чтобы сообщать о жизни сессии. */
export interface SessionEvents {
  /** Сервер сообщил, что список инструментов изменился, и прислал новый. */
  onToolsChanged(tools: McpTool[]): void;
  /** Сессия умерла сама — упал воркер или оборвался транспорт. */
  lost(error: Error): void;
}

/** Открыть воркер сервера-бандла из текста скрипта. */
export type OpenWorker = (
  input: { readonly name: string; readonly script: Blob } & SessionEvents
) => Promise<McpSession>;

/** Открыть удалённый сервер по адресу с уже подставленными значениями. */
export type OpenRemote = (
  input: {
    readonly name: string;
    readonly kind: 'http' | 'sse';
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
  } & SessionEvents
) => Promise<McpSession>;

/** Открывающие — отложенный модуль клиента; тесты подставляют свои. */
export interface SessionOpeners {
  readonly worker: OpenWorker;
  readonly remote: OpenRemote;
}
