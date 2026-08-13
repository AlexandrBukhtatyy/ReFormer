/**
 * Адаптер Vercel AI SDK к контракту {@link AiProvider}.
 *
 * SDK держит цикл «модель → инструмент → модель» (`stopWhen`), а исполнение инструментов остаётся
 * нашим: `execute` ходит в реестр редактора. Это ровно та граница, которая нужна — воспроизводить
 * цикл поверх библиотеки бессмысленно, а отдавать ей исполнение правок нельзя.
 *
 * Файл — единственное место, знающее про API SDK: смена клиента затрагивает только его.
 *
 * @module reformer-builder/agent/providers/ai-sdk
 */

import {
  jsonSchema,
  stepCountIs,
  streamText,
  tool,
  type FinishReason,
  type LanguageModel,
} from 'ai';
import type { ToolOutcome } from '../core/types';
import type { AiEvent, AiRequest } from './types';

/** Ответ на случай, если исход вызова почему-то не сохранился (защита от рассинхрона). */
const UNKNOWN_OUTCOME: ToolOutcome = { ok: true, text: '' };

/**
 * Причины остановки, при которых ход оборван, а не завершён.
 *
 * Тихое `done: complete` здесь — худший из исходов: набор изменений пуст, панель уходит в покой, и
 * выглядит это как «модель решила ничего не делать», хотя её прервали на полуслове. Особенно легко
 * поймать `length` на think-моделях: рассуждение съедает весь бюджет вывода, и до инструментов ход
 * просто не доходит.
 *
 * `tool-calls` приходит от `stopWhen: stepCountIs(maxSteps)`: модель попросила ещё один инструмент,
 * а шаги кончились. Без записи здесь такой обрыв неотличим от штатного конца — набор изменений
 * применяется как законченная работа, хотя половина задачи не сделана.
 */
const BROKEN_FINISH: Partial<Record<FinishReason, string>> = {
  length:
    'Ответ оборван на пределе длины: бюджет вывода кончился раньше, чем модель договорила. ' +
    'Увеличьте контекстное окно модели (у локальных серверов — OLLAMA_CONTEXT_LENGTH или num_ctx) ' +
    'либо разбейте задачу на несколько запросов.',
  'content-filter': 'Ответ остановлен фильтром содержимого модели.',
  'tool-calls':
    'Ход остановлен на пределе шагов: модель не успела закончить. Уже сделанные правки можно ' +
    'применить, остальное — попросить следующим сообщением («продолжай»).',
};

/**
 * Провести ход через AI SDK, переводя его поток в {@link AiEvent}.
 *
 * @param model - Модель, уже настроенная провайдером.
 * @param req - Запрос: системный промпт, диалог, инструменты, предел шагов.
 * @param signal - Прерывание хода.
 */
export async function* streamViaAiSdk(
  model: LanguageModel,
  req: AiRequest,
  signal?: AbortSignal
): AsyncIterable<AiEvent> {
  // Исход вызова нужен интерфейсу целиком (операция, код ошибки), а модели уходит только текст,
  // поэтому исходы складываются по toolCallId и достаются на событии результата.
  const outcomes = new Map<string, ToolOutcome>();

  const tools = Object.fromEntries(
    req.tools.map((definition) => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(definition.inputSchema as Record<string, unknown>),
        execute: async (args: unknown, { toolCallId }: { toolCallId: string }) => {
          const outcome = await definition.execute(args);
          outcomes.set(toolCallId, outcome);
          return outcome.text;
        },
      }),
    ])
  );

  const result = streamText({
    model,
    system: req.system,
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    tools,
    stopWhen: stepCountIs(req.maxSteps),
    abortSignal: signal,
  });

  try {
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          yield { type: 'delta', text: part.text };
          break;
        case 'reasoning-delta':
          yield { type: 'reasoning', text: part.text };
          break;
        case 'tool-call':
          yield { type: 'tool_call', id: part.toolCallId, name: part.toolName, args: part.input };
          break;
        case 'tool-result':
          yield {
            type: 'tool_result',
            id: part.toolCallId,
            result: outcomes.get(part.toolCallId) ?? UNKNOWN_OUTCOME,
          };
          break;
        case 'tool-error':
          yield {
            type: 'tool_result',
            id: part.toolCallId,
            result: {
              ok: false,
              text: messageOf(part.error),
              error: { code: 'TOOL_FAILED', message: messageOf(part.error) },
            },
          };
          break;
        case 'error':
          yield { type: 'error', message: messageOf(part.error), retryable: true };
          break;
        case 'abort':
          yield { type: 'done', reason: 'aborted' };
          return;
        case 'finish': {
          const broken = BROKEN_FINISH[part.finishReason];
          if (broken) {
            // Повтор того же запроса упрётся в тот же предел — чинится настройкой, а не кнопкой.
            yield { type: 'error', message: broken, retryable: false };
            yield { type: 'done', reason: 'error' };
            return;
          }
          yield { type: 'done', reason: 'complete' };
          return;
        }
      }
    }
  } catch (e) {
    // Сетевые сбои и отказ авторизации приходят исключением, а не событием потока.
    if (signal?.aborted) {
      yield { type: 'done', reason: 'aborted' };
      return;
    }
    yield { type: 'error', message: messageOf(e), retryable: true };
    yield { type: 'done', reason: 'error' };
  }
}

/** Сообщение об ошибке из произвольного значения. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}
