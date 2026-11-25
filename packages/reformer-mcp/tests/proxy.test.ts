/**
 * Тонкий клиент против фейкового сервиса: протокол хоста целиком на стороне клиента.
 *
 * Сервис — настоящий сервер SDK по Streamable HTTP (без сеансов, ответы JSON), но с одним
 * инструментом, который играет роль ядра: просит недостающий каталог (`need`), получает его
 * повтором, отвечает операциями записи (`ops`) и новым состоянием сеанса. Проверяется то, что
 * клиент делает сам: добирает, повторяет, пишет на диск, носит состояние и не показывает агенту
 * служебный блок протокола.
 *
 * @module @reformer/mcp/tests/proxy
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from '@modelcontextprotocol/sdk/types.js';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { HOST_META_KEY, type HostRequest } from '../src/contract/protocol.js';
import { createLocalHost } from '../src/host/local.js';
import { connectServiceProxy } from '../src/host/proxy.js';

/** Что сервис увидел в каждом вызове. */
const seen: HostRequest[] = [];

/** Сервер-двойник ядра на один HTTP-запрос — как у настоящего сервиса. */
function createFakeCore(): Server {
  const server = new Server(
    { name: 'fake-reformer', version: '1.0.0' },
    { capabilities: { tools: {} }, instructions: 'fake core' }
  );
  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [{ name: 'execute', inputSchema: { type: 'object' } }],
  }));
  server.setRequestHandler(CallToolRequestSchema, (request): CallToolResult => {
    const host = (request.params._meta?.[HOST_META_KEY] ?? {}) as HostRequest;
    seen.push(host);
    // Кэш сервиса вытеснил каталог кита: по одному отпечатку его не взять — просьба прислать.
    const form = host.dirs?.form;
    if (request.params.arguments?.kitMiss === true && form?.ok && form.kit?.json === undefined) {
      return {
        content: [{ type: 'text', text: 'need' }],
        _meta: { [HOST_META_KEY]: { v: 1, need: { kits: ['form'] } } },
      };
    }
    // Ядру нужен ещё каталог `shared`, которого в аргументах нет: клиент должен его добрать.
    const shared = host.dirs?.shared;
    if (!shared) {
      return {
        content: [{ type: 'text', text: 'need' }],
        _meta: { [HOST_META_KEY]: { v: 1, need: { dirs: ['shared'] } } },
      };
    }
    const previous = (host.state as { calls?: number } | undefined)?.calls ?? 0;
    const files = shared.ok ? Object.keys(shared.files).sort() : [];
    return {
      content: [{ type: 'text', text: `shared: ${files.join(', ')}` }],
      _meta: {
        [HOST_META_KEY]: {
          v: 1,
          ops: [{ op: 'write', dir: 'form', name: 'created.ts', content: 'export const x = 1;\n' }],
          state: { calls: previous + 1 },
        },
      },
    };
  });
  return server;
}

let http: HttpServer;
let url: string;
let project: string;

beforeAll(async () => {
  http = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body =
      chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString('utf-8')) : undefined;
    const server = createFakeCore();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, body);
  });
  await new Promise<void>((done) => http.listen(0, '127.0.0.1', done));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  http.closeAllConnections();
  await new Promise<void>((done) => http.close(() => done()));
});

afterEach(() => {
  seen.length = 0;
  if (project) rmSync(project, { recursive: true, force: true });
});

/** Проект на диске: `package.json` с зависимостью и каталог `shared` с одним файлом. */
function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'reformer-mcp-client-'));
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ dependencies: { react: '19' } }));
  mkdirSync(join(dir, 'shared'));
  writeFileSync(join(dir, 'shared', 'a.ts'), 'export {};\n');
  return dir;
}

/** Агент ↔ клиент — транспортом в памяти, клиент ↔ сервис — по HTTP. */
async function connectAgent() {
  project = makeProject();
  const proxy = await connectServiceProxy({
    url,
    version: '0.0.0-test',
    host: createLocalHost(project),
  });
  const [agentSide, proxySide] = InMemoryTransport.createLinkedPair();
  await proxy.connect(proxySide);
  const agent = new Client({ name: 'agent', version: '1.0.0' });
  await agent.connect(agentSide);
  return agent;
}

describe('тонкий клиент', () => {
  it('отдаёт агенту инструменты и инструкции сервиса', async () => {
    const agent = await connectAgent();
    expect((await agent.listTools()).tools.map((tool) => tool.name)).toEqual(['execute']);
    expect(agent.getInstructions()).toBe('fake core');
    await agent.close();
  });

  it('добирает недостающее, повторяет вызов, пишет на диск и носит состояние', async () => {
    const agent = await connectAgent();
    const result = await agent.callTool({ name: 'execute', arguments: { dir: 'form' } });

    // Первый вызов — без `shared`, второй — с ним: клиент добрал каталог сам.
    expect(seen).toHaveLength(2);
    expect(seen[0]!.dirs?.shared).toBeUndefined();
    expect(seen[1]!.dirs?.shared).toMatchObject({ ok: true, files: { 'a.ts': 'export {};\n' } });
    // Агенту — ответ ядра, без служебного блока протокола.
    expect(result.content).toEqual([{ type: 'text', text: 'shared: a.ts' }]);
    expect(JSON.stringify(result._meta ?? {})).not.toContain(HOST_META_KEY);
    // Операция записи легла в каталог формы на диске.
    expect(readFileSync(join(project, 'form', 'created.ts'), 'utf-8')).toBe(
      'export const x = 1;\n'
    );

    // Следующий вызов несёт состояние, которое вернул сервис.
    await agent.callTool({ name: 'execute', arguments: { dir: 'form' } });
    expect(seen.at(-1)!.state).toEqual({ calls: 1 });
    await agent.close();
  });

  it('кит каталога формы: целиком один раз, дальше отпечаток; промах сервиса — целиком снова', async () => {
    const agent = await connectAgent();
    // Приложение на Vue со своим китом: пакет с каталогом в `node_modules`.
    const kitRoot = join(project, 'node_modules', '@acme', 'kit');
    mkdirSync(kitRoot, { recursive: true });
    writeFileSync(
      join(kitRoot, 'package.json'),
      JSON.stringify({ name: '@acme/kit', exports: { './catalog': './catalog.json' } })
    );
    writeFileSync(
      join(kitRoot, 'catalog.json'),
      JSON.stringify({ kit: { package: '@acme/kit', framework: 'vue' }, components: [] })
    );
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify({ dependencies: { vue: '3', '@acme/kit': '1' } })
    );
    const kitOf = () => {
      const form = seen.at(-1)!.dirs?.form;
      return form?.ok ? form.kit : undefined;
    };

    await agent.callTool({ name: 'execute', arguments: { dir: 'form' } });
    const first = kitOf();
    expect(first).toMatchObject({ json: { kit: { package: '@acme/kit', framework: 'vue' } } });

    await agent.callTool({ name: 'execute', arguments: { dir: 'form' } });
    expect(kitOf()).toEqual({ hash: first!.hash });

    const before = seen.length;
    await agent.callTool({ name: 'execute', arguments: { dir: 'form', kitMiss: true } });
    expect(seen.length).toBeGreaterThan(before + 1);
    expect(kitOf()).toMatchObject({ hash: first!.hash, json: { kit: { package: '@acme/kit' } } });
    await agent.close();
  });

  it('статус платформы — у клиента: пакеты проекта и проверка типов', async () => {
    project = makeProject();
    const status = createLocalHost(project).platform() as {
      packages: Array<{ name: string }>;
      typecheck: { available: boolean };
    };
    expect(status.packages.map((pkg) => pkg.name)).toContain('@reformer/core');
    expect(typeof status.typecheck.available).toBe('boolean');
  });

  it('сервис недоступен — подключение отказывает, а не висит', async () => {
    project = makeProject();
    await expect(
      connectServiceProxy({
        url: 'http://127.0.0.1:9',
        version: '0.0.0-test',
        host: createLocalHost(project),
        timeoutMs: 2_000,
      })
    ).rejects.toThrow();
  });
});
