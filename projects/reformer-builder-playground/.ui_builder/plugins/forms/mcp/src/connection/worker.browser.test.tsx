/**
 * Сервер-бандл ReFormer в настоящем Web Worker.
 *
 * Node-тесты проверяют клиента на `MessageChannel`, а бандл — в `node:vm`. Здесь — то, что видит
 * билдер: собранный `server.js` пакета `@reformer/mcp`, Blob-адрес, `new Worker` и MCP через
 * `postMessage`. Бандла нет (пакет не собран) — набор пропускается: собирать его ради теста
 * плагина — работа `npm run build -w @reformer/mcp`, а не этого прогона.
 *
 * @module plugins/forms/mcp/connection/worker.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createWorkerOpener } from './mcp-client';

/** Адрес собранного бандла для dev-сервера прогона; пустой объект — бандл не собран. */
const bundles = import.meta.glob<string>(
  '../../../../../../../../packages/reformer-mcp/dist/worker/server.js',
  { query: '?url', import: 'default' }
);
const loadUrl = Object.values(bundles)[0];

describe.runIf(loadUrl !== undefined)('сервер-бандл в Web Worker', () => {
  it('подключение, список, вызов; закрытие останавливает воркер', { timeout: 60_000 }, async () => {
    const script = await (await fetch(await loadUrl!())).blob();
    const terminate = vi.spyOn(Worker.prototype, 'terminate');
    const lost = vi.fn();

    const session = await createWorkerOpener()({
      name: 'reformer',
      script,
      onToolsChanged: () => undefined,
      lost,
    });
    const tools = await session.listTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['choose_api', 'get_context', 'generate_form'])
    );
    // Профиль браузера: ни отчётов на диск, ни путей к спецификациям.
    expect(tools.map((tool) => tool.name)).not.toContain('report_issue');

    const result = await session.callTool('choose_api', {
      requirement: 'total = price * quantity',
    });
    expect(JSON.stringify(result.content)).toContain('computeFrom');

    await session.close();
    expect(terminate).toHaveBeenCalledTimes(1);
    expect(lost).not.toHaveBeenCalled();
  });
});
