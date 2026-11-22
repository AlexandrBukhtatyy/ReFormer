/**
 * Менеджер MCP-серверов: статусы, кэш инструментов, вызовы, переменные — над двойниками сессий.
 *
 * @module plugins/forms/mcp/connection/manager.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  createFakeClock,
  createFakeHost,
  createFakeOpeners,
  fakeTool,
  type FakeServer,
} from '../testing';
import { createMcpManager, isMixedContent, modelView } from './manager';
import type { RemoteServerSpec } from '../config/types';

const BUNDLE = '.ui_builder/mcp/reformer/server.js';

const reformer: FakeServer = { tools: [fakeTool('choose_api'), fakeTool('search_docs')] };

async function setup(
  files: Record<string, string> = { [BUNDLE]: 'self.x = 1;' },
  servers: Record<string, FakeServer> = { reformer },
  options: { pageProtocol?: string; failing?: Set<string> } = {}
) {
  const host = createFakeHost(files);
  const openers = createFakeOpeners(servers, options.failing);
  const clock = createFakeClock();
  const manager = createMcpManager({
    host,
    openers,
    clock,
    policy: { maxLive: 3, defaultIdleSeconds: 60 },
    pageProtocol: () => options.pageProtocol,
  });
  await manager.reload();
  return { host, openers, clock, manager };
}

const statusOf = (manager: Awaited<ReturnType<typeof setup>>['manager'], name: string) =>
  manager.snapshot().servers.find((view) => view.spec.name === name)?.status;

describe('статусы без запуска', () => {
  it('обнаружение ничего не открывает; виды серверов — свои статусы', async () => {
    const { manager, openers } = await setup({
      [BUNDLE]: 'x',
      '.ui_builder/mcp/draft/README.md': '',
      '.mcp.json': JSON.stringify({
        mcpServers: {
          local: { command: 'node' },
          docs: {
            type: 'http',
            url: 'https://docs.example/mcp',
            headers: { Authorization: 'Bearer ${DOCS_TOKEN}' },
          },
        },
      }),
    });

    expect(openers.opened).toEqual([]);
    const snapshot = manager.snapshot();
    expect(snapshot.launchable).toBe(true);
    expect(snapshot.servers.map((view) => [view.spec.name, view.status.kind])).toEqual([
      ['draft', 'unavailable'],
      ['reformer', 'idle'],
      ['docs', 'needs-values'],
      ['local', 'unavailable'],
    ]);
    expect(snapshot.servers.find((view) => view.spec.name === 'docs')?.variables).toEqual([
      { name: 'DOCS_TOKEN', set: false },
    ]);
  });

  it('без запускаемых серверов launchable ложен — фасад модели не нужен', async () => {
    const { manager } = await setup({
      '.mcp.json': '{"mcpServers": {"local": {"command": "node"}}}',
    });
    expect(manager.snapshot().launchable).toBe(false);
  });
});

describe('инструменты — лениво и из памяти', () => {
  it('первый запрос открывает воркер, повторный и после сна — из памяти', async () => {
    const { manager, openers, host } = await setup();
    const readScript = vi.spyOn(host, 'readScript');

    const first = await manager.tools('reformer');
    expect(first).toEqual({ ok: true, value: reformer.tools });
    expect(openers.opened).toEqual(['reformer']);

    await manager.tools('reformer');
    expect(await manager.sleep('reformer')).toBe(true);
    expect(statusOf(manager, 'reformer')).toEqual({ kind: 'asleep' });
    await manager.tools('reformer');
    expect(openers.opened).toEqual(['reformer']);
    expect(readScript).toHaveBeenCalledTimes(1);
  });

  it('пробуждение не перечитывает скрипт', async () => {
    const { manager, openers, host } = await setup();
    const readScript = vi.spyOn(host, 'readScript');
    await manager.call('reformer', 'choose_api', {});
    await manager.sleep('reformer');
    await manager.call('reformer', 'choose_api', {});
    expect(openers.opened).toEqual(['reformer', 'reformer']);
    expect(readScript).toHaveBeenCalledTimes(1);
  });

  it('сервер прислал новый список — он и в памяти', async () => {
    const { manager, openers } = await setup();
    await manager.tools('reformer');
    openers.events.get('reformer')!.onToolsChanged([fakeTool('only_one')]);
    expect(await manager.tools('reformer')).toEqual({ ok: true, value: [fakeTool('only_one')] });
  });
});

describe('вызовы', () => {
  it('вызов в аренде: сначала список, затем инструмент', async () => {
    const { manager, openers } = await setup();
    const result = await manager.call('reformer', 'choose_api', { requirement: 'x' });
    expect(result).toEqual({
      ok: true,
      value: { content: [{ type: 'text', text: 'choose_api ok' }] },
    });
    expect(openers.calls).toEqual([
      { server: 'reformer', tool: 'choose_api', args: { requirement: 'x' } },
    ]);
    expect(statusOf(manager, 'reformer')).toEqual({ kind: 'running' });
  });

  it('неизвестные сервер и инструмент — NOT_FOUND с подсказками, инструмент не зовётся', async () => {
    const { manager, openers } = await setup();
    expect(await manager.call('nope', 'x', {})).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', suggestions: ['reformer'] },
    });
    expect(await manager.call('reformer', 'invented', {})).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', suggestions: ['choose_api', 'search_docs'] },
    });
    expect(openers.calls).toEqual([]);
  });

  it('источник не разрешает исполнять код — UNAVAILABLE, воркер не создаётся', async () => {
    const { manager, openers, host } = await setup();
    host.setExecutesCode(false);
    expect(statusOf(manager, 'reformer')).toEqual({
      kind: 'unavailable',
      reason: 'no-code-execution',
    });
    expect(await manager.call('reformer', 'choose_api', {})).toMatchObject({
      ok: false,
      error: { code: 'UNAVAILABLE' },
    });
    expect(openers.opened).toEqual([]);
  });

  it('сессия упала — статус ошибки, повтор — после паузы', async () => {
    const { manager, openers, clock } = await setup();
    await manager.tools('reformer');
    openers.events.get('reformer')!.lost(new Error('worker crashed'));
    expect(statusOf(manager, 'reformer')).toMatchObject({
      kind: 'error',
      message: 'worker crashed',
    });
    expect(await manager.call('reformer', 'choose_api', {})).toMatchObject({
      ok: false,
      error: { code: 'UNAVAILABLE' },
    });

    clock.advance(10_000);
    expect(await manager.call('reformer', 'choose_api', {})).toMatchObject({ ok: true });
  });
});

describe('удалённые серверы и переменные', () => {
  const remoteFiles = {
    '.mcp.json': JSON.stringify({
      mcpServers: {
        docs: {
          type: 'http',
          url: 'https://docs.example/mcp',
          headers: { Authorization: 'Bearer ${DOCS_TOKEN}' },
        },
      },
    }),
  };

  it('без значения — UNAVAILABLE с просьбой задать его; с значением — заголовок подставлен', async () => {
    const { manager, openers, host } = await setup(remoteFiles, {
      docs: { tools: [fakeTool('search')] },
    });
    expect(await manager.tools('docs')).toMatchObject({
      ok: false,
      error: { code: 'UNAVAILABLE', message: expect.stringContaining('DOCS_TOKEN') },
    });

    await manager.setVariable('DOCS_TOKEN', 'secret-1');
    expect(host.secretValues.get('var:DOCS_TOKEN')).toBe('secret-1');
    expect(await manager.tools('docs')).toMatchObject({ ok: true });
    expect(openers.remoteRequests).toEqual([
      {
        name: 'docs',
        url: 'https://docs.example/mcp',
        headers: { Authorization: 'Bearer secret-1' },
      },
    ]);
  });

  it('значение из секретов поднимается при перечитывании', async () => {
    const { host } = await setup(remoteFiles, { docs: { tools: [] } });
    host.secretValues.set('var:DOCS_TOKEN', 'kept');
    const manager = createMcpManager({ host, openers: createFakeOpeners({ docs: { tools: [] } }) });
    await manager.reload();
    expect(manager.snapshot().servers[0]?.variables).toEqual([{ name: 'DOCS_TOKEN', set: true }]);
  });

  it('http-адрес не на этой машине со страницы https — недоступен', async () => {
    const files = {
      '.mcp.json': '{"mcpServers": {"plain": {"type": "http", "url": "http://plain.example/mcp"}}}',
    };
    const { manager } = await setup(files, { plain: { tools: [] } }, { pageProtocol: 'https:' });
    expect(statusOf(manager, 'plain')).toEqual({ kind: 'unavailable', reason: 'mixed-content' });
    expect(isMixedContent('http://localhost:3000/mcp', 'https:')).toBe(false);
    expect(isMixedContent('http://plain.example/mcp', 'http:')).toBe(false);
  });
});

describe('перечитывание', () => {
  it('закрывает сессии и забывает списки инструментов', async () => {
    const { manager, openers } = await setup();
    await manager.tools('reformer');
    await manager.reload();
    expect(openers.closed).toEqual(['reformer']);
    expect(statusOf(manager, 'reformer')).toEqual({ kind: 'idle' });
    expect(manager.snapshot().servers[0]?.tools).toBeUndefined();
  });

  it('подписчики узнают об изменениях, снимок стабилен между ними', async () => {
    const { manager } = await setup();
    const listener = vi.fn();
    manager.subscribe(listener);
    const before = manager.snapshot();
    expect(manager.snapshot()).toBe(before);
    await manager.tools('reformer');
    expect(listener).toHaveBeenCalled();
    expect(manager.snapshot()).not.toBe(before);
  });
});

describe('объявленные плагинами серверы', () => {
  const stack: RemoteServerSpec = {
    kind: 'http',
    name: 'stack',
    url: 'https://svc.example/mcp/builder',
    headers: { Authorization: 'Bearer ${REFORMER_API_KEY}' },
    notes: [],
    internal: true,
  };
  const remote = { tools: [fakeTool('judge_intent')] };

  it('объявление — в списке после серверов проекта; ключ из секретов; снятие убирает', async () => {
    const { manager, host, openers } = await setup({ [BUNDLE]: 'x' }, { reformer, stack: remote });
    const undeclare = manager.declare(stack);
    expect(manager.snapshot().servers.map((view) => view.spec.name)).toEqual(['reformer', 'stack']);
    expect(statusOf(manager, 'stack')?.kind).toBe('needs-values');

    await manager.setVariable('REFORMER_API_KEY', 'k-1');
    expect(statusOf(manager, 'stack')?.kind).toBe('idle');
    const outcome = await manager.call('stack', 'judge_intent', {});
    expect(outcome.ok).toBe(true);
    expect(openers.remoteRequests.at(-1)?.headers).toEqual({ Authorization: 'Bearer k-1' });

    undeclare();
    expect(manager.snapshot().servers.map((view) => view.spec.name)).toEqual(['reformer']);
    // Секрет остался — повторное объявление не спрашивает ключ снова.
    expect(await host.secrets.get('var:REFORMER_API_KEY')).toBeDefined();
  });

  it('сервер проекта с тем же именем главнее объявления — адресом, но не назначением', async () => {
    const { manager } = await setup({
      '.mcp.json': JSON.stringify({
        mcpServers: {
          stack: { type: 'http', url: 'https://my.example/mcp' },
          docs: { type: 'http', url: 'https://docs.example/mcp' },
        },
      }),
    });
    const undeclare = manager.declare(stack);
    const specOf = (name: string) =>
      manager.snapshot().servers.find((item) => item.spec.name === name)?.spec;
    // Адрес и заголовки — проекта: так сервис направляют на свой адрес.
    expect(specOf('stack')).toMatchObject({ url: 'https://my.example/mcp', headers: {} });
    // Внутренним сервер остаётся: его инструменты объявлены для плагина, не для модели.
    expect(specOf('stack')).toMatchObject({ internal: true });
    expect(
      modelView(manager)
        .snapshot()
        .servers.map((view) => view.spec.name)
    ).toEqual(['docs']);
    // Чужие записи проекта назначения не меняют.
    expect(specOf('docs')).not.toHaveProperty('internal');

    undeclare();
    expect(specOf('stack')).not.toHaveProperty('internal');
  });

  it('вид для модели не видит внутренних серверов и не зовёт их', async () => {
    const { manager } = await setup({ [BUNDLE]: 'x' }, { reformer, stack: remote });
    manager.declare(stack);
    await manager.setVariable('REFORMER_API_KEY', 'k-1');
    const forModel = modelView(manager);

    expect(forModel.snapshot().servers.map((view) => view.spec.name)).toEqual(['reformer']);
    expect(forModel.snapshot()).toBe(forModel.snapshot());
    const denied = await forModel.call('stack', 'judge_intent', {});
    expect(denied.ok).toBe(false);
    expect((await forModel.tools('stack')).ok).toBe(false);
    expect((await forModel.call('reformer', 'choose_api', {})).ok).toBe(true);
  });

  it('только внутренний сервер — launchable ложен: фасад модели не нужен', async () => {
    const { manager } = await setup({}, { stack: remote });
    manager.declare(stack);
    expect(manager.snapshot().launchable).toBe(false);
  });
});
