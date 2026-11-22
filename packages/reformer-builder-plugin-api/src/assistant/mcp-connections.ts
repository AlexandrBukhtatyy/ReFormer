/**
 * Подключения MCP — серверы, которые человек настроил у ассистента, как служба для других плагинов.
 *
 * MCP-серверы проекта (`.mcp.json`, бандлы `.ui_builder/mcp/`) настраиваются на экране настроек
 * ассистента, там же вводятся их секреты. Плагину, которому нужен конкретный сервер — стеку форм,
 * который ходит в сервис компилятора, — не нужно своё подключение и свой ввод ключа: он объявляет
 * сервер здесь и зовёт его инструменты через то подключение, что настроил человек.
 *
 * Объявленный сервер — умолчание: запись `.mcp.json` с тем же именем главнее адресом и
 * заголовками, и человек может направить его на свой адрес. `internal` — сервер для плагина, а не
 * для модели: инструментами фасада ассистента (`mcp_tools`, `mcp_call`) он не виден, и запись
 * проекта поверх объявления этого не меняет.
 *
 * @module @reformer/builder-plugin-api/assistant/mcp-connections
 */

import { defineCapability } from '../primitives/capability.js';
import type { Disposable } from '../primitives/disposable.js';

/** Удалённый сервер, который объявляет плагин. `${VAR}` в адресе и заголовках — секреты. */
export interface McpServerDeclaration {
  readonly name: string;
  /** Streamable HTTP по умолчанию. */
  readonly kind?: 'http' | 'sse';
  readonly url: string;
  /** `Authorization: Bearer ${REFORMER_API_KEY}` — значение спросит экран настроек. */
  readonly headers?: Readonly<Record<string, string>>;
  /** Сервер для плагина, а не для модели: в фасаде ассистента его нет. */
  readonly internal?: boolean;
}

export type McpConnectionStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'asleep'
  | 'needs-values'
  | 'error'
  | 'unavailable';

/** Сервер в списке подключений. */
export interface McpServerSummary {
  readonly name: string;
  readonly status: McpConnectionStatus;
  readonly internal: boolean;
  /** Переменные `${VAR}` без значения — пока они есть, сервер не подключится. */
  readonly missing: readonly string[];
}

/** Ответ инструмента сервера либо почему его нет. */
export type McpToolOutcome =
  | {
      readonly ok: true;
      readonly content: ReadonlyArray<{ readonly type: string; readonly text?: string }>;
      readonly isError: boolean;
    }
  | {
      readonly ok: false;
      readonly code: 'NOT_FOUND' | 'UNAVAILABLE' | 'FAILED';
      readonly message: string;
    };

export interface McpConnections {
  /** Серверы проекта и объявленные — в том виде, в каком их видит экран настроек. */
  servers(): readonly McpServerSummary[];
  /** Список или статусы изменились. */
  subscribe(listener: () => void): Disposable;
  /** Вызвать инструмент сервера; соединение открывается по требованию. */
  callTool(
    server: string,
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<McpToolOutcome>;
  /** Объявить сервер. `dispose` — снять объявление. */
  declare(server: McpServerDeclaration): Disposable;
}

/** Возможность «подключения MCP». Вносит плагин MCP-серверов ассистента. */
export const McpConnectionsCapability = defineCapability<McpConnections>({
  id: 'reformer.mcp.connections',
  version: '1.0.0',
});
