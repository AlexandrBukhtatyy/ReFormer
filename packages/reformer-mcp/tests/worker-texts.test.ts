/**
 * Тексты воркера называют только его инструменты (фаза 5 аудита, ReFormer-11oe.6).
 *
 * Воркер — справочный канал ассистента конструктора: `form_build`, `plan_form` и `report_issue`
 * у него нет, форму собирает инструмент хоста. Совет «вызови form_build» там — тупик для модели.
 * Проверяется всё, что воркер отдаёт: `instructions`, описания инструментов и ресурсов, ресурсы и
 * ответы инструментов на типовые запросы. Корпус — как у бандла воркера: без документации MCP.
 */

import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BUNDLE_SCHEMA_VERSION, type DocsBundle, type IndexBundle } from '../src/core/bundle';
import { BROWSER_PACKAGES, packageDirName } from '../src/core/docs/packages';
import { createPortTransport } from '../src/platform/worker/port-transport';
import { startWorkerServer } from '../src/platform/worker/server';
import { precondition } from './support/preconditions';

const repoRoot = resolve(__dirname, '../../..');

/** Инструменты, которых у воркера нет: их имена в его текстах — ошибка. */
const NODE_ONLY = /\b(form_build|plan_form|generate_form|report_issue)\b/;

/** Каталог кита — как у бандла воркера: без него судья не сверяет компоненты и пропсы. */
function loadUiKitCatalog(): unknown {
  try {
    const file = createRequire(__filename).resolve('@reformer/ui-kit/catalog');
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return undefined;
  }
}

function loadBundles(): { index: IndexBundle; docs: DocsBundle; uiKitCatalog: unknown } | null {
  const index: IndexBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  const docs: DocsBundle = { schemaVersion: BUNDLE_SCHEMA_VERSION, builtAt: '', packages: {} };
  for (const pkg of BROWSER_PACKAGES) {
    const dir = resolve(repoRoot, 'packages', packageDirName(pkg));
    const indexFile = resolve(dir, 'llms-index.json');
    const docsFile = resolve(dir, 'llms.txt');
    if (existsSync(indexFile)) index.packages[pkg] = JSON.parse(readFileSync(indexFile, 'utf8'));
    if (existsSync(docsFile)) docs.packages[pkg] = readFileSync(docsFile, 'utf8');
  }
  return Object.keys(index.packages).length > 0
    ? { index, docs, uiKitCatalog: loadUiKitCatalog() }
    : null;
}

const bundles = loadBundles();

const textOf = (result: Record<string, unknown>): string =>
  ((result.content ?? result.contents) as Array<{ text?: string }>)
    .map((part) => part.text ?? '')
    .join('\n');

/** Типовые вызовы каждого инструмента воркера: то, что ассистент спрашивает чаще всего. */
const CALLS: Array<[string, Record<string, unknown>]> = [
  ['choose_api', { requirement: 'поле доступно только когда чекбокс отмечен' }],
  ['choose_api', { requirement: 'total = price * quantity' }],
  ['choose_api', { requirement: 'мастер из трёх шагов' }],
  ['choose_api', { requirement: 'список контактов с добавлением строк' }],
  ['choose_api', { requirement: 'пароль и подтверждение совпадают' }],
  ['get_context', { task: 'сделать форму заявки с мастером и массивом' }],
  ['get_context', { task: 'валидация email и телефона' }],
  ['find_recipe', { topic: 'wizard' }],
  ['find_recipe', { topic: 'form-array' }],
  ['find_recipe', { topic: 'copy-from' }],
  ['find_recipe', { topic: 'json-schema' }],
  ['find_recipe', { topic: 'directory-layout' }],
  ['search_docs', { query: 'wizard step validation' }],
  ['search_docs', { query: 'create form intent' }],
  ['list_symbols', { package: 'core', nameContains: 'compute' }],
  ['get_symbol_docs', { symbol: 'createForm' }],
  ['validate_form', { kind: 'code', code: "import { nope } from '@reformer/core';" }],
  ['validate_form', { kind: 'json-schema', schema: { format: 2, root: { component: 'X' } } }],
  [
    'validate_form',
    { kind: 'bundle', intent: { formName: 'X', fields: [{ name: 'a', type: 'string' }] } },
  ],
  [
    'validate_form',
    {
      kind: 'bundle',
      intent: {
        formName: 'X',
        target: 'renderer-react',
        fields: [
          { name: 'a', type: 'string', component: 'TextFeld' },
          { name: 'b', type: 'string', component: 'Input' },
        ],
        layoutRoot: {
          kind: 'container',
          component: 'Box',
          children: [
            'a',
            'b',
            { kind: 'container', component: 'Button', componentProps: { colour: 'red' } },
          ],
        },
      },
    },
  ],
  ['validate_form', { kind: 'layout', files: ['index.tsx', 'schema.ts'], target: 'core' }],
  [
    'validate_form',
    {
      kind: 'json-schema',
      schema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: {},
      },
    },
  ],
  [
    'validate_form',
    {
      kind: 'behaviors',
      dependencies: [
        { target: 'a', reads: ['b'] },
        { target: 'b', reads: ['a'] },
      ],
    },
  ],
];

describe.runIf(
  precondition(
    'корпус пакетов',
    bundles !== null,
    'npm run build в пакетах (llms.txt, llms-index.json)'
  )
)('тексты воркера называют только его инструменты', () => {
  const channel = new MessageChannel();
  let client: Client;
  const texts: Array<{ where: string; text: string }> = [];

  beforeAll(async () => {
    startWorkerServer({ port: channel.port1, version: '0.0.0-test', corpus: () => bundles! });
    client = new Client({ name: 'worker-texts-test', version: '1.0.0' });
    await client.connect(createPortTransport(channel.port2));

    texts.push({ where: 'instructions', text: client.getInstructions() ?? '' });
    const { tools } = await client.listTools();
    for (const tool of tools) {
      texts.push({ where: `tools/list ${tool.name}`, text: JSON.stringify(tool) });
    }
    const { resources } = await client.listResources();
    for (const resource of resources) {
      texts.push({ where: `resources/list ${resource.uri}`, text: JSON.stringify(resource) });
      const read = await client.readResource({ uri: resource.uri });
      texts.push({ where: `read ${resource.uri}`, text: textOf(read) });
    }
    const { resourceTemplates } = await client.listResourceTemplates();
    for (const template of resourceTemplates) {
      texts.push({ where: `templates ${template.uriTemplate}`, text: JSON.stringify(template) });
    }
    for (const [name, args] of CALLS) {
      const result = await client.callTool({ name, arguments: args });
      texts.push({ where: `${name} ${JSON.stringify(args)}`, text: textOf(result) });
    }
  }, 120_000);

  afterAll(() => {
    channel.port1.close();
    channel.port2.close();
  });

  it('у воркера свои instructions: справочный канал, без инструментов сборки', () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('choose_api');
    expect(instructions).not.toMatch(NODE_ONLY);
  });

  it('ни один текст не называет form_build, plan_form, generate_form или report_issue', () => {
    const violations = texts.flatMap(({ where, text }) =>
      [...text.matchAll(new RegExp(NODE_ONLY.source, 'g'))].map(({ index: at }) => {
        const around = text.slice(Math.max(0, at - 80), at + 60).replace(/\s+/g, ' ');
        return `${where}: …${around}…`;
      })
    );
    expect(violations).toEqual([]);
  });

  it('instructions и гайд совпадают со снимками и держат потолки', async () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions.length).toBeLessThan(600);
    await expect(`${instructions}\n`).toMatchFileSnapshot(
      '__golden__/surface/instructions.browser.txt'
    );
    const guide = textOf(await client.readResource({ uri: 'reformer://guide' }));
    expect(Buffer.byteLength(guide)).toBeLessThanOrEqual(2 * 1024);
    await expect(`${guide}\n`).toMatchFileSnapshot('__golden__/surface/guide.browser.md');
  });

  it('ресурсы — корпус браузера: документации MCP нет', async () => {
    const { resources } = await client.listResources();
    const docs = resources
      .map(({ uri }) => uri)
      .filter((uri) => uri.startsWith('reformer://docs/'));
    expect(docs).not.toContain('reformer://docs/mcp');
    expect(docs.length).toBeGreaterThan(0);
  });
});
