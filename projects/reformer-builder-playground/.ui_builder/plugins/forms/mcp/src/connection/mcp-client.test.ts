/**
 * Клиент MCP: воркер с настоящим сервером ReFormer и удалённый сервер на подменённом `fetch`.
 *
 * «Воркер» — конец `MessageChannel` с сервером из `@reformer/mcp` (собранный `dist`): тот же
 * контракт порта, что у `Worker`. Удалённый сервер — минимальный Streamable HTTP: ответы JSON,
 * идентификатор сессии в заголовке, `GET` потока не поддержан (405), как у многих серверов. Рядом —
 * сервер прежней редакции (HTTP+SSE), на который клиент откатывается по 4xx.
 *
 * @module plugins/forms/mcp/connection/mcp-client.test
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { startWorkerServer } from '@reformer/mcp/dist/platform/worker/server.js';
import { createRemoteOpener, createWorkerOpener, type WorkerLike } from './mcp-client';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../../../..'
);

/** Корпус знаний из `llms*` пакетов — как его вшивает сборка бандла. */
function corpus() {
  const index = { schemaVersion: 1, builtAt: '', packages: {} as Record<string, unknown> };
  const docs = { schemaVersion: 1, builtAt: '', packages: {} as Record<string, string> };
  for (const [pkg, dir] of [
    ['@reformer/core', 'reformer'],
    ['@reformer/mcp', 'reformer-mcp'],
  ] as const) {
    const base = path.join(repoRoot, 'packages', dir);
    index.packages[pkg] = JSON.parse(readFileSync(path.join(base, 'llms-index.json'), 'utf8'));
    docs.packages[pkg] = readFileSync(path.join(base, 'llms.txt'), 'utf8');
  }
  return { index, docs } as never;
}

const hasCorpus = existsSync(path.join(repoRoot, 'packages', 'reformer', 'llms-index.json'));

const channels: MessageChannel[] = [];
afterEach(() => {
  for (const channel of channels.splice(0)) {
    channel.port1.close();
    channel.port2.close();
  }
});

/** «Воркер» над `MessageChannel`: на другом конце — сервер ReFormer. */
function spawnInProcess(terminated: string[]) {
  return (_url: string, name: string): WorkerLike => {
    const channel = new MessageChannel();
    channels.push(channel);
    startWorkerServer({ port: channel.port2 as never, version: '0.0.0-test', corpus });
    const port = channel.port1;
    return {
      postMessage: (message: unknown) => port.postMessage(message),
      addEventListener: (type: string, listener: never) =>
        port.addEventListener(type as 'message', listener),
      removeEventListener: (type: string, listener: never) =>
        port.removeEventListener(type as 'message', listener),
      terminate: () => {
        terminated.push(name);
        port.close();
      },
    } as unknown as WorkerLike;
  };
}

const events = { onToolsChanged: () => undefined, lost: () => undefined };

describe.runIf(hasCorpus)('воркер сервера-бандла', () => {
  it('подключение, список и вызов; закрытие останавливает воркер', async () => {
    const terminated: string[] = [];
    const open = createWorkerOpener(spawnInProcess(terminated));
    const session = await open({
      name: 'reformer',
      script: new Blob(['/* скрипт не исполняется: воркер — двойник */']),
      ...events,
    });

    const tools = await session.listTools();
    expect(tools.map((tool) => tool.name)).toContain('choose_api');
    const result = await session.callTool('choose_api', {
      requirement: 'total = price * quantity',
    });
    expect(JSON.stringify(result.content)).toContain('computeFrom');

    await session.close();
    expect(terminated).toEqual(['reformer']);
  });
});

interface RpcRequest {
  readonly id?: number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

/** Ответ фейкового сервера на запрос — общий у обеих редакций транспорта. */
function resultOf(body: RpcRequest) {
  if (body.method === 'initialize') {
    return {
      protocolVersion: body.params?.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'fake-remote', version: '1.0.0' },
    };
  }
  if (body.method === 'tools/list') {
    return { tools: [{ name: 'search', inputSchema: { type: 'object' } }] };
  }
  return { content: [{ type: 'text', text: `found ${JSON.stringify(body.params?.arguments)}` }] };
}

/** Минимальный Streamable HTTP-сервер поверх `fetch`. */
function fakeRemote(options: { status?: number; throws?: boolean } = {}) {
  const seen: { method: string; rpc?: string; authorization: string | null }[] = [];
  const fetchImpl = async (
    _input: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> => {
    if (options.throws) throw new TypeError('Failed to fetch');
    const method = init?.method ?? 'GET';
    const headers = new Headers(init?.headers);
    if (method !== 'POST') {
      seen.push({ method, authorization: headers.get('authorization') });
      return new Response(null, { status: method === 'GET' ? 405 : 200 });
    }
    const body = JSON.parse(String(init?.body)) as RpcRequest;
    seen.push({ method, rpc: body.method, authorization: headers.get('authorization') });
    if (options.status !== undefined) return new Response('denied', { status: options.status });
    if (body.id === undefined) return new Response(null, { status: 202 });

    return new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: resultOf(body) }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'mcp-session-id': 'session-1' },
    });
  };
  return { fetchImpl: fetchImpl as typeof fetch, seen };
}

/**
 * Сервер прежней редакции (HTTP+SSE): `POST` на адрес — 405, `GET` открывает поток событий,
 * первое событие называет адрес для сообщений, ответы приходят в поток.
 */
function fakeLegacyRemote() {
  const seen: { method: string; url: string; rpc?: string }[] = [];
  const encoder = new TextEncoder();
  let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
  const push = (event: string, data: string) =>
    stream?.enqueue(
      encoder.encode(`event: ${event}
data: ${data}

`)
    );

  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      seen.push({ method, url });
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          stream = controller;
          push('endpoint', '/messages?session=legacy-1');
        },
      });
      return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    }
    const body = JSON.parse(String(init?.body)) as RpcRequest;
    seen.push({ method, url, rpc: body.method });
    if (!url.includes('/messages')) return new Response('method not allowed', { status: 405 });
    if (body.id !== undefined) {
      push('message', JSON.stringify({ jsonrpc: '2.0', id: body.id, result: resultOf(body) }));
    }
    return new Response(null, { status: 202 });
  };
  return { fetchImpl: fetchImpl as typeof fetch, seen, end: () => stream?.close() };
}

describe('удалённый сервер', () => {
  const input = {
    name: 'docs',
    kind: 'http' as const,
    url: 'https://docs.example/mcp',
    headers: { Authorization: 'Bearer token-1' },
    ...events,
  };

  it('Streamable HTTP: подключение, вызов, заголовки; закрытие — DELETE сессии', async () => {
    const remote = fakeRemote();
    const session = await createRemoteOpener(remote.fetchImpl)(input);
    expect((await session.listTools()).map((tool) => tool.name)).toEqual(['search']);
    const result = await session.callTool('search', { q: 'wizard' });
    expect(result.content[0]).toEqual({ type: 'text', text: 'found {"q":"wizard"}' });
    await session.close();

    expect(
      remote.seen.filter((request) => request.rpc !== undefined).map((request) => request.rpc)
    ).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
    expect(remote.seen.every((request) => request.authorization === 'Bearer token-1')).toBe(true);
    expect(remote.seen.some((request) => request.method === 'DELETE')).toBe(true);
  });

  it('сервер прежней редакции (4xx на POST) — тот же адрес по SSE', async () => {
    const remote = fakeLegacyRemote();
    const session = await createRemoteOpener(remote.fetchImpl)(input);
    expect((await session.listTools()).map((tool) => tool.name)).toEqual(['search']);
    const result = await session.callTool('search', { q: 'wizard' });
    expect(result.content[0]).toEqual({ type: 'text', text: 'found {"q":"wizard"}' });
    await session.close();
    remote.end();

    expect(remote.seen.map(({ method, url, rpc }) => [method, new URL(url).pathname, rpc])).toEqual(
      [
        ['POST', '/mcp', 'initialize'],
        ['GET', '/mcp', undefined],
        ['POST', '/messages', 'initialize'],
        ['POST', '/messages', 'notifications/initialized'],
        ['POST', '/messages', 'tools/list'],
        ['POST', '/messages', 'tools/call'],
      ]
    );
  });

  it('401 — ошибка про авторизацию и переменную', async () => {
    await expect(createRemoteOpener(fakeRemote({ status: 401 }).fetchImpl)(input)).rejects.toThrow(
      /requires authorization \(HTTP 401\)/
    );
  });

  it('сеть или CORS — ошибка про браузер, а не голое «Failed to fetch»', async () => {
    await expect(createRemoteOpener(fakeRemote({ throws: true }).fetchImpl)(input)).rejects.toThrow(
      /unreachable from the browser \(CORS or network\)/
    );
  });
});
