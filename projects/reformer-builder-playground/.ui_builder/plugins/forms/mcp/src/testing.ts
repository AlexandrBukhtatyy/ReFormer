/**
 * Двойники для тестов плагина: проект картой файлов, секреты в памяти, сессии MCP по сценарию.
 *
 * @module plugins/forms/mcp/testing
 */

import type { ResourceRef } from '@reformer/builder-plugin-api';
import type { McpHost } from './host';
import type { McpCallResult, McpSession, McpTool, SessionOpeners } from './connection/session';
import type { Clock } from './connection/supervisor';

/** Корень проекта двойника. */
export const ROOT = 'project';

export interface FakeHost extends McpHost {
  readonly files: Map<string, string>;
  readonly secretValues: Map<string, string>;
  /** Сообщить подписчикам об изменении файлов. */
  emitFiles(changed: readonly string[]): void;
  /** Сообщить о смене проекта. */
  emitProject(): void;
  setRoot(root: string | null): void;
  setExecutesCode(allowed: boolean): void;
}

/** Проект картой «путь от корня → текст». */
export function createFakeHost(initial: Readonly<Record<string, string>> = {}): FakeHost {
  const files = new Map(Object.entries(initial).map(([path, text]) => [`${ROOT}/${path}`, text]));
  const secretValues = new Map<string, string>();
  const fileListeners = new Set<(changed: readonly string[]) => void>();
  const projectListeners = new Set<() => void>();
  let root: string | null = ROOT;
  let executes = true;

  const refOf = (id: string, kind: 'file' | 'directory'): ResourceRef => ({
    id,
    sourceId: 'fake',
    path: id,
    name: id.slice(id.lastIndexOf('/') + 1),
    kind,
    mediaType: kind === 'directory' ? 'inode/directory' : 'text/plain',
  });

  return {
    files,
    secretValues,
    projectRoot: () => root,
    resolve: (dir, ...segments) => [dir, ...segments].join('/'),
    async list(dir) {
      const prefix = `${dir}/`;
      const children = new Map<string, ResourceRef>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        const id = slash < 0 ? path : `${prefix}${rest.slice(0, slash)}`;
        if (!children.has(id)) children.set(id, refOf(id, slash < 0 ? 'file' : 'directory'));
      }
      return [...children.values()];
    },
    readText: async (id) => files.get(id) ?? null,
    async readScript(id) {
      const text = files.get(id);
      return text === undefined
        ? { ok: false, error: { kind: 'not-found', message: `${id} not found` } }
        : { ok: true, value: { text, mediaType: 'text/javascript' } };
    },
    executesCode: () => executes,
    onDidChangeFiles(cb) {
      fileListeners.add(cb);
      return { dispose: () => fileListeners.delete(cb) };
    },
    onDidChangeProject(cb) {
      projectListeners.add(cb);
      return { dispose: () => projectListeners.delete(cb) };
    },
    secrets: {
      get: async (key) => secretValues.get(key),
      set: async (key, value) => {
        secretValues.set(key, value);
      },
      delete: async (key) => {
        secretValues.delete(key);
      },
    },
    useTranslate: () => (key) => key,
    emitFiles: (changed) => fileListeners.forEach((listener) => listener(changed)),
    emitProject: () => projectListeners.forEach((listener) => listener()),
    setRoot: (next) => {
      root = next;
    },
    setExecutesCode: (allowed) => {
      executes = allowed;
    },
  };
}

/** Ручные часы: время двигает тест. */
export function createFakeClock(): Clock & { advance(ms: number): void; readonly time: number } {
  let time = 1_000;
  const timers = new Map<number, { at: number; callback: () => void }>();
  let next = 1;
  return {
    get time() {
      return time;
    },
    now: () => time,
    setTimeout(callback, ms) {
      const id = next++;
      timers.set(id, { at: time + ms, callback });
      return id;
    },
    clearTimeout(handle) {
      timers.delete(handle as number);
    },
    advance(ms) {
      time += ms;
      for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
        if (timer.at > time) continue;
        timers.delete(id);
        timer.callback();
      }
    },
  };
}

/** Сервер-двойник: инструменты и ответы вызовов. */
export interface FakeServer {
  readonly tools: McpTool[];
  call?(name: string, args: Record<string, unknown>): McpCallResult | Promise<McpCallResult>;
}

/** Что делали открывающие — для проверок. */
export interface FakeOpeners extends SessionOpeners {
  readonly opened: string[];
  readonly closed: string[];
  readonly calls: { server: string; tool: string; args: Record<string, unknown> }[];
  /** Последние события сессий — тест может «уронить» сессию или прислать новый список. */
  readonly events: Map<
    string,
    { lost(error: Error): void; onToolsChanged(tools: McpTool[]): void }
  >;
  /** Последний запрос удалённого открытия — адрес и заголовки после подстановок. */
  readonly remoteRequests: {
    name: string;
    url: string;
    headers: Readonly<Record<string, string>>;
  }[];
}

/** Открывающие над серверами-двойниками по имени. `fail` — имена, чьё открытие падает. */
export function createFakeOpeners(
  servers: Readonly<Record<string, FakeServer>>,
  fail: ReadonlySet<string> = new Set()
): FakeOpeners {
  const opened: string[] = [];
  const closed: string[] = [];
  const calls: FakeOpeners['calls'] = [];
  const events: FakeOpeners['events'] = new Map();
  const remoteRequests: FakeOpeners['remoteRequests'] = [];

  const session = (name: string): McpSession => ({
    listTools: async () => [...(servers[name]?.tools ?? [])],
    async callTool(tool, args) {
      calls.push({ server: name, tool, args });
      const server = servers[name];
      return (
        (await server?.call?.(tool, args)) ?? { content: [{ type: 'text', text: `${tool} ok` }] }
      );
    },
    close: async () => {
      closed.push(name);
    },
  });

  const open = async (
    name: string,
    lifecycle: { lost(error: Error): void; onToolsChanged(tools: McpTool[]): void }
  ) => {
    if (fail.has(name)) throw new Error(`cannot open ${name}`);
    opened.push(name);
    events.set(name, lifecycle);
    return session(name);
  };

  return {
    opened,
    closed,
    calls,
    events,
    remoteRequests,
    worker: ({ name, lost, onToolsChanged }) => open(name, { lost, onToolsChanged }),
    remote: ({ name, url, headers, lost, onToolsChanged }) => {
      remoteRequests.push({ name, url, headers });
      return open(name, { lost, onToolsChanged });
    },
  };
}

/** Инструмент-двойник. */
export function fakeTool(name: string, description = `${name} does things.`): McpTool {
  return { name, description, inputSchema: { type: 'object', properties: {} } };
}
