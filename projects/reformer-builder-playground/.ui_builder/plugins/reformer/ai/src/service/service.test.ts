/**
 * Связь стека с сервисом ReFormer: объявление сервера, готовность, вызов, компилятор и справка —
 * над двойником подключений MCP. Сам сервис здесь не нужен: проверяется клиент.
 *
 * @module plugins/reformer/ai/service/service.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  McpConnectionsCapability,
  type McpConnections,
  type McpConnectionStatus,
  type McpServerDeclaration,
  type McpToolOutcome,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import type { LibraryReferenceService } from '../reference';
import { createFormCompiler } from './compiler';
import {
  createServiceCall,
  isServiceReady,
  linkService,
  SERVICE_SERVER,
  serviceDeclaration,
} from './link';
import { chooseReference, createServiceReference } from './reference';

type Handler = (tool: string, args: Record<string, unknown>) => McpToolOutcome;

const text = (value: unknown): McpToolOutcome => ({
  ok: true,
  content: [{ type: 'text', text: JSON.stringify(value) }],
  isError: false,
});

/** Подключения-двойник: объявленные серверы, их статусы и ответы инструментов. */
function fakeConnections(handler: Handler = () => text({})) {
  const declared: McpServerDeclaration[] = [];
  const listeners = new Set<() => void>();
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = [];
  let status: McpConnectionStatus = 'idle';
  let missing: string[] = [];
  const connections: McpConnections = {
    servers: () =>
      declared.map((server) => ({ name: server.name, status, internal: true, missing })),
    subscribe(listener) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    callTool(_server, tool, args) {
      calls.push({ tool, args });
      return Promise.resolve(handler(tool, args));
    },
    declare(server) {
      declared.push(server);
      return { dispose: () => declared.splice(declared.indexOf(server), 1) };
    },
  };
  return {
    connections,
    declared,
    calls,
    listeners,
    setStatus(next: McpConnectionStatus, nextMissing: string[] = []) {
      status = next;
      missing = nextMissing;
      for (const listener of [...listeners]) listener();
    },
  };
}

/** Реестр служб с одной — подключениями MCP, которые можно убрать и вернуть. */
function fakeServices(initial?: McpConnections) {
  let current = initial;
  const listeners = new Set<(change: { id: string; present: boolean }) => void>();
  const services = {
    get: (token: { id: string }) =>
      token.id === McpConnectionsCapability.id ? current : undefined,
    onDidChange(listener: (change: { id: string; present: boolean }) => void) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  } as unknown as PluginContext['services'];
  return {
    services,
    set(next: McpConnections | undefined) {
      current = next;
      for (const listener of [...listeners]) {
        listener({ id: McpConnectionsCapability.id, present: next !== undefined });
      }
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('объявление и готовность', () => {
  it('сервер внутренний, ключ — переменной в заголовке', () => {
    expect(serviceDeclaration('http://localhost:8787/mcp/builder')).toEqual({
      name: SERVICE_SERVER,
      kind: 'http',
      url: 'http://localhost:8787/mcp/builder',
      headers: { Authorization: 'Bearer ${REFORMER_API_KEY}' },
      internal: true,
    });
  });

  it('готов — если сервер есть, ключ задан и браузер его пускает; ошибка соединения не снимает', () => {
    const server = (status: McpConnectionStatus) => ({
      name: SERVICE_SERVER,
      status,
      internal: true,
      missing: [],
    });
    expect(isServiceReady(undefined)).toBe(false);
    expect(isServiceReady(server('needs-values'))).toBe(false);
    expect(isServiceReady(server('unavailable'))).toBe(false);
    for (const status of ['idle', 'starting', 'running', 'asleep', 'error'] as const) {
      expect(isServiceReady(server(status))).toBe(true);
    }
  });

  it('linkService объявляет сервер и сообщает о смене готовности — не о начальной', () => {
    const fake = fakeConnections();
    fake.setStatus('needs-values', ['REFORMER_API_KEY']);
    const changes: boolean[] = [];
    const link = linkService(fakeServices(fake.connections).services, (ready) =>
      changes.push(ready)
    );
    expect(fake.declared.map((server) => server.name)).toEqual([SERVICE_SERVER]);
    expect(link.ready()).toBe(false);
    expect(changes).toEqual([]);

    fake.setStatus('idle');
    fake.setStatus('running');
    expect(link.ready()).toBe(true);
    expect(changes).toEqual([true]);

    link.dispose();
    expect(fake.declared).toEqual([]);
    expect(fake.listeners.size).toBe(0);
  });

  it('плагин MCP поднялся позже — объявление ставится тогда; ушёл — готовности нет', () => {
    const registry = fakeServices(undefined);
    const changes: boolean[] = [];
    const link = linkService(registry.services, (ready) => changes.push(ready));
    expect(link.ready()).toBe(false);

    const fake = fakeConnections();
    registry.set(fake.connections);
    expect(fake.declared).toHaveLength(1);
    expect(changes).toEqual([true]);

    registry.set(undefined);
    expect(fake.declared).toEqual([]);
    expect(changes).toEqual([true, false]);
    link.dispose();
  });
});

describe('вызов сервиса', () => {
  it('ответ — JSON в тексте', async () => {
    const fake = fakeConnections(() => text({ answer: 42 }));
    fake.connections.declare(serviceDeclaration());
    const call = createServiceCall(() => fake.connections);
    expect(await call('t', { a: 1 })).toEqual({ ok: true, value: { answer: 42 } });
    expect(fake.calls).toEqual([{ tool: 't', args: { a: 1 } }]);
  });

  it('нет подключений, нет ключа, отказ и не-JSON — отказ словами, без исключения', async () => {
    expect(await createServiceCall(() => undefined)('t', {})).toMatchObject({
      ok: false,
      message: expect.stringContaining('MCP servers plugin is off'),
    });

    const keyless = fakeConnections();
    keyless.connections.declare(serviceDeclaration());
    keyless.setStatus('needs-values', ['REFORMER_API_KEY']);
    const needsKey = await createServiceCall(() => keyless.connections)('t', {});
    expect(needsKey).toMatchObject({
      ok: false,
      message: expect.stringContaining('REFORMER_API_KEY'),
    });
    expect(keyless.calls).toEqual([]);

    const failing = fakeConnections(() => ({ ok: false, code: 'FAILED', message: 'network' }));
    failing.connections.declare(serviceDeclaration());
    expect(await createServiceCall(() => failing.connections)('t', {})).toMatchObject({
      ok: false,
      message: expect.stringContaining('network'),
    });

    const refusing = fakeConnections(() => ({
      ok: true,
      content: [{ type: 'text', text: 'denied' }],
      isError: true,
    }));
    refusing.connections.declare(serviceDeclaration());
    expect(await createServiceCall(() => refusing.connections)('t', {})).toMatchObject({
      ok: false,
      message: expect.stringContaining('denied'),
    });

    const garbled = fakeConnections(() => ({
      ok: true,
      content: [{ type: 'text', text: 'not json' }],
      isError: false,
    }));
    garbled.connections.declare(serviceDeclaration());
    expect((await createServiceCall(() => garbled.connections)('t', {})).ok).toBe(false);
  });
});

describe('компилятор', () => {
  const catalog = [{ name: 'Input' }] as unknown as readonly CatalogEntry[];

  it('каталог — по отпечатку; сервис его не помнит — повтор с каталогом; грамматика кэшируется', async () => {
    const known = new Set<string>();
    const fake = fakeConnections((tool, args) => {
      const hash = args.catalogHash as string;
      if (args.catalog !== undefined) known.add(hash);
      if (!known.has(hash)) return text({ needCatalog: true });
      return text(tool === 'intent_grammar' ? { grammar: 'G', sampleNames: [] } : { verdict: 1 });
    });
    fake.connections.declare(serviceDeclaration());
    const compiler = createFormCompiler(createServiceCall(() => fake.connections));

    expect(await compiler.grammar(catalog)).toEqual({
      ok: true,
      value: { grammar: 'G', sampleNames: [] },
    });
    expect(await compiler.grammar(catalog)).toMatchObject({ ok: true });
    await compiler.judge({ fields: [] }, catalog);

    expect(fake.calls.map((c) => [c.tool, 'catalog' in c.args])).toEqual([
      ['intent_grammar', false],
      ['intent_grammar', true],
      ['judge_intent', false],
    ]);
    const hashes = new Set(fake.calls.map((c) => c.args.catalogHash));
    expect(hashes.size).toBe(1);
    expect([...hashes][0]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('неудача грамматики не запоминается', async () => {
    let up = false;
    const fake = fakeConnections(() =>
      up ? text({ grammar: 'G', sampleNames: [] }) : { ok: false, code: 'FAILED', message: 'down' }
    );
    fake.connections.declare(serviceDeclaration());
    const compiler = createFormCompiler(createServiceCall(() => fake.connections));

    expect((await compiler.grammar(catalog)).ok).toBe(false);
    up = true;
    expect((await compiler.grammar(catalog)).ok).toBe(true);
  });
});

describe('справка сервиса', () => {
  it('вопрос и проверка кода — инструментами сервиса', async () => {
    const fake = fakeConnections((tool, args) =>
      tool === 'ask_reformer'
        ? text({ text: `answer to ${String(args.question)} in ${String(args.maxChars)}` })
        : text({ findings: [{ code: 'X1', severity: 'error', message: 'bad' }] })
    );
    fake.connections.declare(serviceDeclaration());
    const reference = createServiceReference(createServiceCall(() => fake.connections));

    expect(await reference.ask('q', { maxChars: 500 })).toEqual({ text: 'answer to q in 500' });
    expect(await reference.checkCode('x();', {})).toEqual({
      findings: [{ code: 'X1', severity: 'error', message: 'bad' }],
    });
  });

  it('сервис недоступен — справки нет (null), а не исключение', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const reference = createServiceReference(createServiceCall(() => undefined));
    expect(await reference.ask('q', { maxChars: 500 })).toBeNull();
    expect(await reference.checkCode('x();', {})).toBeNull();
  });
});

/** Справка-двойник: подписывается своим именем — и в ответе, и в единственной находке. */
function fakeReference(label = 'service'): Required<LibraryReferenceService> {
  return {
    ask: () => Promise.resolve({ text: label }),
    checkCode: () =>
      Promise.resolve({ findings: [{ code: label, severity: 'error', message: label }] }),
  };
}

const REQUEST = { maxChars: 100 };

describe('chooseReference', () => {
  it('поставщика нет — справка сервиса', () => {
    const fallback = fakeReference();
    expect(chooseReference(undefined, fallback)).toBe(fallback);
  });

  it('поставщик со справкой и проверкой — отвечает он', async () => {
    const provided: LibraryReferenceService = {
      ask: () => Promise.resolve({ text: 'provider' }),
      checkCode: () => Promise.resolve(null),
    };
    const reference = chooseReference(provided, fakeReference());

    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'provider' });
    // `null` поставщика — осознанное «проверить нечем», справка сервиса его не перекрывает.
    expect(await reference.checkCode('x();', {})).toBeNull();
  });

  it('поставщик без проверки кода — проверяет сервис', async () => {
    const provided: LibraryReferenceService = { ask: () => Promise.resolve({ text: 'provider' }) };
    const reference = chooseReference(provided, fakeReference());

    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'provider' });
    expect((await reference.checkCode('x();', {}))?.findings[0]?.code).toBe('service');
  });

  it('методы поставщика зовутся с ним в роли `this`', async () => {
    class ClassReference implements LibraryReferenceService {
      private readonly label = 'class';
      ask() {
        return Promise.resolve({ text: this.label });
      }
      checkCode() {
        return Promise.resolve({
          findings: [{ code: this.label, severity: 'warning' as const, message: '' }],
        });
      }
    }
    const reference = chooseReference(new ClassReference(), fakeReference());

    expect(await reference.ask('вопрос', REQUEST)).toEqual({ text: 'class' });
    expect((await reference.checkCode('x();', {}))?.findings[0]?.code).toBe('class');
  });

  it('поставщик не по форме контракта — справка сервиса и одно предупреждение', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const stale = { question: () => Promise.resolve('старая копия контракта') };
    const fallback = fakeReference();

    expect(chooseReference(stale, fallback)).toBe(fallback);
    expect(chooseReference(stale, fallback)).toBe(fallback);
    expect(chooseReference({ ask: () => null, checkCode: 'нет' }, fallback)).toBe(fallback);
    // Один и тот же негодный поставщик предупреждает один раз, а не на каждый вызов.
    expect(warn).toHaveBeenCalledTimes(2);
  });
});
