#!/usr/bin/env node

import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { cliKnowledge } from './platform/cli/knowledge.js';
import {
  getFullDocs,
  getSectionBySlug,
  listSections,
  listAvailablePackages,
} from './utils/docs-parser.js';

/**
 * Resolve `<pkg-short>` (e.g. "core", "cdk") to its full package name.
 * Returns null for unknown short names or packages without llms.txt.
 */
function resolvePackage(short: string): string | null {
  if (!short) return null;
  const full = `@reformer/${short}`;
  return (listAvailablePackages() as readonly string[]).includes(full) ? full : null;
}

function packageShortName(pkg: string): string {
  return pkg.replace(/^@reformer\//, '');
}

// Tools
import {
  debugToolDefinition,
  debugTool,
  reportIssueToolDefinition,
  reportIssueTool,
  type ReportIssueArgs,
  getSymbolDocsToolDefinition,
  getSymbolDocsTool,
  findRecipeToolDefinition,
  findRecipeTool,
  validateJsonSchemaToolDefinition,
  validateJsonSchemaTool,
  listSymbolsToolDefinition,
  listSymbolsTool,
  searchDocsToolDefinition,
  searchDocsTool,
  checkBehaviorsToolDefinition,
  checkBehaviorsTool,
  chooseApiToolDefinition,
  chooseApiTool,
  getContextToolDefinition,
  getContextTool,
  planFormToolDefinition,
  planFormTool,
  generateFormToolDefinition,
  generateFormTool,
  validateFormToolDefinition,
  validateFormTool,
} from './tools/index.js';

// Prompts
import {
  debugPromptDefinition,
  getDebugPrompt,
  startHerePromptDefinition,
  getStartHerePrompt,
  reviewPromptDefinition,
  getReviewPrompt,
  planFormPromptDefinition,
  getPlanFormPrompt,
  createFormPromptDefinition,
  getCreateFormPrompt,
  addFeaturePromptDefinition,
  getAddFeaturePrompt,
  toRendererPromptDefinition,
  getToRendererPrompt,
  discoverContextPromptDefinition,
  getDiscoverContextPrompt,
} from './prompts/index.js';

// Check debug mode
const isDebugMode = process.env.REFORMER_DEBUG === 'true';

// Env config (set in the MCP server registration `.mcp.json` env, like REFORMER_DEBUG):
//   REFORMER_FORM_LAYOUT = 'minimalist' (default) | 'folders'
//     → default file layout the `create-form` prompt steers toward. Read in prompts/create-form.ts.
//     ВАЖНО: ручка действует только в prompt-канале, а он доходит не до всякого клиента — замер
//     показал агентов, у которых `prompts/list` и `prompts/get` недоступны в принципе. Поэтому
//     раскладку по умолчанию (`minimalist`) дублируют tool-поверхность (описания `plan_form` /
//     `generate_form`, чек-лист в манифесте) и вводный блок `reformer://guide`.

// Версия из package.json пакета — иначе клиент видел захардкоженный литерал (в 11.0.0
// сервер отдавал '6.0.0', что читалось как «npx отдаёт протухший кэш»). Читаем от dist/
// (../package.json относительно dist/index.js), с безопасным фолбэком.
function readServerVersion(): string {
  try {
    const pkgPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
    return JSON.parse(readFileSync(pkgPath, 'utf-8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

// Server instance
const server = new Server(
  {
    name: 'reformer-mcp',
    version: readServerVersion(),
  },
  {
    // `sampling` здесь НЕ объявляем: это capability КЛИЕНТА, а не сервера — сервер лишь
    // запрашивает sampling через `server.createMessage(...)`. SDK ≥1.30 типом это и
    // фиксирует (ServerCapabilities больше не принимает `sampling`). На сам механизм
    // это не влияет: `isSamplingSupported()` смотрит `server.getClientCapabilities()`.
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// ==================== TOOLS ====================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools: Array<
    | typeof reportIssueToolDefinition
    | typeof debugToolDefinition
    | typeof getSymbolDocsToolDefinition
    | typeof findRecipeToolDefinition
    | typeof validateJsonSchemaToolDefinition
    | typeof listSymbolsToolDefinition
    | typeof searchDocsToolDefinition
    | typeof checkBehaviorsToolDefinition
    | typeof chooseApiToolDefinition
    | typeof getContextToolDefinition
    | typeof planFormToolDefinition
    | typeof generateFormToolDefinition
    | typeof validateFormToolDefinition
  > = [
    getContextToolDefinition,
    chooseApiToolDefinition,
    getSymbolDocsToolDefinition,
    findRecipeToolDefinition,
    searchDocsToolDefinition,
    listSymbolsToolDefinition,
    validateFormToolDefinition,
    planFormToolDefinition,
    generateFormToolDefinition,
    reportIssueToolDefinition,
  ];
  if (isDebugMode) {
    tools.push(debugToolDefinition);
  }
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'report_issue':
      return await reportIssueTool(args as unknown as ReportIssueArgs, cliKnowledge());

    case 'debug':
      if (!isDebugMode) {
        throw new Error(`Unknown tool: ${name}`);
      }
      return await debugTool(args as { section?: string }, cliKnowledge());

    case 'validate_form':
      return await validateFormTool(args as Record<string, unknown>, cliKnowledge());

    case 'plan_form':
      return await planFormTool(
        args as { specPath?: string; description?: string; target?: string },
        cliKnowledge()
      );

    case 'generate_form':
      return await generateFormTool(args as { intent: Record<string, unknown>; target?: string });

    case 'get_context':
      return await getContextTool(
        args as {
          task: string;
          topics?: string[];
          target?: string;
          profile?: string;
          maxTokens?: number;
        },
        cliKnowledge()
      );

    case 'choose_api':
      return await chooseApiTool(args as { requirement: string; target?: string }, cliKnowledge());

    case 'get_symbol_docs':
      return await getSymbolDocsTool(args as { symbol: string; package?: string }, cliKnowledge());

    case 'find_recipe':
      return await findRecipeTool(args as { topic: string; package?: string }, cliKnowledge());

    case 'validate_json_schema':
      return await validateJsonSchemaTool(
        args as { schema: unknown; componentNames?: string[]; dataSourceNames?: string[] }
      );

    case 'list_symbols':
      return await listSymbolsTool(
        args as {
          kind?: 'function' | 'class' | 'interface' | 'type' | 'const' | 'enum';
          package?: string;
          nameContains?: string;
        },
        cliKnowledge()
      );

    case 'search_docs':
      return await searchDocsTool(
        args as { query?: string; package?: string; limit?: number },
        cliKnowledge()
      );

    case 'check_behaviors':
      return await checkBehaviorsTool(
        args as { dependencies: Array<{ target: string; reads: string[] }> }
      );

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ==================== RESOURCES ====================
//
// URI scheme:
//   reformer://catalog                      — machine-readable map of packages → sections
//   reformer://docs/<pkg-short>             — full llms.txt of one package
//   reformer://docs/<pkg-short>/<section>   — single level-2 section, by slug
//
// Section slugs come from listSections() which parses llms.txt headers and
// applies slugify(). Slugs are stable as long as section titles don't change
// upstream.
//
// Почему секции БОЛЬШЕ НЕ перечисляются в resources/list:
//   Замерено на этом сервере — `resources/list` отдавал 350 записей ≈ 20 900 токенов, и это
//   платил КАЖДЫЙ клиент при подключении, до первого полезного действия (для сравнения:
//   tools/list ≈ 2 291, prompts/list ≈ 1 564). 350 × 200-символьный preview — самая большая
//   единичная статья расхода во всём сервере.
//   Теперь список — 8 записей, а полный перечень секций доступен по требованию через
//   `reformer://catalog` (компактный JSON без preview) и через `search_docs`, который и так
//   возвращает готовые `reformer://docs/…` URI. Сами URI секций читаются как раньше.

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [];

  // Entry-point alias — full self-doc of the MCP server (workflow + tools + prompts + resources).
  resources.push({
    uri: 'reformer://guide',
    name: 'ReFormer MCP — start-here guide',
    description:
      'Entry point: the canonical M1 form-building workflow, the mandatory flat form file layout (`form.` = model, `renderer.` = render), and a map of which MCP tool/resource to use at each step; the layout rule is in the opening lines.',
    mimeType: 'text/markdown',
  });

  resources.push({
    uri: 'reformer://catalog',
    name: 'ReFormer docs catalog',
    description:
      'JSON map of every package → its documentation sections (slug + title). Read it to discover reformer://docs/<pkg>/<slug> URIs; use search_docs when you can describe the task in words.',
    mimeType: 'application/json',
  });

  for (const pkg of listAvailablePackages()) {
    const short = packageShortName(pkg);
    resources.push({
      uri: `reformer://docs/${short}`,
      name: `${pkg} (full docs)`,
      description: `Full llms.txt for ${pkg} — ${listSections(pkg).length} sections concatenated. Individual sections: reformer://docs/${short}/<slug> (see reformer://catalog).`,
      mimeType: 'text/markdown',
    });
  }

  if (isDebugMode) {
    resources.push({
      uri: 'reformer://debug',
      name: 'Debug Info',
      description: 'Debug information for MCP server development',
      mimeType: 'text/markdown',
    });
  }

  return { resources };
});

/**
 * Compact catalog of everything readable under `reformer://docs/…`.
 *
 * Replaces the per-section entries that used to bloat `resources/list`: same discoverability,
 * paid only when an agent actually asks for it (~22k chars for all 343 sections vs ~84k for
 * the old listing, which every client paid at connection time).
 */
function buildCatalog(): string {
  // Компактно и без отступов: 343 секции — уже ~30k символов одними заголовками, а
  // pretty-print добавляет к ним ещё треть. Секция описывается парой [slug, title],
  // потому что больше для сборки URI ничего не нужно.
  //
  // Именно МАССИВ пар, а не объект `{ slug: title }`: слаг может оказаться числовым
  // (`"1"` ← «61. Путь 1 — строковые пропы» — кириллица вырезается slugify), а JS
  // поднимает целочисленные ключи объекта в начало, ломая порядок документа.
  return JSON.stringify({
    readSection: 'reformer://docs/<package>/<slug>',
    sectionShape: '[slug, title]',
    hint: 'Prefer search_docs(query) — it returns ready URIs. Scan this catalog only when you need the full map.',
    packages: listAvailablePackages().map((pkg) => ({
      id: packageShortName(pkg),
      sections: listSections(pkg).map((s) => [s.slug, s.title]),
    })),
  });
}

/**
 * Сводка правила раскладки файлов — печатается ПЕРЕД полным текстом гайда.
 *
 * `reformer://guide` отдаёт весь llms.txt пакета (~47 КБ), и замер
 * (`docs/plans/mcp-layout-authority.md`) показал: имена файлов формы доезжали до агента ровно
 * одним способом — чтением этого документа целиком. Прогон точечными запросами получил 5/10
 * совпадений с каноном, прогон, начавший с guide, — 8/9. Правило, стоящее первым абзацем,
 * доезжает и до тех, кто читает только начало; полный per-target список остаётся ниже по тексту
 * и в `find_recipe directory-layout`.
 */
const FORM_LAYOUT_ENTRY = [
  '> **Form file layout — read this even if you read nothing else here.**',
  '>',
  '> A form module is FLAT: no `lib/` / `schema/` / `components/steps/` nesting, ALL wizard steps',
  '> inline in `index.tsx`. Plain-named files: `index.tsx`, `types.ts`, `model.ts`,',
  '> `validation.ts`, `data-sources.ts`, `api.ts`. Only the two layer-variable concerns carry a',
  '> dot-prefix — `form.` = model layer, `renderer.` = render layer:',
  '>',
  '> - **schema** — `form.schema.ts` (core) / `renderer.schema.ts` (renderer-react and',
  '>   renderer-json; `.tsx` when the schema contains JSX). For renderer-json a plain',
  '>   `renderer.schema.json` is an accepted variant, but it loses compile-time checking of',
  '>   `$model(...)` paths that `defineJsonSchema<T>` gives.',
  '> - **behavior** — `form.behavior.ts` (model behavior, every target) + `renderer.behavior.ts`',
  '>   (render behavior, both renderers).',
  '>',
  '> renderer-json also has `registry.ts`, and may add an optional `renderer.wizard.tsx` shim',
  '> (the library exports no `RendererFormWizard`). File names are not a free choice. Full',
  '> per-target list: `find_recipe directory-layout`, or the "Form directory layout" section below.',
  '> Check the names you picked with `validate_form kind="layout"` — before writing, not after.',
  '',
].join('\n');

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  // Entry-point alias → full self-doc of the MCP server.
  if (uri === 'reformer://guide') {
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `${FORM_LAYOUT_ENTRY}\n${getFullDocs('@reformer/mcp')}`,
        },
      ],
    };
  }

  if (uri === 'reformer://catalog') {
    return {
      contents: [{ uri, mimeType: 'application/json', text: buildCatalog() }],
    };
  }

  if (uri === 'reformer://debug') {
    if (!isDebugMode) {
      throw new Error(`Unknown resource: ${uri}`);
    }
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: `# Debug Info\n\nAvailable packages: ${listAvailablePackages().join(', ')}`,
        },
      ],
    };
  }

  // Parse reformer://docs/<pkg-short>[/<section-slug>]
  const match = uri.match(/^reformer:\/\/docs\/([^/]+)(?:\/(.+))?$/);
  if (!match) {
    throw new Error(
      `Unknown resource: ${uri}. Expected reformer://docs/<package>[/<section-slug>].`
    );
  }
  const [, short, slug] = match;
  const pkg = resolvePackage(short);
  if (!pkg) {
    const known = listAvailablePackages()
      .map((p) => packageShortName(p))
      .join(', ');
    throw new Error(`Unknown package "${short}". Available: ${known}.`);
  }

  if (!slug) {
    return {
      contents: [{ uri, mimeType: 'text/markdown', text: getFullDocs(pkg) }],
    };
  }

  const text = getSectionBySlug(pkg, slug);
  if (text === null) {
    const available = listSections(pkg)
      .map((s) => s.slug)
      .join(', ');
    throw new Error(`Unknown section "${slug}" in ${pkg}. Available: ${available}.`);
  }
  return {
    contents: [{ uri, mimeType: 'text/markdown', text }],
  };
});

// ==================== PROMPTS ====================

type AnyPromptDefinition =
  | typeof startHerePromptDefinition
  | typeof reviewPromptDefinition
  | typeof debugPromptDefinition
  | typeof planFormPromptDefinition
  | typeof createFormPromptDefinition
  | typeof addFeaturePromptDefinition
  | typeof toRendererPromptDefinition
  | typeof discoverContextPromptDefinition;

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  const prompts: AnyPromptDefinition[] = [
    startHerePromptDefinition,
    discoverContextPromptDefinition,
    reviewPromptDefinition,
    planFormPromptDefinition,
    createFormPromptDefinition,
    addFeaturePromptDefinition,
    toRendererPromptDefinition,
  ];
  if (isDebugMode) {
    prompts.push(debugPromptDefinition);
  }
  return { prompts };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'debug':
      if (!isDebugMode) {
        throw new Error(`Unknown prompt: ${name}`);
      }
      return await getDebugPrompt(args as { code: string });

    case 'start-here':
      return getStartHerePrompt();

    case 'review':
      return await getReviewPrompt(args as { code: string });

    case 'plan-form':
      return await getPlanFormPrompt(
        args as { specPath: string; target?: string; projectPath?: string },
        server
      );

    case 'create-form':
      return await getCreateFormPrompt(
        args as { description: string; target?: string; projectPath?: string },
        server
      );

    case 'discover-context':
      return await getDiscoverContextPrompt(
        args as { description: string; projectPath?: string },
        server
      );

    case 'add-feature':
      return await getAddFeaturePrompt(
        args as { feature?: string; code?: string; requirements?: string; steps?: string }
      );

    case 'to-renderer':
      return await getToRendererPrompt(args as { code?: string; target?: string });

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
});

// ==================== START SERVER ====================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr (not stdout, which is used for MCP communication)
  console.error(`ReFormer MCP Server started${isDebugMode ? ' (DEBUG MODE)' : ''}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
