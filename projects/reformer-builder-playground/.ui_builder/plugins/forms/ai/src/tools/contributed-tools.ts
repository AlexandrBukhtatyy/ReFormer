/**
 * Проекция инструментов плагинов (точка `reformer.assistant.tool`) в инструменты модели.
 *
 * ## Рядом с командами, а не вместо них
 *
 * Команда с блоком `agent` (`./command-tools`) — действие человека, которое видно модели: её
 * запись не принадлежит ходу, а ответ — то, что команда вернула палитре. Инструмент плагина —
 * действие модели: ему ход даёт сигнал остановки и дверь записи, которую отмена хода откатывает
 * вместе с правками самой модели (`TurnScope.write`). Поэтому это вторая проекция, а не замена
 * первой: команды остаются тем, чем были.
 *
 * ## Живой вклад, а не захваченный
 *
 * Набор инструментов мост мемоизирует по подписи. Вклад, выключенный и включённый снова с той же
 * подписью, дал бы ту же запись памяти — со ссылкой на `run` прежней активации. Поэтому
 * спроецированный инструмент ищет вклад на КАЖДЫЙ вызов (`lookup`): выключенный посреди хода
 * плагин отвечает модели `UNAVAILABLE`, а не исполняет код, который уже снят.
 *
 * Ядро SDK не импортирует: типы ниже — структурные копии контракта, как у команд.
 *
 * @module plugins/forms/ai/tools/contributed-tools
 */

import {
  formToolFail,
  formToolOk,
  type FormAgentTool,
  type FormChangeOp,
  type FormToolErrorCode,
  type FormToolOutcome,
} from '@reformer/builder-plugin-api';
import { TOOL_DESCRIPTION_BUDGET, TOOL_NAME_BUDGET } from '@reformer/builder-toolkit';

/** Итог записи, каким его видит инструмент плагина. Структурная копия `AssistantWriteResult`. */
export type ContributedWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly code: string; readonly message: string };

/** Контекст вызова инструмента плагина. Структурная копия `AssistantToolContext`. */
export interface ContributedCallContext {
  readonly signal: AbortSignal;
  write(resource: string, text: string): Promise<ContributedWriteResult>;
}

/** Ответ инструмента плагина. Структурная копия `AssistantToolResult`. */
export type ContributedResult =
  | string
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly error: {
        readonly code: string;
        readonly message: string;
        readonly suggestions?: readonly string[];
      };
    };

/** Инструмент плагина. Структурная копия `AssistantTool`. */
export interface ContributedTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: object;
  readonly readOnly: boolean;
  run(params: unknown, ctx: ContributedCallContext): ContributedResult | Promise<ContributedResult>;
}

/** Вклад в точку инструментов: кто внёс и что. Структурная копия `Contribution<AssistantTool>`. */
export interface ContributedToolEntry {
  readonly pluginId: string;
  readonly value: ContributedTool;
}

/** Почему вклад не стал инструментом. Код, а не фраза: это ошибка автора плагина. */
export type ContributionRejectionCode =
  /** Имя не `snake_case` с буквы. */
  | 'name-invalid'
  /** Имя длиннее {@link TOOL_NAME_BUDGET}. */
  | 'name-too-long'
  /** Имя занято встроенным инструментом или более ранним вкладом. */
  | 'name-taken'
  /** Описание длиннее {@link TOOL_DESCRIPTION_BUDGET}. */
  | 'description-too-long'
  /** Схема аргументов — не объект с `type: 'object'`: проверка аргументов отказала бы каждый раз. */
  | 'schema-invalid'
  /** Не влез в потолок поверхности вкладов. */
  | 'over-budget';

const NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

/**
 * Годится ли вклад в инструменты — без учёта занятых имён и потолка: их проверяет сборка набора.
 * `null` — годится.
 */
export function contributedToolProblem(tool: ContributedTool): ContributionRejectionCode | null {
  if (!NAME_PATTERN.test(tool.name)) return 'name-invalid';
  if (tool.name.length > TOOL_NAME_BUDGET) return 'name-too-long';
  if (tool.description.length > TOOL_DESCRIPTION_BUDGET) return 'description-too-long';
  const schema = tool.inputSchema as { readonly type?: unknown } | null;
  if (typeof schema !== 'object' || schema === null || schema.type !== 'object') {
    return 'schema-invalid';
  }
  return null;
}

/** Коды SDK, у которых в словаре ядра есть свой; остальное — `TOOL_FAILED`. */
const KNOWN_CODES: ReadonlySet<string> = new Set([
  'NOT_FOUND',
  'REFUSED',
  'UNSUPPORTED',
  'TOO_LARGE',
  'UNAVAILABLE',
]);

/** Код ошибки плагина — в код ядра. Неизвестный и `FAILED` значат одно: инструмент не справился. */
export function toolErrorCodeOf(code: string): FormToolErrorCode {
  return KNOWN_CODES.has(code) ? (code as FormToolErrorCode) : 'TOOL_FAILED';
}

/** Ответ плагина — в исход вызова. Ответ неизвестной формы — отказ, а не молчаливый успех. */
function outcomeOf(name: string, result: ContributedResult): FormToolOutcome {
  if (typeof result === 'string') return formToolOk(result);
  if (typeof result === 'object' && result !== null) {
    if (result.ok) return formToolOk(typeof result.text === 'string' ? result.text : '');
    if (typeof result.error === 'object' && result.error !== null) {
      const { code, message, suggestions } = result.error;
      return formToolFail(
        toolErrorCodeOf(code),
        message,
        suggestions ? [...suggestions] : undefined
      );
    }
  }
  return formToolFail('TOOL_FAILED', `Tool ${name} returned an answer of an unknown shape.`);
}

/**
 * Инструмент модели из вклада плагина.
 *
 * @param tool - Вклад на момент сборки набора: имя, описание и схема уходят модели.
 * @param lookup - Тот же вклад СЕЙЧАС — см. «Живой вклад» в шапке модуля.
 */
export function contributedTool(
  tool: ContributedTool,
  lookup: () => ContributedTool | undefined
): FormAgentTool {
  const { name } = tool;
  return {
    name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    readOnly: tool.readOnly,
    async run(params: unknown, ctx) {
      const live = lookup();
      const turn = ctx.turn;
      if (live === undefined || turn === undefined) {
        return formToolFail('UNAVAILABLE', `Tool ${name} is not available right now.`);
      }

      // Записи вызова становятся строками журнала панели — как у записи файла моделью.
      const ops: FormChangeOp[] = [];
      const result = await live.run(params, {
        signal: turn.signal,
        write: async (resource, text) => {
          const written = await turn.write(resource, text, { readOnly: live.readOnly });
          if (!written.ok) return { ok: false, code: written.code, message: written.message };
          ops.push(written.op);
          return { ok: true };
        },
      });
      const outcome = outcomeOf(name, result);
      return ops.length > 0 ? { ...outcome, ops } : outcome;
    },
  };
}
