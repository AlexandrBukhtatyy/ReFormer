/**
 * Бандл воркера (`dist/worker/server.js`) работает там, где нет Node.
 *
 * `check:no-node-globals` бандл не проверяет: в нём вложены зависимости SDK, и регулярка
 * спотыкалась бы о строки внутри них. Здесь проверка честнее — бандл ИСПОЛНЯЕТСЯ в контексте
 * `node:vm`, где есть только то, что даёт воркер браузера (таймеры, `AbortController`,
 * `TextEncoder`, `URL`, `structuredClone`, `self`), а `process`, `require`, `module` и `Buffer` нет.
 * Любое обращение к ним уронит `initialize` или вызов инструмента.
 *
 * Тест пропускается, если бандл не собран (`npm run build -w @reformer/mcp`).
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { describe, expect, it } from 'vitest';
import {
  createPortTransport,
  type MessageEventLike,
  type MessagePortLike,
} from '../src/platform/worker/port-transport';

const bundleFile = resolve(__dirname, '../dist/worker/server.js');

type Listener = (event: MessageEventLike) => void;

/**
 * Поднять бандл в «воркере»: контекст `vm` с `self` и пара портов между ним и хостом. Доставка
 * асинхронная и через `structuredClone` — как у настоящего `postMessage`.
 */
function startBundle(): MessagePortLike {
  const workerListeners = new Set<Listener>();
  const hostListeners = new Set<Listener>();
  const deliver = (listeners: Set<Listener>, message: unknown) => {
    const data = structuredClone(message);
    setTimeout(() => listeners.forEach((listener) => listener({ data })), 0);
  };

  const self = {
    postMessage: (message: unknown) => deliver(hostListeners, message),
    addEventListener: (_type: string, listener: Listener) => workerListeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => workerListeners.delete(listener),
  };
  const context = vm.createContext({
    self,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    queueMicrotask,
    structuredClone,
    AbortController,
    AbortSignal,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    Event,
    EventTarget,
    crypto: globalThis.crypto,
  });
  vm.runInContext(readFileSync(bundleFile, 'utf8'), context, { filename: 'server.js' });

  return {
    postMessage: (message) => deliver(workerListeners, message),
    addEventListener: (_type, listener) => hostListeners.add(listener),
    removeEventListener: (_type, listener) => hostListeners.delete(listener),
  };
}

describe.runIf(existsSync(bundleFile))('бандл воркера без Node', () => {
  it('в контексте нет node-глобалей — проверка не подложена', () => {
    const probe = vm.createContext({});
    expect(vm.runInContext('typeof process + typeof require + typeof Buffer', probe)).toBe(
      'undefinedundefinedundefined'
    );
  });

  it('initialize, tools/list и вызов инструмента на вшитом корпусе', async () => {
    const client = new Client({ name: 'worker-bundle-test', version: '1.0.0' });
    await client.connect(createPortTransport(startBundle()));

    const version = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
      version: string;
    };
    expect(client.getServerVersion()).toMatchObject({
      name: 'reformer-mcp',
      version: version.version,
    });

    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['choose_api', 'search_docs', 'generate_form'])
    );

    const result = await client.callTool({
      name: 'choose_api',
      arguments: { requirement: 'total = price * quantity' },
    });
    const text = (result.content as Array<{ text?: string }>).map((part) => part.text).join('\n');
    expect(text).toContain('computeFrom');
    await client.close();
  }, 30_000);
});
