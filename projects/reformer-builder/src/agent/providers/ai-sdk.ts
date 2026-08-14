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
  type LanguageModelUsage,
} from 'ai';
import type { ToolOutcome } from '../core/types';
import { dropReasoning, pruneSupersededReads } from './context';
import type { AiEvent, AiRequest, AiUsage } from './types';

/** Ответ на случай, если исход вызова почему-то не сохранился (защита от рассинхрона). */
const UNKNOWN_OUTCOME: ToolOutcome = { ok: true, text: '' };

/**
 * Настройки, различающиеся между каналами.
 *
 * Живут здесь, а не в {@link AiRequest}, сознательно: контракт канала не должен знать ни про
 * Anthropic, ни про OpenAI, иначе смена SDK перестанет быть правкой одного файла. Ядро отдаёт
 * запрос, а чем именно его удешевить — знает адаптер.
 */
export interface AiSdkTuning {
  /**
   * Помечать неизменный префикс запроса как кэшируемый (Anthropic).
   *
   * Префикс — системный промпт вместе с определениями инструментов, около трёх тысяч токенов. Он
   * пересылается заново на каждом из десятков шагов хода и до этой пометки оплачивался целиком
   * каждый раз.
   */
  cacheBreakpoints: boolean;
  /** Ключ маршрутизации автоматического кэша OpenAI: одинаковый на весь ход. */
  promptCacheKey?: string;
  /**
   * Потолок вывода одного шага; `undefined` — без потолка (значение по умолчанию).
   *
   * Не задаётся сам по себе намеренно: think-модель легко выдаёт пару тысяч токенов рассуждения на
   * шаг, и тесное значение обрывает ответ по `length`, то есть сжигает ход целиком. Ставить его
   * стоит только осознанно — например, чтобы зациклившаяся модель не писала ответ бесконечно.
   */
  maxOutputTokens?: number;
  /**
   * Полоть контекст между шагами: выбрасывать рассуждение и схлопывать повторные чтения.
   *
   * Включается только там, где кэша префикса нет. Правка сообщений в середине диалога меняет байты
   * префикса и обнуляет кэш от точки правки — на канале с работающим кэшем это чистый убыток,
   * даже когда сообщения становятся вдвое короче.
   */
  pruneContext: boolean;
  /** Сколько раз SDK повторит неудавшийся запрос. */
  maxRetries: number;
}

/** Значения по умолчанию: ничего провайдер-специфичного, только разумные пределы. */
const DEFAULT_TUNING: AiSdkTuning = {
  cacheBreakpoints: false,
  pruneContext: false,
  maxRetries: 2,
};

/**
 * Таймауты потока — только детектор зависания, не предел работы.
 *
 * `chunkMs` ловит ровно одно: сервер замолчал посреди ответа (обычно кончилась память под модель).
 *
 * `firstChunkMs` НЕ задаётся намеренно: у крупной локальной модели разбор промпта честно занимает
 * минуту и больше, и таймаут на первый фрагмент убивал бы живые запросы.
 *
 * `totalMs` не задаётся тоже: предела шагов у хода нет, и общий таймаут стал бы его заменой —
 * обрывал бы длинную, но исправно идущую работу над крупной формой. Останавливают ход кнопка
 * «Остановить» и молчание сервера, а не секундомер.
 */
const TIMEOUT = { chunkMs: 60_000 };

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
 * Ход израсходовал все шаги.
 *
 * Формулировка осторожнее, чем у `tool-calls`: на последнем шаге инструменты запрещены, поэтому
 * модель могла и договорить работу до конца — но могла и не успеть, а молчание в этом случае
 * выдаёт половину формы за готовый результат.
 */
const AT_LIMIT =
  'Ход израсходовал все шаги. Сделанное применено; если форма собрана не полностью — напишите ' +
  '«продолжай», и работа пойдёт дальше с этого места.';

/** «Не останавливаться»: ход идёт, пока модель не закончит сама. */
const NEVER = () => false;

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
  signal?: AbortSignal,
  tuning: AiSdkTuning = DEFAULT_TUNING
): AsyncIterable<AiEvent> {
  // Исход вызова нужен интерфейсу целиком (операция, код ошибки), а модели уходит только текст,
  // поэтому исходы складываются по toolCallId и достаются на событии результата.
  const outcomes = new Map<string, ToolOutcome>();

  const readOnlyNames = new Set(req.tools.filter((t) => t.readOnly).map((t) => t.name));
  const readOnly = (name: string) => readOnlyNames.has(name);

  /** Дошёл ли ход до последнего разрешённого шага — см. `prepareStep` и обработку `finish`. */
  let reachedStepLimit = false;

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
    instructions: instructionsOf(req.system, tuning),
    messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    tools,
    // Условие «никогда» задаётся ЯВНО: без `stopWhen` SDK подставляет `stepCountIs(1)`, то есть
    // ход закончился бы после первого же вызова инструмента, не дойдя до правок.
    stopWhen: req.maxSteps === undefined ? NEVER : stepCountIs(req.maxSteps),
    abortSignal: signal,
    // На последнем разрешённом шаге инструменты запрещаются: вызов оттуда всё равно не исполнится
    // (шаги кончились), и ход обрывался на полуслове с набором изменений, о котором модель ничего
    // не сказала. Запрет превращает этот шаг в обычный ответ — «сделал столько-то, осталось вот
    // это», — и не стоит ни одного дополнительного обращения.
    prepareStep: ({ stepNumber, messages }) => {
      const atLimit = req.maxSteps !== undefined && stepNumber >= req.maxSteps - 1;
      // Запрет инструментов делает шаг «тихим», и без этой отметки упор в предел неотличим от
      // законченной работы: модель отвечает текстом, finishReason становится 'stop', и ход
      // выглядит успешным при наполовину собранной форме.
      if (atLimit) reachedStepLimit = true;
      const last = atLimit ? { toolChoice: 'none' as const } : {};
      if (!tuning.pruneContext) return Object.keys(last).length ? last : undefined;
      const pruned = pruneSupersededReads(dropReasoning(messages), readOnly);
      return { ...last, messages: pruned };
    },
    // Работа структурная: чем меньше выдумок в именах компонентов и свойств, тем меньше отказов
    // гейта, а каждый отказ — это лишний обход «модель → инструмент → модель».
    temperature: 0,
    ...(tuning.maxOutputTokens ? { maxOutputTokens: tuning.maxOutputTokens } : {}),
    maxRetries: tuning.maxRetries,
    timeout: TIMEOUT,
    ...(tuning.promptCacheKey
      ? { providerOptions: { openai: { promptCacheKey: tuning.promptCacheKey } } }
      : {}),
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
        case 'finish-step':
          yield { type: 'step_usage', usage: usageOf(part.usage) };
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
          // Упор в предел шагов больше не виден по finishReason: на последнем шаге инструменты
          // запрещены, модель отвечает текстом, и провайдер сообщает штатный 'stop'. Отметка из
          // prepareStep — единственный оставшийся признак, что работать было ещё над чем.
          const broken = BROKEN_FINISH[part.finishReason] ?? (reachedStepLimit ? AT_LIMIT : null);
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
    // Свой таймаут SDK тоже отменяет прерыванием, но НЕ нашим сигналом: наш `signal.aborted` при
    // этом ложь, и сырой AbortError уходил бы пользователю как «The operation was aborted» — то
    // есть выглядел бы как нажатая им же кнопка «Остановить».
    if (isTimeout(e)) {
      yield { type: 'error', message: TIMED_OUT, retryable: true };
      yield { type: 'done', reason: 'error' };
      return;
    }
    yield { type: 'error', message: messageOf(e), retryable: true };
    yield { type: 'done', reason: 'error' };
  }
}

/** Сообщение о таймауте: единственный отказ, который лечится повтором, а не настройкой. */
const TIMED_OUT =
  'Модель замолчала посреди ответа и запрос прерван по таймауту. У локального сервера это обычно ' +
  'нехватка памяти под модель — проверьте, что он ещё жив, и повторите.';

/** Прерывание, пришедшее от таймаута SDK, а не от пользователя. */
function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError');
}

/**
 * Системная часть запроса, при необходимости помеченная как кэшируемая.
 *
 * Точка ставится на системном сообщении, а не на инструментах, хотя формально можно и там: Anthropic
 * складывает префикс в порядке «инструменты → системный промпт → диалог», поэтому ОДНА пометка на
 * промпте накрывает и определения инструментов тоже. Пометка на последнем инструменте дала бы то же
 * самое, но потребовала бы знать, какой из них последний.
 *
 * Каналы, не понимающие `providerOptions.anthropic`, молча его игнорируют — деградация корректная,
 * поэтому отдельной ветки «а вдруг не поддержит» здесь нет.
 */
function instructionsOf(system: string, tuning: AiSdkTuning) {
  if (!tuning.cacheBreakpoints) return system;
  return {
    role: 'system' as const,
    content: system,
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' as const } } },
  };
}

/**
 * Расход шага в наш вид.
 *
 * Поля переносятся по одному, а не спредом: SDK кладёт `undefined` там, где провайдер промолчал, и
 * пропуск такого ключа отличает «не сообщил» от «ноль» — а именно на этой разнице читается, работает
 * ли кэш префикса.
 */
function usageOf(usage: LanguageModelUsage): AiUsage {
  const details = usage.inputTokenDetails;
  return {
    ...(usage.inputTokens !== undefined ? { inputTokens: usage.inputTokens } : {}),
    ...(details?.cacheReadTokens !== undefined
      ? { cachedInputTokens: details.cacheReadTokens }
      : {}),
    ...(details?.cacheWriteTokens !== undefined
      ? { cacheWriteTokens: details.cacheWriteTokens }
      : {}),
    ...(usage.outputTokens !== undefined ? { outputTokens: usage.outputTokens } : {}),
  };
}

/** Сообщение об ошибке из произвольного значения. */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return JSON.stringify(error);
}
