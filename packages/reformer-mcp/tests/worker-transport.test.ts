/**
 * Сервер воркера и транспорт `postMessage` — на настоящем клиенте SDK, без браузера.
 *
 * Воркер здесь — конец `MessageChannel`: у него тот же контракт порта, что у `self` воркера и у
 * `Worker` на стороне хоста. Проверяется весь путь, который пройдёт хост ассистента: `initialize`,
 * `tools/list`, вызов инструмента, чтение ресурса. Корпус собирается так же, как его соберёт
 * `scripts/build-worker.mjs`, — из `llms*.json` пакетов.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUNDLE_SCHEMA_VERSION, type DocsBundle, type IndexBundle } from '../src/core/bundle';
import { KNOWN_PACKAGES, packageDirName } from '../src/core/docs/packages';
import {
  createPortTransport,
  type MessageEventLike,
  type MessagePortLike,
} from '../src/platform/worker/port-transport';
import { startWorkerServer } from '../src/platform/worker/server';

const repoRoot = resolve(__dirname, '../../..');

function loadBundles(): { index: IndexBundle; docs: DocsBundle } | null {
  const index: IndexBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const docs: DocsBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  for (const pkg of KNOWN_PACKAGES) {
    const dir = resolve(repoRoot, 'packages', packageDirName(pkg));
    const indexFile = resolve(dir, 'llms-index.json');
    const docsFile = resolve(dir, 'llms.txt');
    if (existsSync(indexFile)) index.packages[pkg] = JSON.parse(readFileSync(indexFile, 'utf8'));
    if (existsSync(docsFile)) docs.packages[pkg] = readFileSync(docsFile, 'utf8');
  }
  return Object.keys(index.packages).length > 0 ? { index, docs } : null;
}

const bundles = loadBundles();
const textOf = (result: { content: unknown }) =>
  (result.content as Array<{ type: string; text?: string }>)
    .map((part) => part.text ?? '')
    .join('\n');

/** Открытые каналы — закрываются после теста, иначе vitest ждёт их до таймаута. */
const opened: MessageChannel[] = [];
afterEach(() => {
  for (const channel of opened.splice(0)) {
    channel.port1.close();
    channel.port2.close();
  }
});

async function connect(corpus: () => { index: IndexBundle; docs: DocsBundle }) {
  const channel = new MessageChannel();
  opened.push(channel);
  startWorkerServer({ port: channel.port1, version: '0.0.0-test', corpus });
  const client = new Client({ name: 'worker-transport-test', version: '1.0.0' });
  await client.connect(createPortTransport(channel.port2));
  return client;
}

describe.runIf(bundles !== null)('сервер воркера через postMessage', () => {
  it('initialize и tools/list — без разбора корпуса', async () => {
    const corpus = vi.fn(() => bundles!);
    const client = await connect(corpus);

    expect(client.getServerVersion()).toMatchObject({
      name: 'reformer-mcp',
      version: '0.0.0-test',
    });
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('choose_api');
    expect(tools.map((tool) => tool.name)).not.toContain('report_issue');
    // Корпус разбирается на первый вызов, которому он нужен, — не на подключение.
    expect(corpus).not.toHaveBeenCalled();
    await client.close();
  });

  it('вызов инструмента отвечает знанием корпуса, корпус разбирается один раз', async () => {
    const corpus = vi.fn(() => bundles!);
    const client = await connect(corpus);

    const first = await client.callTool({
      name: 'choose_api',
      arguments: { requirement: 'total = price * quantity' },
    });
    expect(textOf(first)).toContain('computeFrom');
    await client.callTool({ name: 'search_docs', arguments: { query: 'wizard' } });
    expect(corpus).toHaveBeenCalledTimes(1);
    await client.close();
  });

  it('ресурсы читаются тем же каталогом, что под Node', async () => {
    const client = await connect(() => bundles!);
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toContain('reformer://catalog');
    const { contents } = await client.readResource({ uri: 'reformer://guide' });
    expect((contents[0] as { text: string }).text).toContain('Form file layout');
    await client.close();
  });
});

describe('транспорт postMessage', () => {
  /** Порт-двойник: доставляет синхронно и помнит, что отправлено. */
  function fakePort() {
    const listeners = new Set<(event: MessageEventLike) => void>();
    const sent: unknown[] = [];
    const port: MessagePortLike = {
      postMessage: (message) => sent.push(message),
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
    };
    const deliver = (data: unknown) => listeners.forEach((listener) => listener({ data }));
    return { port, sent, deliver, listeners };
  }

  const ping = { jsonrpc: '2.0' as const, id: 1, method: 'ping' };

  it('сообщения до подписчика не теряются — уходят ему на start()', async () => {
    const { port, deliver } = fakePort();
    const transport = createPortTransport(port);
    deliver(ping);

    const received: unknown[] = [];
    transport.onmessage = (message) => received.push(message);
    expect(received).toEqual([]);
    await transport.start();
    expect(received).toEqual([ping]);
  });

  it('чужой кадр — onerror, соединение живо', async () => {
    const { port, deliver } = fakePort();
    const transport = createPortTransport(port);
    const errors: Error[] = [];
    const received: unknown[] = [];
    transport.onerror = (error) => errors.push(error);
    transport.onmessage = (message) => received.push(message);
    await transport.start();

    deliver({ hello: 'world' });
    deliver(ping);
    expect(errors).toHaveLength(1);
    expect(received).toEqual([ping]);
  });

  it('close() отписывает, зовёт onClose и onclose; отправка после — ошибка', async () => {
    const { port, listeners } = fakePort();
    const onClose = vi.fn();
    const transport = createPortTransport(port, { onClose });
    const onclose = vi.fn();
    transport.onclose = onclose;

    await transport.close();
    expect(listeners.size).toBe(0);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onclose).toHaveBeenCalledOnce();
    await expect(transport.send(ping)).rejects.toThrow('closed');
  });
});
