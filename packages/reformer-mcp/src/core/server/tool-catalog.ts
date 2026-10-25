/**
 * Каталог инструментов сервера — их список и диспетчер вызова, общие для всех платформ.
 *
 * Раньше то и другое жило в `src/index.ts` вперемешку с Node-кодом сервера: список в обработчике
 * `tools/list`, `switch` по имени в обработчике `tools/call`. Поднять тот же сервер в браузерном
 * воркере значило бы скопировать оба, а копия разъехалась бы с оригиналом на первом же новом
 * инструменте. Здесь они одни на обе среды; платформа отличается только знанием, которое
 * подставляет, и профилем.
 *
 * ## Профиль
 *
 * `node` — сервер под Node, как всегда. `browser` — воркер в браузере, где нет диска:
 *
 * - нет `report_issue`: отчёт лёг бы в память воркера и пропал, а инструмент ответил бы
 *   «сохранено» — обещание, которое никто не выполнит;
 * - нет `debug`;
 * - у `plan_form` нет `specPath`: спеку по пути воркеру прочитать неоткуда, работает
 *   `description`.
 *
 * `validate_json_schema` и `check_behaviors` в списке не значатся (их заменил `validate_form`), но
 * вызываются по имени у обоих профилей — как и прежде.
 *
 * @module reformer-mcp/core/server/tool-catalog
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Knowledge } from '../knowledge.js';
import { checkBehaviorsTool } from '../tools/check-behaviors.js';
import { chooseApiTool, chooseApiToolDefinition } from '../tools/choose-api.js';
import { debugTool, debugToolDefinition } from '../tools/debug.js';
import { findRecipeTool, findRecipeToolDefinition } from '../tools/find-recipe.js';
import {
  generateFormTool,
  generateFormToolDefinition,
  planFormTool,
  planFormToolDefinition,
} from '../tools/generate-form.js';
import { getContextTool, getContextToolDefinition } from '../tools/get-context.js';
import { getSymbolDocsTool, getSymbolDocsToolDefinition } from '../tools/get-symbol-docs.js';
import { listSymbolsTool, listSymbolsToolDefinition } from '../tools/list-symbols.js';
import { reportIssueTool, reportIssueToolDefinition } from '../tools/report-issue.js';
import { searchDocsTool, searchDocsToolDefinition } from '../tools/search-docs.js';
import { validateFormTool, validateFormToolDefinition } from '../tools/validate-form.js';
import { validateJsonSchemaTool } from '../tools/validate-json-schema.js';

/** Объявление инструмента — в том виде, в каком его отдаёт `tools/list`. */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: {
    readonly type: 'object';
    readonly properties?: Record<string, unknown>;
    readonly required?: readonly string[];
  };
}

/** Где работает сервер. */
export type ServerProfile = 'node' | 'browser';

export interface ToolCatalogOptions {
  readonly profile: ServerProfile;
  /** Отладочный инструмент `debug` — только под Node и только по флагу. */
  readonly debug?: boolean;
}

export interface ToolCatalog {
  /** Инструменты для `tools/list` — в порядке, в каком их видит клиент. */
  list(): ToolDefinition[];
  /**
   * Вызвать инструмент. Неизвестное имя — исключение: SDK превратит его в ошибку JSON-RPC, как
   * и прежде.
   */
  call(name: string, args: Record<string, unknown> | undefined): Promise<CallToolResult>;
}

/** `plan_form` без `specPath` — для профиля без диска. */
const planFormWithoutSpecPath: ToolDefinition = (() => {
  const { specPath: _specPath, ...properties } = planFormToolDefinition.inputSchema.properties;
  return {
    ...planFormToolDefinition,
    inputSchema: { ...planFormToolDefinition.inputSchema, properties },
  };
})();

/**
 * Собрать каталог инструментов.
 *
 * @param knowledge - Знание сервера. Функция, а не значение: корпус разбирается лениво, на первый
 *   вызов, которому он нужен, — `tools/list` его не трогает.
 */
export function createToolCatalog(
  knowledge: () => Knowledge,
  options: ToolCatalogOptions
): ToolCatalog {
  const browser = options.profile === 'browser';
  const debug = options.debug === true && !browser;

  return {
    list() {
      const tools: ToolDefinition[] = [
        getContextToolDefinition,
        chooseApiToolDefinition,
        getSymbolDocsToolDefinition,
        findRecipeToolDefinition,
        searchDocsToolDefinition,
        listSymbolsToolDefinition,
        validateFormToolDefinition,
        browser ? planFormWithoutSpecPath : planFormToolDefinition,
        generateFormToolDefinition,
      ];
      if (!browser) tools.push(reportIssueToolDefinition);
      if (debug) tools.push(debugToolDefinition);
      return tools;
    },

    async call(name, args) {
      switch (name) {
        case 'report_issue':
          if (browser) break;
          // Без каста: инструмент сам проверяет вход. Прежний двойной каст объявлял гарантию,
          // которой нет — клиент вправе прислать что угодно, и половина отчётов приезжала
          // без `solution`, а сервер отвечал «successfully».
          return await reportIssueTool(args, knowledge());

        case 'debug':
          if (!debug) break;
          return await debugTool(args as { section?: string }, knowledge());

        case 'validate_form':
          return await validateFormTool(args as Record<string, unknown>, knowledge());

        case 'plan_form': {
          const params = args as { specPath?: string; description?: string; target?: string };
          // Профиль без диска путь спеки не читает: аргумент, которого нет в схеме, не должен
          // молча превращаться в «спека не найдена».
          const { specPath: _specPath, ...withoutSpecPath } = params ?? {};
          return await planFormTool(browser ? withoutSpecPath : params, knowledge());
        }

        case 'generate_form':
          return await generateFormTool(
            args as { intent: Record<string, unknown>; target?: string }
          );

        case 'get_context':
          return await getContextTool(
            args as {
              task: string;
              topics?: string[];
              target?: string;
              profile?: string;
              maxTokens?: number;
            },
            knowledge()
          );

        case 'choose_api':
          return await chooseApiTool(args as { requirement: string; target?: string }, knowledge());

        case 'get_symbol_docs':
          return await getSymbolDocsTool(args as { symbol: string; package?: string }, knowledge());

        case 'find_recipe':
          return await findRecipeTool(args as { topic: string; package?: string }, knowledge());

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
            knowledge()
          );

        case 'search_docs':
          return await searchDocsTool(
            args as { query?: string; package?: string; limit?: number },
            knowledge()
          );

        case 'check_behaviors':
          return await checkBehaviorsTool(
            args as { dependencies: Array<{ target: string; reads: string[] }> }
          );
      }
      throw new Error(`Unknown tool: ${name}`);
    },
  };
}
