/**
 * Панель MCP — в настоящем браузере.
 *
 * Проверяется то, ради чего панель есть, и то, что вне браузера не выразить:
 *
 * - **открытие панели ничего не будит.** Строки серверов и счёт живых воркеров — из того, что
 *   менеджер уже знает; ни один сервер не подключается, пока его не попросят;
 * - **жизненный цикл кнопками.** «Подключить» → «работает», инструменты и счёт воркеров;
 *   «Усыпить» → «спит» и воркер отпущен;
 * - **значение переменной — полем пароля.** Без значения сервер «нужны значения», с ним — готов;
 *   «Запомнить» уходит в секреты флагом, а не значением в настройки;
 * - **буквальный секрет в `.mcp.json` назван.** Файл лежит в git — предупреждение в строке сервера.
 *
 * @module plugins/forms/mcp/ui/McpPanel.browser.test
 */

import { describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { renderReact } from '../../../../.shared/render';
import { createMcpManager } from '../connection/manager';
import type { Translate } from '../host';
import ru from '../locales/ru.json';
import { createFakeHost, createFakeOpeners, fakeTool } from '../testing';
import { McpPanel } from './McpPanel';

/** Переводчик над словарём плагина: проверки читают то, что видит человек. */
const translate: Translate = (key, params) =>
  ((ru as Record<string, string>)[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) =>
    String(params?.[name] ?? `{${name}}`)
  );

const MCP_JSON = JSON.stringify({
  mcpServers: {
    docs: {
      type: 'http',
      url: 'https://docs.example/mcp',
      headers: { Authorization: 'Bearer ${DOCS_TOKEN}' },
    },
    leaky: {
      type: 'http',
      url: 'https://leaky.example/mcp',
      headers: { Authorization: 'Bearer sk-live-0123456789abcdef' },
    },
    local: { command: 'npx', args: ['some-server'] },
  },
});

async function mount() {
  const host = createFakeHost({
    '.ui_builder/mcp/fake/server.js': 'self.onmessage = null;',
    '.mcp.json': MCP_JSON,
  });
  const setSecret = vi.spyOn(host.secrets, 'set');
  const openers = createFakeOpeners({
    fake: { tools: [fakeTool('lookup')] },
    docs: { tools: [] },
    leaky: { tools: [] },
  });
  const manager = createMcpManager({ host, openers, pageProtocol: () => 'https:' });
  await manager.reload();
  renderReact(<McpPanel host={{ ...host, useTranslate: () => translate }} manager={manager} />);
  return { manager, openers, setSecret };
}

const row = (name: string) => page.getByTestId(`mcp-server-${name}`);
const status = (name: string) => page.getByTestId(`mcp-status-${name}`);

describe('панель MCP', () => {
  it('открытие показывает серверы и ничего не запускает', async () => {
    const { openers } = await mount();

    await expect
      .element(page.getByTestId('mcp-live-workers'))
      .toHaveTextContent('Живых воркеров: 0 из 3');
    await expect.element(status('fake')).toHaveTextContent('готов, не запущен');
    await expect.element(status('docs')).toHaveTextContent('нужны значения');
    await expect.element(status('local')).toHaveTextContent('недоступен');
    await expect
      .element(row('local'))
      .toHaveTextContent('локальный процесс — из браузера не запустить');
    expect(openers.opened).toEqual([]);
  });

  it('«Подключить» и «Усыпить» — статус, инструменты и счёт воркеров', async () => {
    const { openers } = await mount();

    await row('fake').getByRole('button', { name: 'Подключить' }).click();
    await expect.element(status('fake')).toHaveTextContent('работает');
    await expect.element(row('fake')).toHaveTextContent('Инструментов: 1');
    await expect
      .element(page.getByTestId('mcp-live-workers'))
      .toHaveTextContent('Живых воркеров: 1 из 3');
    expect(openers.opened).toEqual(['fake']);

    await row('fake').getByRole('button', { name: 'Показать инструменты' }).click();
    await expect.element(row('fake').getByRole('listitem')).toHaveTextContent('lookup');

    await row('fake').getByRole('button', { name: 'Усыпить' }).click();
    await expect.element(status('fake')).toHaveTextContent('спит');
    await expect
      .element(page.getByTestId('mcp-live-workers'))
      .toHaveTextContent('Живых воркеров: 0 из 3');
    expect(openers.closed).toEqual(['fake']);
  });

  it('значение переменной — паролем; «Запомнить» — флагом секрета', async () => {
    const { setSecret } = await mount();
    const field = row('docs').getByPlaceholder('Значение DOCS_TOKEN');
    const save = row('docs').getByRole('button', { name: 'Сохранить' });

    await expect.element(field).toHaveAttribute('type', 'password');
    await expect.element(save).toBeDisabled();

    await userEvent.fill(field, 'token-1');
    await row('docs').getByRole('checkbox').click();
    await save.click();

    await expect.element(status('docs')).toHaveTextContent('готов, не запущен');
    await expect.element(row('docs')).toHaveTextContent('задано');
    await expect.element(field).toHaveValue('');
    expect(setSecret).toHaveBeenCalledWith('var:DOCS_TOKEN', 'token-1', { persist: true });
  });

  it('буквальный секрет в заголовке .mcp.json — предупреждение в строке сервера', async () => {
    await mount();

    await expect
      .element(row('leaky').getByRole('alert'))
      .toHaveTextContent('в заголовке Authorization секрет записан прямо в .mcp.json');
    await expect.element(row('docs').getByRole('alert')).not.toBeInTheDocument();
  });
});
