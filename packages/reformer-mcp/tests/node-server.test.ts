/**
 * Контракт сервера под Node — настоящим клиентом SDK: промпты, отказы по протоколу, отладочный
 * режим, шаблоны ресурсов, журнал вызовов.
 *
 * Большая часть идёт поверх транспорта в памяти. Один набор запускает собранный `dist/index.js`
 * через stdio: только там проверяются чтение версии и `REFORMER_TRACE_FILE` от начала до конца.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { afterEach, describe, expect, it } from 'vitest';
import type { ReformerServerCall } from '../src/core/server/mount';
import { createNodeServer, type NodeServerOptions } from '../src/platform/cli/server';
import { precondition } from './support/preconditions';

const packageRoot = resolve(__dirname, '..');
const distEntry = resolve(packageRoot, 'dist/index.js');
const hasDist = precondition(
  'сборка сервера',
  existsSync(distEntry),
  'npm run build -w @reformer/mcp'
);

const LISTED_PROMPTS = [
  'start-here',
  'discover-context',
  'review',
  'plan-form',
  'create-form',
  'add-feature',
  'to-renderer',
];

const clients: Client[] = [];

async function connect(options: Partial<NodeServerOptions> = {}): Promise<Client> {
  const server = createNodeServer({ version: '1.2.3', debug: false, ...options });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'node-server-test', version: '0.0.0' });
  await client.connect(clientTransport);
  clients.push(client);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

async function protocolError(call: Promise<unknown>): Promise<McpError> {
  const error = await call.then(
    () => null,
    (reason: unknown) => reason
  );
  expect(error).toBeInstanceOf(McpError);
  return error as McpError;
}

describe('сервер под Node: инструкции', () => {
  it('ведут агента к form_build, не к чтению справки', async () => {
    const client = await connect();
    expect(client.getInstructions()).toContain('form_build');
    expect(client.getInstructions()?.length).toBeLessThan(500);
  });
});

describe('сервер под Node: промпты', () => {
  it('prompts/list отдаёт семь промптов в порядке объявления', async () => {
    const client = await connect();
    const { prompts } = await client.listPrompts();
    expect(prompts.map((prompt) => prompt.name)).toEqual(LISTED_PROMPTS);
  });

  it('каждый промпт отдаёт сообщения при заполненных обязательных аргументах', async () => {
    const client = await connect();
    const { prompts } = await client.listPrompts();
    const values: Record<string, string> = {
      code: 'const form = createForm();',
      description: 'форма входа',
      specPath: join(packageRoot, 'tests/fixtures/spec-loan-request.md'),
      requirements: 'добавить поле',
      feature: 'массив',
    };
    for (const prompt of prompts) {
      const promptArguments = Object.fromEntries(
        (prompt.arguments ?? []).filter((a) => a.required).map((a) => [a.name, values[a.name]])
      );
      const result = await client.getPrompt({ name: prompt.name, arguments: promptArguments });
      expect(result.messages.length, prompt.name).toBeGreaterThan(0);
    }
  });

  it('неизвестный промпт — InvalidParams', async () => {
    const client = await connect();
    const error = await protocolError(client.getPrompt({ name: 'no-such-prompt' }));
    expect(error.code).toBe(ErrorCode.InvalidParams);
    expect(error.message).toContain('no-such-prompt');
  });

  it('промпт без обязательного аргумента — InvalidParams с именем аргумента', async () => {
    const client = await connect();
    const error = await protocolError(client.getPrompt({ name: 'review' }));
    expect(error.code).toBe(ErrorCode.InvalidParams);
    expect(error.message).toContain('`code`');
  });
});

describe('сервер под Node: отладочный режим', () => {
  it('без флага debug нет ни промпта, ни инструмента, ни ресурса', async () => {
    const client = await connect({ debug: false });
    const { prompts } = await client.listPrompts();
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    expect(prompts.map((prompt) => prompt.name)).not.toContain('debug');
    expect(tools.map((tool) => tool.name)).not.toContain('debug');
    expect(resources.map((resource) => resource.uri)).not.toContain('reformer://debug');
    const error = await protocolError(
      client.getPrompt({ name: 'debug', arguments: { code: 'x' } })
    );
    expect(error.code).toBe(ErrorCode.InvalidParams);
  });

  it('с флагом debug появляются промпт, инструмент и ресурс', async () => {
    const client = await connect({ debug: true });
    const { prompts } = await client.listPrompts();
    const { tools } = await client.listTools();
    const { resources } = await client.listResources();
    expect(prompts.map((prompt) => prompt.name)).toContain('debug');
    expect(tools.map((tool) => tool.name)).toContain('debug');
    expect(resources.map((resource) => resource.uri)).toContain('reformer://debug');
  });
});

describe('сервер под Node: ресурсы', () => {
  it('resources/templates/list отдаёт схему адресов секций', async () => {
    const client = await connect();
    const { resourceTemplates } = await client.listResourceTemplates();
    expect(resourceTemplates.map((template) => template.uriTemplate)).toContain(
      'reformer://docs/{package}/{slug}'
    );
  });

  it('инициализация сообщает переданную версию', async () => {
    const client = await connect({ version: '9.9.9' });
    expect(client.getServerVersion()).toMatchObject({ name: 'reformer-mcp', version: '9.9.9' });
  });
});

describe('наблюдатель вызовов', () => {
  it('видит инструмент, ресурс и промпт, включая отказы', async () => {
    const calls: ReformerServerCall[] = [];
    const client = await connect({ onCall: (call) => calls.push(call) });

    await client.listTools();
    expect(calls, 'списки в журнал не попадают').toEqual([]);

    await client.callTool({
      name: 'choose_api',
      arguments: { requirement: 'итог = цена × кол-во' },
    });
    await client.callTool({ name: 'choose_api', arguments: {} });
    await client.readResource({ uri: 'reformer://guide' });
    await client.getPrompt({ name: 'start-here' });
    await protocolError(client.getPrompt({ name: 'no-such-prompt' }));

    expect(calls.map((call) => [call.kind, call.name, call.isError])).toEqual([
      ['tool', 'choose_api', false],
      ['tool', 'choose_api', true],
      ['resource', 'reformer://guide', false],
      ['prompt', 'start-here', false],
      ['prompt', 'no-such-prompt', true],
    ]);
    expect(calls[0].resultChars).toBeGreaterThan(0);
    expect(calls[0].arguments).toEqual({ requirement: 'итог = цена × кол-во' });
    expect(calls[1].protocolError).toBeNull();
    expect(calls[4].protocolError).toContain('no-such-prompt');
    expect(calls[4].resultChars).toBe(0);
  });
});

describe.runIf(hasDist)('dist/index.js через stdio', () => {
  let traceDirectory: string | undefined;

  afterEach(() => {
    if (traceDirectory) rmSync(traceDirectory, { recursive: true, force: true });
    traceDirectory = undefined;
  });

  async function spawnServer(environment: Record<string, string> = {}): Promise<Client> {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [distEntry],
      env: { ...(process.env as Record<string, string>), ...environment },
      stderr: 'ignore',
    });
    const client = new Client({ name: 'node-server-test', version: '0.0.0' });
    await client.connect(transport);
    clients.push(client);
    return client;
  }

  it('версия сервера — из package.json пакета', async () => {
    const client = await spawnServer();
    const { version } = JSON.parse(readFileSync(resolve(packageRoot, 'package.json'), 'utf8'));
    expect(client.getServerVersion()?.version).toBe(version);
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it('REFORMER_TRACE_FILE: по строке на вызов', async () => {
    traceDirectory = mkdtempSync(join(tmpdir(), 'reformer-trace-'));
    const traceFile = join(traceDirectory, 'nested', 'trace.jsonl');
    const client = await spawnServer({ REFORMER_TRACE_FILE: traceFile });

    await client.listTools();
    await client.callTool({ name: 'choose_api', arguments: { requirement: 'скрыть поле' } });
    await client.callTool({ name: 'choose_api', arguments: { requirement: 'скрыть поле' } });
    await client.readResource({ uri: 'reformer://guide' });

    const entries = readFileSync(traceFile, 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(entries.map((entry) => [entry.seq, entry.kind, entry.name])).toEqual([
      [1, 'tool', 'choose_api'],
      [2, 'tool', 'choose_api'],
      [3, 'resource', 'reformer://guide'],
    ]);
    expect(entries[0].argumentsDigest).toBe(entries[1].argumentsDigest);
    expect(entries[0].argumentsPreview).toContain('скрыть поле');
    expect(entries[0].resultChars).toBeGreaterThan(0);
  });

  it('без REFORMER_TRACE_FILE сервер работает и файла не заводит', async () => {
    const environment = { ...(process.env as Record<string, string>) };
    delete environment.REFORMER_TRACE_FILE;
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [distEntry],
      env: environment,
      stderr: 'ignore',
    });
    const client = new Client({ name: 'node-server-test', version: '0.0.0' });
    await client.connect(transport);
    clients.push(client);
    const result = await client.callTool({
      name: 'choose_api',
      arguments: { requirement: 'скрыть поле' },
    });
    expect(result.isError).not.toBe(true);
  });
});
