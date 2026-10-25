/**
 * Плагин «MCP-серверы»: состав вкладов и когда фасад появляется у ассистента.
 *
 * Рабочая область — двойник, сессии — двойники: проверяется, чем владеет плагин, а не связь.
 *
 * @module plugins/forms/mcp/plugin.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakePluginContext } from '../../../.shared/codegen-fakes';
import { MCP_CALL_NAME, MCP_TOOLS_NAME } from './assistant/facade';
import { createMcpPlugin, MCP_PANEL_ID, MCP_PLUGIN_ID, MCP_RELOAD_COMMAND_ID } from './plugin';
import { createFakeHost, createFakeOpeners, fakeTool, ROOT, type FakeHost } from './testing';

const BUNDLE = '.ui_builder/mcp/reformer/server.js';

/** Дать отработать перечитыванию: оно идёт `void`-промисом из `activate`. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function activate(host: FakeHost) {
  const openers = createFakeOpeners({ reformer: { tools: [fakeTool('choose_api')] } });
  const fake = createFakePluginContext(MCP_PLUGIN_ID);
  createMcpPlugin({ host, openers }).activate(fake.ctx);
  return { ...fake, openers };
}

const assistantTools = (contributions: ReturnType<typeof activate>['contributions']) =>
  contributions.filter((item) => item.point === 'reformer.assistant.tool').map((item) => item.id);

afterEach(() => {
  vi.useRealTimers();
});

describe('activate', () => {
  it('вносит панель и команду перечитывания, везёт словарь и ничего не запускает', async () => {
    const { contributions, commands, locales, openers } = activate(
      createFakeHost({ [BUNDLE]: 'x' })
    );
    await settle();
    expect(contributions.filter((item) => item.point === 'panel').map((item) => item.id)).toEqual([
      MCP_PANEL_ID,
    ]);
    expect(commands).toEqual([MCP_RELOAD_COMMAND_ID]);
    expect(locales.sort()).toEqual(['en', 'ru']);
    expect(openers.opened).toEqual([]);
  });

  it('есть запускаемый сервер — фасад и ресурсы продолжения у ассистента', async () => {
    const { contributions } = activate(createFakeHost({ [BUNDLE]: 'x' }));
    await settle();
    expect(assistantTools(contributions)).toEqual([MCP_TOOLS_NAME, MCP_CALL_NAME]);
    expect(
      contributions.filter((item) => item.point === 'reformer.assistant.resource')
    ).toHaveLength(1);
  });

  it('звать некого (только stdio) — поверхность хода не занята', async () => {
    const { contributions } = activate(
      createFakeHost({ '.mcp.json': '{"mcpServers": {"reformer": {"command": "npx"}}}' })
    );
    await settle();
    expect(assistantTools(contributions)).toEqual([]);
  });
});

describe('перечитывание', () => {
  it('сервер убрали — фасад снимается; вернули — вносится снова', async () => {
    const host = createFakeHost({ [BUNDLE]: 'x' });
    const { contributions, ctx } = activate(host);
    await settle();
    expect(assistantTools(contributions)).toHaveLength(2);

    host.files.delete(`${ROOT}/${BUNDLE}`);
    const reload = (ctx.commands as unknown as { get(id: string): { run(): unknown } }).get(
      MCP_RELOAD_COMMAND_ID
    );
    reload.run();
    await settle();
    expect(assistantTools(contributions)).toEqual([]);

    host.files.set(`${ROOT}/${BUNDLE}`, 'x');
    reload.run();
    await settle();
    expect(assistantTools(contributions)).toHaveLength(2);
  });

  it('смена проекта — перечитывание конфигурации нового', async () => {
    const host = createFakeHost({});
    const { contributions } = activate(host);
    await settle();
    expect(assistantTools(contributions)).toEqual([]);

    host.files.set(`other/${BUNDLE}`, 'x');
    host.setRoot('other');
    host.emitProject();
    await settle();
    expect(assistantTools(contributions)).toHaveLength(2);
  });

  it('правка .mcp.json — перечитывание с задержкой, чужие файлы — нет', async () => {
    vi.useFakeTimers();
    const host = createFakeHost({});
    const { contributions } = activate(host);
    await vi.runAllTimersAsync();

    host.files.set(
      `${ROOT}/.mcp.json`,
      '{"mcpServers": {"docs": {"type": "http", "url": "https://d.example"}}}'
    );
    host.emitFiles([`${ROOT}/forms/a.json`]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(assistantTools(contributions)).toEqual([]);

    host.emitFiles([`${ROOT}/.mcp.json`]);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(assistantTools(contributions)).toHaveLength(2);
  });
});
