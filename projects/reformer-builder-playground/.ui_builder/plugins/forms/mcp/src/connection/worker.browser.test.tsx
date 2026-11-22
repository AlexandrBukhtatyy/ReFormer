/**
 * Сервер MCP в настоящем Web Worker.
 *
 * Node-тесты проверяют клиента на `MessageChannel`. Здесь — то, что видит билдер: скрипт
 * сервера как Blob, Blob-адрес, `new Worker` и MCP через `postMessage`. Сервер — минимальный, на
 * голом JSON-RPC: проверяется путь до воркера и обратно, а не чей-то сервер.
 *
 * @module plugins/forms/mcp/connection/worker.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createWorkerOpener } from './mcp-client';

/** Скрипт воркера: отвечает на `initialize`, `tools/list` и `tools/call`. */
const WORKER_SCRIPT = `
self.addEventListener('message', (event) => {
  const message = event.data;
  if (message === null || typeof message !== 'object' || message.id === undefined) return;
  const reply = (result) => self.postMessage({ jsonrpc: '2.0', id: message.id, result });
  if (message.method === 'initialize') {
    reply({
      protocolVersion: message.params.protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: 'worker-echo', version: '1.0.0' },
    });
  } else if (message.method === 'tools/list') {
    reply({ tools: [{ name: 'echo', inputSchema: { type: 'object' } }] });
  } else if (message.method === 'tools/call') {
    reply({ content: [{ type: 'text', text: 'echo: ' + message.params.arguments.text }] });
  } else {
    self.postMessage({
      jsonrpc: '2.0',
      id: message.id,
      error: { code: -32601, message: 'Method not found' },
    });
  }
});
`;

describe('сервер в Web Worker', () => {
  it('подключение, список, вызов; закрытие останавливает воркер', { timeout: 30_000 }, async () => {
    const terminate = vi.spyOn(Worker.prototype, 'terminate');
    const lost = vi.fn();

    const session = await createWorkerOpener()({
      name: 'echo',
      script: new Blob([WORKER_SCRIPT], { type: 'text/javascript' }),
      onToolsChanged: () => undefined,
      lost,
    });
    expect(session.server).toEqual({ name: 'worker-echo', version: '1.0.0' });
    const tools = await session.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(['echo']);

    const result = await session.callTool('echo', { text: 'hi' });
    expect(JSON.stringify(result.content)).toContain('echo: hi');

    await session.close();
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(lost).not.toHaveBeenCalled();
  });
});
