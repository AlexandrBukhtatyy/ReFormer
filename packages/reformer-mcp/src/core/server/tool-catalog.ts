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
 * `node` — сервер под Node. Форму там создаёт один путь (с 7.0): агент пишет `form.intent.json`, а
 * `form_build` собирает и записывает модуль; `plan_form` пишет черновик intent по спеке.
 *
 * `browser` — воркер в браузере, где нет диска: только справочные инструменты. Форму там собирает
 * ассистент конструктора своим `build_form` над документом, а не сервер. Поэтому нет `form_build` и
 * `plan_form` (они пишут в проект, которого тут нет), `report_issue` (отчёт лёг бы в память воркера и
 * пропал) и `debug`.
 *
 * Легаси удалено в 7.0 (аудит 2026-11, A1): `generate_form` печатал файлы текстом, и агенты уходили
 * писать модуль мимо генератора; `plan_form` воркера отдавал intent для него же; скрытые
 * `validate_json_schema` и `check_behaviors` давно заменил `validate_form`. Вызов любого из них —
 * «Unknown tool», как у любого неизвестного имени.
 *
 * @module reformer-mcp/core/server/tool-catalog
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Knowledge } from '../knowledge.js';
import { chooseApiTool, chooseApiToolDefinition } from '../tools/choose-api.js';
import { debugTool, debugToolDefinition } from '../tools/debug.js';
import { findRecipeTool, findRecipeToolDefinition } from '../tools/find-recipe.js';
import { formBuildTool, formBuildToolDefinition } from '../tools/form-build.js';
import { planFormTool, planFormToolDefinition } from '../tools/plan-form.js';
import { getContextTool, getContextToolDefinition } from '../tools/get-context.js';
import { getSymbolDocsTool, getSymbolDocsToolDefinition } from '../tools/get-symbol-docs.js';
import { listSymbolsTool, listSymbolsToolDefinition } from '../tools/list-symbols.js';
import { reportIssueTool, reportIssueToolDefinition } from '../tools/report-issue.js';
import { searchDocsTool, searchDocsToolDefinition } from '../tools/search-docs.js';
import { validateFormTool, validateFormToolDefinition } from '../tools/validate-form.js';
import { createRepeatWatch } from './repeat-calls.js';

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
  // Повтор без перемен называется в ответе: малая модель иначе шлёт тот же вызов раз за разом.
  const repeats = createRepeatWatch();
  let calls = 0;

  const catalog: ToolCatalog = {
    list() {
      const tools: ToolDefinition[] = [
        getContextToolDefinition,
        chooseApiToolDefinition,
        getSymbolDocsToolDefinition,
        findRecipeToolDefinition,
        searchDocsToolDefinition,
        listSymbolsToolDefinition,
        validateFormToolDefinition,
      ];
      if (!browser) {
        tools.push(planFormToolDefinition, formBuildToolDefinition, reportIssueToolDefinition);
      }
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

        case 'form_build':
          if (browser) break;
          return await formBuildTool(args ?? {}, knowledge());

        case 'debug':
          if (!debug) break;
          return await debugTool(args as { section?: string }, knowledge());

        case 'validate_form':
          return await validateFormTool(args as Record<string, unknown>, knowledge(), {
            formBuild: !browser,
          });

        case 'plan_form':
          if (browser) break;
          return await planFormTool(args ?? {}, knowledge());

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
      }
      throw new Error(`Unknown tool: ${name}`);
    },
  };

  return {
    list: () => catalog.list(),
    async call(name, args) {
      // Номер — как у трассы сервера: каждый вызов инструмента, и неизвестного тоже.
      const call = ++calls;
      return repeats.observe(call, name, args, await catalog.call(name, args));
    },
  };
}
