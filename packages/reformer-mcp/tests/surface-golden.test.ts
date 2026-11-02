/**
 * Поверхность сервера — то, что агент платит за подключение и читает раньше любого ответа: имена,
 * описания и схемы инструментов, промпты, шаблоны ресурсов. Снимок делает любую её правку видимой
 * в ревью, а потолки не дают ей незаметно разрастись. Пороги согласованы с `static` в
 * `docs/mcp-eval/baseline.json` и лежат выше него на запас: точный гейт — `mcp:evaluate`.
 *
 * Осознанная правка поверхности: `npx vitest run tests/surface-golden.test.ts -u` и разбор диффа.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createNodeServer } from '../src/platform/cli/server';

const TOOLS_TOKENS_CEILING = 2800;
const STATIC_TOKENS_CEILING = 4600;

/** Та же оценка, что у `mcp:evaluate`. */
const tokensOf = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);
const stable = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

describe('поверхность сервера', () => {
  let client: Client;

  beforeAll(async () => {
    const server = createNodeServer({ version: '0.0.0', debug: false });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'surface-golden', version: '0.0.0' });
    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('инструменты профиля node совпадают со снимком', async () => {
    const { tools } = await client.listTools();
    await expect(stable(tools)).toMatchFileSnapshot('__golden__/surface/tools.node.json');
  });

  it('инструменты профиля browser совпадают со снимком', async () => {
    const tools = createToolCatalog(cliKnowledge, { profile: 'browser' }).list();
    await expect(stable(tools)).toMatchFileSnapshot('__golden__/surface/tools.browser.json');
  });

  it('промпты совпадают со снимком', async () => {
    const { prompts } = await client.listPrompts();
    await expect(stable(prompts)).toMatchFileSnapshot('__golden__/surface/prompts.json');
  });

  it('шаблоны ресурсов совпадают со снимком', async () => {
    const { resourceTemplates } = await client.listResourceTemplates();
    await expect(stable(resourceTemplates)).toMatchFileSnapshot(
      '__golden__/surface/resource-templates.json'
    );
  });

  it('цена подключения не выходит за потолки', async () => {
    const tools = await client.listTools();
    const resources = await client.listResources();
    const prompts = await client.listPrompts();
    const toolsTokens = tokensOf(tools);
    const staticTokens = toolsTokens + tokensOf(resources) + tokensOf(prompts);
    expect(toolsTokens, 'tools/list').toBeLessThanOrEqual(TOOLS_TOKENS_CEILING);
    expect(staticTokens, 'tools + resources + prompts').toBeLessThanOrEqual(STATIC_TOKENS_CEILING);
  });
});
