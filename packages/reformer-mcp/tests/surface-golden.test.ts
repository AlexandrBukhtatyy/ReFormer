/**
 * Поверхность сервера — то, что агент платит за подключение и читает раньше любого ответа: имена,
 * описания и схемы инструментов, промпты, шаблоны ресурсов. Снимок делает любую её правку видимой
 * в ревью, а потолки не дают ей незаметно разрастись. Пороги согласованы с `static` в
 * `eval/baselines/baseline.json` и лежат выше него на запас: точный гейт — `mcp:evaluate`.
 *
 * Осознанная правка поверхности: `npx vitest run tests/surface-golden.test.ts -u` и разбор диффа.
 */

import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  GRAMMAR_ALL_LIMIT,
  GRAMMAR_BASE_LIMIT,
  intentGrammar,
} from '../src/core/generate/intent-grammar';
import { GUIDE_LIMIT_BYTES } from '../src/core/server/resource-catalog';
import { createToolCatalog } from '../src/core/server/tool-catalog';
import { cliKnowledge } from '../src/platform/cli/knowledge';
import { createNodeServer } from '../src/platform/cli/server';
import { CATALOGS } from './support/catalogs';

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

describe('тексты профиля node — один путь (аудит 2026-11, A1)', () => {
  /** Ручная сборка модуля: так учили прежние описания и промпты. */
  const MANUAL_ASSEMBLY =
    /you write the files yourself|create (the|these) files yourself|создайте сами|Сервер на диск не пишет|write (the )?(model|form\.schema|form\.validation|form\.behavior)\.ts/i;

  let client: Client;
  beforeAll(async () => {
    const server = createNodeServer({ version: '0.0.0', debug: false });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'one-path', version: '0.0.0' });
    await client.connect(clientTransport);
  });
  afterAll(async () => {
    await client.close();
  });

  /** Всё, что агент читает от сервера под Node, кроме ответов справочных инструментов. */
  async function nodeTexts(): Promise<Array<[string, string]>> {
    const texts: Array<[string, string]> = [['instructions', client.getInstructions() ?? '']];
    texts.push(['tools/list', JSON.stringify((await client.listTools()).tools)]);
    texts.push(['prompts/list', JSON.stringify((await client.listPrompts()).prompts)]);
    texts.push(['resources/list', JSON.stringify((await client.listResources()).resources)]);
    const guide = await client.readResource({ uri: 'reformer://guide' });
    texts.push(['reformer://guide', (guide.contents[0] as { text: string }).text]);
    const grammar = await client.callTool({ name: 'form_build', arguments: { grammar: 'all' } });
    texts.push(['grammar', (grammar.content as Array<{ text: string }>)[0].text]);
    const spec = resolve(__dirname, 'fixtures/spec-loan-request.md');
    const prompts: Array<[string, Record<string, string>]> = [
      ['start-here', {}],
      ['create-form', { description: 'Feedback: name, email, message', target: 'core' }],
      ['plan-form', { specPath: spec, target: 'renderer-react' }],
      ['add-feature', { feature: 'validation', requirements: 'email is required' }],
      ['add-feature', { feature: 'wizard', requirements: 'two steps' }],
      ['to-renderer', { target: 'renderer-json' }],
    ];
    for (const [name, args] of prompts) {
      const { messages } = await client.getPrompt({ name, arguments: args });
      texts.push([`prompt ${name}`, (messages[0].content as { text: string }).text]);
    }
    return texts;
  }

  it('ни один текст не советует generate_form и ручную сборку модуля', async () => {
    const offending = (await nodeTexts()).filter(
      ([, text]) => /generate_form/.test(text) || MANUAL_ASSEMBLY.test(text)
    );
    expect(offending.map(([where]) => where)).toEqual([]);
  }, 60_000);

  it('путь к форме назван везде, где форма создаётся', async () => {
    for (const [where, text] of await nodeTexts()) {
      if (where === 'resources/list' || where === 'grammar') continue;
      expect(text, where).toContain('form_build');
    }
  }, 60_000);

  it('грамматика, guide и инструкции совпадают со снимками и держат потолки', async () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions.length).toBeLessThan(500);
    await expect(`${instructions}\n`).toMatchFileSnapshot('__golden__/surface/instructions.txt');

    const base = intentGrammar(CATALOGS);
    const all = intentGrammar(CATALOGS, { sections: 'all' });
    expect(base.length).toBeLessThanOrEqual(GRAMMAR_BASE_LIMIT);
    expect(all.length).toBeLessThanOrEqual(GRAMMAR_ALL_LIMIT);
    await expect(base).toMatchFileSnapshot('__golden__/surface/grammar.base.md');
    await expect(all).toMatchFileSnapshot('__golden__/surface/grammar.all.md');

    const guide = (
      (await client.readResource({ uri: 'reformer://guide' })).contents[0] as { text: string }
    ).text;
    expect(Buffer.byteLength(guide)).toBeLessThanOrEqual(GUIDE_LIMIT_BYTES);
    await expect(guide).toMatchFileSnapshot('__golden__/surface/guide.md');
  });
});
