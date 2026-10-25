/**
 * Менеджер MCP-серверов проекта: что известно о каждом, как к нему подключиться, что он умеет.
 *
 * Держит то, что переживает сон воркера: конфигурацию серверов, список их инструментов, текст
 * скриптов бандлов и значения `${VAR}`. Сессиями не распоряжается — их открывает и закрывает
 * диспетчер (`./supervisor`), а менеджер берёт аренду на время одного дела: список инструментов,
 * один вызов.
 *
 * ## Что не запускает сервер
 *
 * Список инструментов, уже прочитанный однажды, отдаётся из памяти: `mcp_tools` по спящему
 * серверу не будит его. Перечитывается он, когда сервер сам сказал, что список изменился
 * (`list_changed`), при перечитывании конфигурации и при смене проекта.
 *
 * ## Недоступный и упавший — разные исходы
 *
 * «Недоступен» — сервер нельзя запустить в принципе, пока не изменится конфигурация: stdio,
 * несобранный бандл, источник не разрешает исполнять код, `http:` со страницы `https:`, нет
 * значений переменных. Такие серверы не открываются вовсе и падениями не считаются. «Ошибка» —
 * попытка была и не удалась; её учитывает диспетчер (пауза, предел попыток).
 *
 * @module plugins/forms/mcp/connection/manager
 */

import { discoverServers } from '../config/discover';
import { resolveRemote, variablesOf } from '../config/interpolate';
import {
  isLaunchable,
  type BundleServerSpec,
  type LaunchableServerSpec,
  type RemoteServerSpec,
  type ServerSpec,
} from '../config/types';
import type { McpHost } from '../host';
import { secretKeyOf } from '../secrets';
import type { McpCallResult, McpSession, McpTool, SessionOpeners } from './session';
import {
  createSupervisor,
  SupervisorError,
  type Clock,
  type Lease,
  type SupervisorPolicy,
} from './supervisor';

/** Почему сервер не запустить. */
export type UnavailableReason =
  | 'stdio'
  | 'not-built'
  | 'invalid'
  | 'mixed-content'
  | 'no-code-execution'
  | 'unreadable';

export type ServerStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'starting' }
  | { readonly kind: 'running' }
  | { readonly kind: 'asleep' }
  | { readonly kind: 'needs-values'; readonly missing: readonly string[] }
  | { readonly kind: 'error'; readonly message: string; readonly halted: boolean }
  | { readonly kind: 'unavailable'; readonly reason: UnavailableReason; readonly detail?: string };

/** Сервер в снимке состояния. */
export interface ServerView {
  readonly spec: ServerSpec;
  readonly status: ServerStatus;
  /** Инструменты из последнего `tools/list`; `undefined` — ещё не читались. */
  readonly tools?: readonly McpTool[];
  /** Переменные `${VAR}` удалённого сервера и есть ли у них значения. */
  readonly variables: readonly { readonly name: string; readonly set: boolean }[];
  readonly notes: readonly string[];
}

export interface McpSnapshot {
  readonly servers: readonly ServerView[];
  readonly problems: readonly string[];
  readonly liveWorkers: number;
  readonly maxLive: number;
  /** Есть ли сервер, к которому можно подключиться: от этого зависит, давать ли модели инструменты. */
  readonly launchable: boolean;
}

/** Ошибка для модели — коды словаря ошибок ассистента. */
export interface ManagerError {
  readonly code: 'NOT_FOUND' | 'UNAVAILABLE' | 'FAILED';
  readonly message: string;
  readonly suggestions?: readonly string[];
}

export type Outcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ManagerError };

export interface McpManager {
  snapshot(): McpSnapshot;
  subscribe(listener: () => void): () => void;
  /** Перечитать конфигурацию серверов; открытые сессии закрываются. */
  reload(): Promise<void>;
  /** Инструменты сервера — из памяти или, впервые, с сервера. */
  tools(server: string, signal?: AbortSignal): Promise<Outcome<readonly McpTool[]>>;
  call(
    server: string,
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<Outcome<McpCallResult>>;
  /** Подключиться сейчас и прочитать инструменты — кнопка панели. */
  connect(server: string): Promise<Outcome<readonly McpTool[]>>;
  /** Забыть падения и подключиться заново. */
  reconnect(server: string): Promise<Outcome<readonly McpTool[]>>;
  /** Усыпить сервер; `false` — он занят вызовом. */
  sleep(server: string): Promise<boolean>;
  /** Значение переменной `${VAR}` — в секреты плагина. */
  setVariable(name: string, value: string, options?: { readonly persist?: boolean }): Promise<void>;
  dispose(): Promise<void>;
}

export interface ManagerOptions {
  readonly host: McpHost;
  readonly openers: SessionOpeners;
  readonly policy?: Partial<SupervisorPolicy>;
  readonly clock?: Clock;
  /** Протокол страницы — для правила смешанного содержимого; по умолчанию — `location`. */
  readonly pageProtocol?: () => string | undefined;
}

/** Предел чтения скрипта сервера-бандла: корпус ReFormer — около 4,5 МБ, запас — втрое. */
export const MAX_SCRIPT_BYTES = 16 * 1024 * 1024;

const pageProtocolOf = (): string | undefined =>
  (globalThis as { location?: { protocol?: string } }).location?.protocol;

/** Адрес `http:` не на этой машине со страницы `https:` браузер не откроет. */
export function isMixedContent(url: string, pageProtocol: string | undefined): boolean {
  if (pageProtocol !== 'https:' || !url.toLowerCase().startsWith('http:')) return false;
  try {
    const { hostname } = new URL(url);
    return !['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

/** Собрать менеджер. Конфигурация читается `reload()` — его зовёт плагин на активации. */
export function createMcpManager(options: ManagerOptions): McpManager {
  const { host, openers } = options;
  const pageProtocol = options.pageProtocol ?? pageProtocolOf;

  let specs: readonly ServerSpec[] = [];
  let problems: readonly string[] = [];
  const toolsCache = new Map<string, readonly McpTool[]>();
  const scripts = new Map<string, Blob>();
  const unreadable = new Map<string, string>();
  const values = new Map<string, string>();
  const listeners = new Set<() => void>();
  let cached: McpSnapshot | undefined;

  const notify = () => {
    cached = undefined;
    for (const listener of [...listeners]) listener();
  };

  const supervisor = createSupervisor<McpSession>({
    ...(options.policy === undefined ? {} : { policy: options.policy }),
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    onChange: notify,
    open: (target, lost) => open(target.name, lost),
  });

  const specOf = (name: string) => specs.find((spec) => spec.name === name);

  /** Почему сервер не запустить сейчас; `null` — запускать можно. */
  const blockerOf = (spec: ServerSpec): ServerStatus | null => {
    switch (spec.kind) {
      case 'invalid':
        return { kind: 'unavailable', reason: 'invalid', detail: spec.problem };
      case 'stdio':
        return { kind: 'unavailable', reason: 'stdio' };
      case 'bundle': {
        if (spec.script === null) return { kind: 'unavailable', reason: 'not-built' };
        if (!host.executesCode(spec.script))
          return { kind: 'unavailable', reason: 'no-code-execution' };
        const problem = unreadable.get(spec.name);
        return problem === undefined
          ? null
          : { kind: 'unavailable', reason: 'unreadable', detail: problem };
      }
      default: {
        const resolved = resolveRemote(spec, Object.fromEntries(values));
        if (!resolved.ok) return { kind: 'needs-values', missing: resolved.missing };
        if (isMixedContent(resolved.url, pageProtocol()))
          return { kind: 'unavailable', reason: 'mixed-content' };
        return null;
      }
    }
  };

  const statusOf = (spec: ServerSpec): ServerStatus => {
    const blocker = blockerOf(spec);
    if (blocker !== null) return blocker;
    const status = supervisor.status(spec.name);
    switch (status.phase) {
      case 'starting':
        return { kind: 'starting' };
      case 'running':
        return { kind: 'running' };
      case 'crashed':
        return { kind: 'error', message: status.error ?? 'unknown error', halted: status.halted };
      default:
        return toolsCache.has(spec.name) ? { kind: 'asleep' } : { kind: 'idle' };
    }
  };

  const viewOf = (spec: ServerSpec): ServerView => {
    const tools = toolsCache.get(spec.name);
    return {
      spec,
      status: statusOf(spec),
      ...(tools === undefined ? {} : { tools }),
      variables:
        spec.kind === 'http' || spec.kind === 'sse'
          ? variablesOf(spec).map((name) => ({ name, set: values.has(name) }))
          : [],
      notes:
        spec.kind === 'bundle' || spec.kind === 'http' || spec.kind === 'sse' ? spec.notes : [],
    };
  };

  /** Текст скрипта бандла — один раз на проект: пробуждение не перечитывает мегабайты. */
  const scriptOf = async (spec: BundleServerSpec): Promise<Blob> => {
    const known = scripts.get(spec.name);
    if (known !== undefined) return known;
    const read = await host.readScript(spec.script!, MAX_SCRIPT_BYTES);
    if (!read.ok) {
      unreadable.set(spec.name, read.error.message);
      notify();
      throw new Error(`server.js of MCP server ${spec.name} cannot be read: ${read.error.message}`);
    }
    const blob = new Blob([read.value.text], { type: 'text/javascript' });
    scripts.set(spec.name, blob);
    return blob;
  };

  const onToolsChanged = (name: string) => (tools: McpTool[]) => {
    toolsCache.set(name, tools);
    notify();
  };

  const open = async (name: string, lost: (error: Error) => void): Promise<McpSession> => {
    const spec = specOf(name);
    if (spec === undefined || !isLaunchable(spec))
      throw new Error(`MCP server ${name} is not configured`);
    if (spec.kind === 'bundle') {
      return openers.worker({
        name,
        script: await scriptOf(spec),
        onToolsChanged: onToolsChanged(name),
        lost,
      });
    }
    const resolved = resolveRemote(spec, Object.fromEntries(values));
    if (!resolved.ok)
      throw new Error(`MCP server ${name} needs values: ${resolved.missing.join(', ')}`);
    return openers.remote({
      name,
      kind: spec.kind,
      url: resolved.url,
      headers: resolved.headers,
      onToolsChanged: onToolsChanged(name),
      lost,
    });
  };

  /** Сервер, к которому можно идти, либо ошибка для модели. */
  const launchable = (name: string): Outcome<LaunchableServerSpec> => {
    const spec = specOf(name);
    if (spec === undefined) {
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: `No MCP server "${name}" in this project.`,
          suggestions: specs.map((known) => known.name),
        },
      };
    }
    const blocker = blockerOf(spec);
    if (blocker !== null)
      return { ok: false, error: { code: 'UNAVAILABLE', message: blockedMessage(name, blocker) } };
    return { ok: true, value: spec as LaunchableServerSpec };
  };

  const targetOf = (spec: LaunchableServerSpec) => ({
    name: spec.name,
    kind: spec.kind === 'bundle' ? ('worker' as const) : ('remote' as const),
    ...(spec.kind === 'bundle' && spec.idleSeconds !== undefined
      ? { idleSeconds: spec.idleSeconds }
      : {}),
  });

  /** Сделать дело на арендованной сессии; ошибки — словами для модели. */
  const withSession = async <T>(
    spec: LaunchableServerSpec,
    work: (session: McpSession) => Promise<T>,
    signal?: AbortSignal
  ): Promise<Outcome<T>> => {
    let lease: Lease<McpSession>;
    try {
      lease = await supervisor.acquire(targetOf(spec));
    } catch (error) {
      return { ok: false, error: { code: 'UNAVAILABLE', message: messageOf(error) } };
    }
    try {
      return { ok: true, value: await work(lease.session) };
    } catch (error) {
      if (signal?.aborted)
        return { ok: false, error: { code: 'FAILED', message: 'The turn was stopped.' } };
      const timedOut = /timed? ?out/i.test(messageOf(error));
      return {
        ok: false,
        error: {
          code: timedOut ? 'UNAVAILABLE' : 'FAILED',
          message: `MCP server ${spec.name}: ${messageOf(error)}`,
        },
      };
    } finally {
      lease.release();
    }
  };

  const listFresh = async (spec: LaunchableServerSpec, signal?: AbortSignal) => {
    const outcome = await withSession(spec, (session) => session.listTools(signal), signal);
    if (outcome.ok) {
      toolsCache.set(spec.name, outcome.value);
      notify();
    }
    return outcome;
  };

  const connect = async (server: string): Promise<Outcome<readonly McpTool[]>> => {
    const spec = launchable(server);
    if (!spec.ok) return spec;
    return listFresh(spec.value);
  };

  return {
    snapshot() {
      cached ??= {
        servers: specs.map(viewOf),
        problems,
        liveWorkers: supervisor.liveWorkers(),
        maxLive: supervisor.policy.maxLive,
        launchable: specs.some(isLaunchable),
      };
      return cached;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async reload() {
      await supervisor.closeAll();
      toolsCache.clear();
      scripts.clear();
      unreadable.clear();
      const discovered = await discoverServers(host);
      specs = discovered.servers;
      problems = discovered.problems;
      // Значения переменных — из секретов: введённые однажды за сессию не спрашиваются снова.
      const names = specs.flatMap((spec) =>
        spec.kind === 'http' || spec.kind === 'sse' ? variablesOf(spec) : []
      );
      await Promise.all(
        names.map(async (name) => {
          const value = await host.secrets.get(secretKeyOf(name)).catch(() => undefined);
          if (value !== undefined && value !== '') values.set(name, value);
        })
      );
      notify();
    },

    async tools(server, signal) {
      const spec = launchable(server);
      if (!spec.ok) return spec;
      const known = toolsCache.get(server);
      if (known !== undefined) return { ok: true, value: known };
      return listFresh(spec.value, signal);
    },

    async call(server, tool, args, signal) {
      const spec = launchable(server);
      if (!spec.ok) return spec;
      const started = typeof performance === 'undefined' ? 0 : performance.now();
      const outcome = await withSession(
        spec.value,
        async (session) => {
          // Список — в той же аренде, если его ещё нет: неизвестное имя модель узнает с
          // подсказками, а статус сервера покажет его инструменты.
          if (!toolsCache.has(server)) {
            toolsCache.set(server, await session.listTools(signal));
            notify();
          }
          const known = toolsCache.get(server)!;
          if (!known.some((candidate) => candidate.name === tool)) return null;
          return session.callTool(tool, args, signal);
        },
        signal
      );
      measure(`rb:mcp.call:${server}`, started);
      if (outcome.ok && outcome.value === null) {
        return {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: `MCP server ${server} has no tool "${tool}".`,
            suggestions: (toolsCache.get(server) ?? []).map((candidate) => candidate.name),
          },
        };
      }
      return outcome as Outcome<McpCallResult>;
    },

    connect,

    async reconnect(server) {
      supervisor.reset(server);
      unreadable.delete(server);
      scripts.delete(server);
      await supervisor.sleep(server);
      return connect(server);
    },

    sleep: (server) => supervisor.sleep(server),

    async setVariable(name, value, opts) {
      if (value === '') {
        values.delete(name);
        await host.secrets.delete(secretKeyOf(name)).catch(() => undefined);
      } else {
        values.set(name, value);
        await host.secrets.set(
          secretKeyOf(name),
          value,
          opts?.persist ? { persist: true } : undefined
        );
      }
      // Серверы с этой переменной могли упасть на старом значении — начать с чистого листа.
      for (const spec of specs) {
        if (
          (spec.kind === 'http' || spec.kind === 'sse') &&
          variablesOf(spec as RemoteServerSpec).includes(name)
        ) {
          supervisor.reset(spec.name);
          await supervisor.sleep(spec.name);
        }
      }
      notify();
    },

    async dispose() {
      listeners.clear();
      await supervisor.closeAll();
    },
  };
}

function messageOf(error: unknown): string {
  return error instanceof SupervisorError || error instanceof Error ? error.message : String(error);
}

/** Почему сервер недоступен — фразой для модели. */
function blockedMessage(name: string, status: ServerStatus): string {
  if (status.kind === 'needs-values') {
    return `MCP server ${name} needs values for ${status.missing.join(', ')}: ask the user to set them in the MCP panel.`;
  }
  if (status.kind !== 'unavailable') return `MCP server ${name} is unavailable.`;
  switch (status.reason) {
    case 'stdio':
      return `MCP server ${name} runs as a local process (stdio) and cannot be started from the browser.`;
    case 'not-built':
      return `MCP server ${name} has no server.js yet.`;
    case 'no-code-execution':
      return `The project source does not allow running code, so MCP server ${name} cannot start.`;
    case 'mixed-content':
      return `MCP server ${name} uses http: and the builder page is https:, so the browser blocks it.`;
    default:
      return `MCP server ${name} is unavailable: ${status.detail ?? status.reason}.`;
  }
}

function measure(name: string, start: number): void {
  try {
    if (typeof performance !== 'undefined') performance.measure(name, { start });
  } catch {
    // Замер — не повод ронять вызов.
  }
}
