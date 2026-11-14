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
import {
  formBuildGuidedTool,
  formBuildGuidedToolDefinition,
  formEditTool,
  formEditToolDefinition,
  formStartTool,
  formStartToolDefinition,
  formStatusTool,
  formStatusToolDefinition,
  GUIDED_SCRIPT_SURFACE,
} from '../tools/guided.js';
import { planFormTool, planFormToolDefinition } from '../tools/plan-form.js';
import { getContextTool, getContextToolDefinition } from '../tools/get-context.js';
import { getSymbolDocsTool, getSymbolDocsToolDefinition } from '../tools/get-symbol-docs.js';
import { listSymbolsTool, listSymbolsToolDefinition } from '../tools/list-symbols.js';
import { reportIssueTool, reportIssueToolDefinition } from '../tools/report-issue.js';
import { searchDocsTool, searchDocsToolDefinition } from '../tools/search-docs.js';
import { validateFormTool, validateFormToolDefinition } from '../tools/validate-form.js';
import { createRepeatWatch } from './repeat-calls.js';
import {
  RUN_SCRIPT_TOOL,
  runScriptTool,
  runScriptToolDefinition,
  type ScriptSandbox,
} from '../codemode/run-script.js';
import { asScriptCalls } from '../codemode/declaration.js';

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
  /**
   * Code Mode (эксперимент, `REFORMER_SURFACE=code`): `tools/list` — один `run_script`, а все
   * инструменты обычного режима — функции `reformer.*` внутри скрипта, исполняемого этой песочницей.
   */
  readonly codeMode?: ScriptSandbox;
  /**
   * Профиль guided (эксперимент, `REFORMER_SURFACE=guided`) для малых моделей: план от сервера
   * (`form_start`), плоские правки со сборкой (`form_edit`), состояние (`form_status`) и
   * `form_build`. Справочных инструментов нет: малая модель уходила в них с пути сборки.
   * Вместе с `codeMode` — связка `REFORMER_SURFACE=code-guided`: эти четыре функции в `run_script`.
   */
  readonly guided?: boolean;
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
  const guided = options.guided === true && !browser;
  // Повтор без перемен называется в ответе: малая модель иначе шлёт тот же вызов раз за разом.
  const repeats = createRepeatWatch();
  let calls = 0;

  const catalog: ToolCatalog = {
    list() {
      if (guided) {
        return [
          formStartToolDefinition,
          formEditToolDefinition,
          formStatusToolDefinition,
          formBuildGuidedToolDefinition,
        ];
      }
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
      if (guided) {
        switch (name) {
          case 'form_start':
            return await formStartTool(args ?? {}, knowledge());
          case 'form_edit':
            return await formEditTool(args ?? {}, knowledge());
          case 'form_status':
            return await formStatusTool(args ?? {}, knowledge());
          case 'form_build':
            return await formBuildGuidedTool(args ?? {}, knowledge());
        }
        throw new Error(`Unknown tool: ${name}`);
      }
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

  const observed = async (
    name: string,
    args: Record<string, unknown> | undefined
  ): Promise<CallToolResult> => {
    // Номер — как у трассы сервера: каждый вызов инструмента, и неизвестного тоже.
    const call = ++calls;
    return repeats.observe(call, name, args, await catalog.call(name, args));
  };

  const sandbox = options.codeMode;
  if (sandbox) {
    // Скрипту доступны те же инструменты, что видит клиент обычного режима, и с той же пометкой
    // повторов: меняется только форма подачи, не знание.
    const scriptTools = catalog.list();
    // Связка с guided — своя подача: абзац без «пиши файлы сам», типизированные правки, примеры.
    const runScript = runScriptToolDefinition(
      scriptTools,
      guided ? GUIDED_SCRIPT_SURFACE : undefined
    );
    // Связка с guided: строки `Next:` называют вызов инструмента — скрипту их отдают кодом, который
    // можно вставить как есть. Обычный Code Mode не трогается: его замеры остаются сравнимыми.
    const toolNames = scriptTools.map((tool) => tool.name);
    const scriptCall = guided
      ? async (name: string, args: Record<string, unknown>) => {
          const result = await observed(name, args);
          return {
            ...result,
            content: result.content.map((block) =>
              block.type === 'text'
                ? { ...block, text: asScriptCalls(block.text, toolNames) }
                : block
            ),
          };
        }
      : observed;
    return {
      list: () => [runScript],
      async call(name, args) {
        if (name !== RUN_SCRIPT_TOOL) throw new Error(`Unknown tool: ${name}`);
        const result = await runScriptTool(args, scriptTools, scriptCall, sandbox, {
          echoLast: guided,
          dropEmptyEdits: guided,
          returnErrors: guided,
        });
        return guided ? withRunHint(result) : result;
      },
    };
  }

  return { list: () => catalog.list(), call: observed };
}

/**
 * Ответ со следующим вызовом, но без «Done» — напоминание, что вызов идёт через `run_script`. Малая
 * модель трижды отвечала блоком кода в сообщении вместо вызова, и прогон кончался на первом шаге
 * (пошаговый план, 20261113T224423Z-b31c).
 */
const RUN_HINT = '→ Run that call with run_script: code written in a message runs nothing.';

function withRunHint(result: CallToolResult): CallToolResult {
  const text = result.content.map((block) => (block.type === 'text' ? block.text : '')).join('\n');
  if (!/await reformer\.\w+\(/.test(text) || /^Done:/m.test(text)) return result;
  const last = result.content.map((block) => block.type).lastIndexOf('text');
  return {
    ...result,
    content: result.content.map((block, index) =>
      index === last && block.type === 'text'
        ? { ...block, text: `${block.text}\n${RUN_HINT}` }
        : block
    ),
  };
}
