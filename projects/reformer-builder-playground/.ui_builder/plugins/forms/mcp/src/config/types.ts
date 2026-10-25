/**
 * Сервер MCP проекта — как его описали файлы проекта, до всякого подключения.
 *
 * Источников два, и вид сервера говорит, как к нему идти:
 *
 * - `bundle` — каталог `.ui_builder/mcp/<имя>/`: скрипт воркера и его настройки запуска;
 * - `http` / `sse` — запись `.mcp.json` с адресом: подключение из браузера;
 * - `stdio` — запись `.mcp.json` с командой: процесс из браузера не запустить, сервер виден
 *   только как «недоступен из браузера»;
 * - `invalid` — запись, которую разобрать не удалось: показывается причиной, а не пропадает.
 *
 * @module plugins/forms/mcp/config/types
 */

import type { ResourceId } from '@reformer/builder-plugin-api';

/** Сервер-бандл проекта. */
export interface BundleServerSpec {
  readonly kind: 'bundle';
  readonly name: string;
  /** Каталог сервера. */
  readonly dir: ResourceId;
  /** Скрипт воркера; `null` — сервер ещё не собран (`server.js` в каталоге нет). */
  readonly script: ResourceId | null;
  /** Сколько воркер живёт без вызовов; `undefined` — умолчание диспетчера. */
  readonly idleSeconds?: number;
  /** Замечания разбора `server.json`: неверное значение заменено умолчанием. */
  readonly notes: readonly string[];
}

/** Удалённый сервер из `.mcp.json`. Значения `${VAR}` ещё не подставлены. */
export interface RemoteServerSpec {
  readonly kind: 'http' | 'sse';
  readonly name: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly notes: readonly string[];
}

/** Сервер-процесс из `.mcp.json` — в браузере недоступен. */
export interface StdioServerSpec {
  readonly kind: 'stdio';
  readonly name: string;
  readonly command: string;
}

/** Запись, которую не разобрать. */
export interface InvalidServerSpec {
  readonly kind: 'invalid';
  readonly name: string;
  readonly problem: string;
}

export type ServerSpec = BundleServerSpec | RemoteServerSpec | StdioServerSpec | InvalidServerSpec;

/** Серверы, к которым можно подключиться из браузера. */
export type LaunchableServerSpec = BundleServerSpec | RemoteServerSpec;

/** Можно ли к серверу подключиться: бандл с собранным скриптом или удалённый по адресу. */
export function isLaunchable(spec: ServerSpec): spec is LaunchableServerSpec {
  return (
    (spec.kind === 'bundle' && spec.script !== null) || spec.kind === 'http' || spec.kind === 'sse'
  );
}

/**
 * Годится ли строка в имя сервера: оно же имя каталога бандла и ключ `.mcp.json`, и модель
 * пишет его аргументом инструментов.
 */
export function isServerName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(name);
}
