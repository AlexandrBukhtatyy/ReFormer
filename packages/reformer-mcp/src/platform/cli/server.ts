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
import { createResourceCatalog } from '../../core/server/resource-catalog.js';
import { createToolCatalog } from '../../core/server/tool-catalog.js';
import { cliKnowledge } from './knowledge.js';

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

export interface NodeServerOptions {
  readonly version: string;
  readonly debug: boolean;
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
      // без подсказки в задании проверен прогонами (docs/plans/mcp-misty-graham.md).
      instructions:
        'To create or change a ReFormer form: author <dir>/form.intent.json and call form_build. It compiles, type-checks and writes the module to disk, so do not write module files yourself. Call form_build first to get the intent grammar. Keep the requested stack: on @reformer/core you also write the JSX markup in index.tsx. Use the documentation tools only for custom code or an unclear form_build error.',
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
      tools: createToolCatalog(cliKnowledge, { profile: 'node', debug }),
      resources: createResourceCatalog(cliKnowledge, { debug }),
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
