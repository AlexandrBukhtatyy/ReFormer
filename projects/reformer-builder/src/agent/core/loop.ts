/**
 * Ход агента: связывает канал к модели с реестром инструментов и накапливает набор изменений.
 *
 * Цикл не трогает стор. Он работает над копией схемы и возвращает {@link ChangeSet}; решение
 * применить принимает пользователь, а применение — один `replaceSchema` (одна запись undo).
 *
 * @module reformer-builder/agent/core/loop
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { AiMessage, AiProvider, AiToolDef } from '../providers/types';
import { createChangeSet, withOutcome, type ChangeSet } from './changeset';
import { SYSTEM_PROMPT } from './prompt';
import type { ToolRegistry } from './registry';
import type { ChangeOp, ToolError } from './types';

/** Предел шагов «модель → инструмент → модель» за один ход. */
export const DEFAULT_MAX_STEPS = 24;

/** Настройки хода. */
export interface AgentTurnOptions {
  provider: AiProvider;
  registry: ToolRegistry;
  /** Схема активной вкладки на начало хода. */
  base: JsonFormSchema;
  /** История диалога, включая новое сообщение пользователя. */
  messages: readonly AiMessage[];
  maxSteps?: number;
  signal?: AbortSignal;
  /** Переопределение системного промпта (тесты). */
  system?: string;
}

/** Событие хода для интерфейса. */
export type TurnEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; ok: boolean; op?: ChangeOp; error?: ToolError }
  | {
      type: 'done';
      changeSet: ChangeSet;
      reason: 'complete' | 'aborted' | 'error';
      message?: string;
    };

/**
 * Провести один ход агента.
 *
 * Инструменты исполняются здесь, а не в SDK провайдера: только так правки попадают в набор
 * изменений и проходят гейт качества.
 *
 * @returns Поток событий; последнее — `done` с накопленным {@link ChangeSet}.
 */
export async function* runAgentTurn(opts: AgentTurnOptions): AsyncGenerator<TurnEvent> {
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  let set = createChangeSet(opts.base);

  const tools: AiToolDef[] = opts.registry.list().map((tool) => ({
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    execute: async (args) => {
      // Черновик читается в момент вызова: каждый следующий инструмент видит результат предыдущего.
      const outcome = opts.registry.invoke(tool.name, args, {
        draft: set.draft,
        base: opts.base,
      });
      set = withOutcome(set, outcome);
      return outcome;
    },
  }));

  let reason: 'complete' | 'aborted' | 'error' = 'complete';
  let message: string | undefined;
  // Имя вызова известно из `tool_call`, а показать его нужно на `tool_result`. Карта живёт в
  // пределах хода: на уровне модуля два параллельных хода затирали бы записи друг друга.
  const callNames = new Map<string, string>();

  try {
    for await (const event of opts.provider.stream(
      { system: opts.system ?? SYSTEM_PROMPT, messages: opts.messages, tools, maxSteps },
      opts.signal
    )) {
      switch (event.type) {
        case 'delta':
          if (event.text) yield { type: 'text', text: event.text };
          break;
        case 'tool_result':
          yield {
            type: 'tool',
            name: callNames.get(event.id) ?? 'tool',
            ok: event.result.ok,
            ...(event.result.op ? { op: event.result.op } : {}),
            ...(event.result.error ? { error: event.result.error } : {}),
          };
          break;
        case 'error':
          reason = 'error';
          message = event.message;
          break;
        case 'done':
          if (event.reason !== 'complete') reason = event.reason;
          break;
        // tool_call самостоятельного смысла для интерфейса не несёт: показывать нечего до
        // результата, а «вызывается…» без исхода только мигает в панели.
        case 'tool_call':
          callNames.set(event.id, event.name);
          break;
      }
    }
  } catch (e) {
    reason = 'error';
    message = e instanceof Error ? e.message : String(e);
  }

  yield { type: 'done', changeSet: set, reason, ...(message ? { message } : {}) };
}
