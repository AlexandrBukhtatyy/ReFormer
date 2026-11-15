/**
 * Сервер под Node без транспорта: каталоги инструментов и ресурсов плюс промпты.
 *
 * Отделён от `src/index.ts`, чтобы контракт сервера проверялся настоящим клиентом SDK поверх
 * транспорта в памяти, без запуска процесса.
 *
 * @module reformer-mcp/platform/cli/server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import {
  mountReformerServer,
  observeCall,
  type ReformerServerCall,
} from '../../core/server/mount.js';
import { createResourceCatalog, type ResourceCatalog } from '../../core/server/resource-catalog.js';
import { createToolCatalog } from '../../core/server/tool-catalog.js';
import { cliKnowledge } from './knowledge.js';
import { createQuickJsSandbox } from './quickjs-sandbox.js';

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
} from '../../prompts/index.js';

/**
 * Инструкции сервера: их клиент кладёт в контекст агента при подключении, раньше любого вызова.
 * Называют только инструменты профиля node.
 */
export const SERVER_INSTRUCTIONS =
  'To create or change a ReFormer form: write <dir>/form.intent.json and call form_build {"dir":"<dir>"} — it compiles, type-checks and writes the module; never write module files yourself. Grammar first: form_build {"grammar":"base"}. From a markdown spec, plan_form {"specPath":"…","dir":"<dir>"} drafts the intent. Keep the requested stack in "target"; on @reformer/core you also write the JSX markup in index.tsx. Documentation tools are for custom code or an unclear form_build error.';

/**
 * Инструкции режима Code Mode: тот же маршрут, что {@link SERVER_INSTRUCTIONS}, слово в слово по
 * смыслу, но вызовы записаны кодом для `run_script`.
 */
export const CODE_MODE_INSTRUCTIONS =
  'This server has one tool, run_script: every server tool is an async function of the global `reformer` object inside the script (see the run_script description). To create or change a ReFormer form: write <dir>/form.intent.json with your file tools, then run_script `console.log(await reformer.formBuild({ dir: "<dir>" }))` — it compiles, type-checks and writes the module; never write module files yourself. Grammar first: run_script `console.log(await reformer.formBuild({ grammar: "base" }))`. From a markdown spec, `reformer.planForm({ specPath: "…", dir: "<dir>" })` drafts the intent. Keep the requested stack in "target"; on @reformer/core you also write the JSX markup in index.tsx. Documentation functions are for custom code or an unclear formBuild error; chain several of them in one script and print only what you need.';

/**
 * Инструкции профиля guided: тот же единственный путь, но шаги называет сервер — сначала
 * `form_start`, дальше только `form_edit` по строке `Next:`.
 */
export const GUIDED_INSTRUCTIONS =
  'To create a ReFormer form: call form_start {"dir":"form","target":"<stack from the task>","task":"<the task text, word for word>"} (or "specPath" for a spec file) once. Then change the form only with form_edit — the server keeps the form and builds the module, the JSX of @reformer/core too; never write files of the form folder yourself. Every answer ends with "Next:" — do exactly that call. Stop only when an answer says "Done".';

/**
 * Инструкции связки Code Mode и guided: шаги называет сервер, как в {@link GUIDED_INSTRUCTIONS},
 * но вызовы — функции `reformer.*` внутри `run_script`. Строки `Next:` приходят уже кодом скрипта.
 * Три входа названы явно: про форму, которая уже лежит в каталоге, и про спецификацию инструкции
 * молчали — модель правила готовую форму руками в 8 из 9 правок и ни разу не передала `specPath`
 * (батч 20261114T113832Z-68e8). JSX core назван отдельно: строка задания «разметку пишешь сам в
 * JSX» читалась как разрешение писать файлы — три ячейки правки на core подряд прошли мимо сервера
 * (батчи 20261114T215823Z-1be3, …225122Z-f433, ReFormer-f2fs.15).
 */
export const CODE_GUIDED_INSTRUCTIONS =
  'This server has one tool, run_script: the form functions are async functions of the global `reformer` object inside the script. Start every form task with run_script `console.log(await reformer.formStart({ dir: "form", target: "<stack from the task>", task: "<the task text, word for word, with the stack line>" }))` — also when the form already lies in the folder and the task changes it; a task that names a markdown spec file also passes specPath. Then change the form only with reformer.formEdit — the server writes every file of the form, the JSX of @reformer/core too: never edit files in the form folder yourself. Every answer ends with "Next:" and a line of code — run it. Stop only when an answer says "Done".';

/**
 * Поверхность сервера: обычная (набор инструментов), Code Mode (один `run_script`), guided (план и
 * правки для малых моделей) или их связка `code-guided` (API guided внутри `run_script`).
 */
/** Пустой каталог ресурсов — для профилей guided. */
const NO_RESOURCES: ResourceCatalog = {
  list: () => [],
  templates: () => [],
  read: (uri: string) => {
    throw new Error(
      `No resources in this profile (${uri}): the server plans the form — follow "Next:" of the last answer.`
    );
  },
};

export type ServerSurface = 'tools' | 'code' | 'guided' | 'code-guided';

export interface NodeServerOptions {
  readonly version: string;
  readonly debug: boolean;
  /** `code` — эксперимент Code Mode (`REFORMER_SURFACE=code`); по умолчанию `tools`. */
  readonly surface?: ServerSurface;
  /** Наблюдатель вызовов инструментов, ресурсов и промптов (см. `MountOptions.onCall`). */
  readonly onCall?: (call: ReformerServerCall) => void;
}

type AnyPromptDefinition =
  | typeof startHerePromptDefinition
  | typeof reviewPromptDefinition
  | typeof debugPromptDefinition
  | typeof planFormPromptDefinition
  | typeof createFormPromptDefinition
  | typeof addFeaturePromptDefinition
  | typeof toRendererPromptDefinition
  | typeof discoverContextPromptDefinition;

export function createNodeServer(options: NodeServerOptions): Server {
  const { version, debug, onCall } = options;
  const codeMode = options.surface === 'code' || options.surface === 'code-guided';
  const guided = options.surface === 'guided' || options.surface === 'code-guided';

  const server = new Server(
    {
      name: 'reformer-mcp',
      version,
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
      // Без этого агенты на больших формах шли за справкой и писали код вручную: выбор пути
      // без подсказки в задании проверен прогонами (docs/plans/mcp-misty-graham.md). Путь один
      // (7.0): intent → form_build; грамматика — по запросу, без проекта (аудит 2026-11, A1/A6).
      instructions:
        codeMode && guided
          ? CODE_GUIDED_INSTRUCTIONS
          : codeMode
            ? CODE_MODE_INSTRUCTIONS
            : guided
              ? GUIDED_INSTRUCTIONS
              : SERVER_INSTRUCTIONS,
    }
  );

  // ==================== TOOLS & RESOURCES ====================
  //
  // Список и диспетчер инструментов, схема адресов ресурсов — в `core/server`: те же каталоги
  // поднимает браузерный воркер (`platform/worker/server.ts`), и копия здесь разъехалась бы с ними.
  // Под Node знание — над файлами пакетов (`cliKnowledge`), профиль `node`: с `report_issue`,
  // `debug` по флагу и `specPath` у `plan_form`.

  mountReformerServer(
    server,
    {
      tools: createToolCatalog(cliKnowledge, {
        profile: 'node',
        debug,
        ...(codeMode ? { codeMode: createQuickJsSandbox() } : {}),
        ...(guided ? { guided: true } : {}),
      }),
      // В профилях guided справки нет и в ресурсах: модель читала reformer://docs/… по десять раз и
      // писала index.tsx руками с выдуманным API (L3-delivery, 20261113T230859Z-f59e).
      resources: guided ? NO_RESOURCES : createResourceCatalog(cliKnowledge, { debug }),
    },
    { onCall }
  );

  // ==================== PROMPTS ====================

  /** Промпты, которые видит клиент: `debug` — только в отладочном режиме. */
  function listedPrompts(): AnyPromptDefinition[] {
    const prompts: AnyPromptDefinition[] = [
      startHerePromptDefinition,
      discoverContextPromptDefinition,
      reviewPromptDefinition,
      planFormPromptDefinition,
      createFormPromptDefinition,
      addFeaturePromptDefinition,
      toRendererPromptDefinition,
    ];
    if (debug) {
      prompts.push(debugPromptDefinition);
    }
    return prompts;
  }

  async function getPrompt(name: string, args: Record<string, string> | undefined) {
    // Неизвестное имя и пропущенный обязательный аргумент — ошибка параметров (-32602), как требует
    // спецификация MCP. Раньше `review` без `code` молча рендерился с пустым блоком кода, а
    // неизвестный промпт давал -32603 «внутренняя ошибка» (калибровка, smoke S11).
    const definition = listedPrompts().find((p) => p.name === name);
    if (!definition) throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
    const provided = (arg: string): string =>
      String(
        args?.[arg] ?? (name === 'add-feature' && arg === 'requirements' ? args?.steps : '') ?? ''
      ).trim();
    const missing = (
      (definition.arguments ?? []) as ReadonlyArray<{ name: string; required?: boolean }>
    )
      .filter((a) => a.required && !provided(a.name))
      .map((a) => `\`${a.name}\``);
    if (missing.length > 0) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Prompt ${name}: missing required argument(s) ${missing.join(', ')}.`
      );
    }

    switch (name) {
      case 'debug':
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
        throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
    }
  }

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: listedPrompts() }));

  server.setRequestHandler(GetPromptRequestSchema, (request) => {
    const { name, arguments: args } = request.params;
    return onCall
      ? observeCall(onCall, { kind: 'prompt', name, arguments: args }, () => getPrompt(name, args))
      : getPrompt(name, args);
  });

  return server;
}
