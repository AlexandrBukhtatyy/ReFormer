/**
 * Сценарный провайдер — модель, заменённая заранее заданной последовательностью действий.
 *
 * Существует не ради «заглушки на время разработки», а ради проверяемости: цикл, гейт, журнал
 * изменений и применение результата — это ~80% поверхности отказов, и все они детерминированно
 * тестируются без сети, ключей и оплаты токенов. Золотые тесты хода агента строятся на нём.
 *
 * @module plugins/ai/providers/fake
 */

import type { AiCapabilities, AiEvent, AiProvider, AiRequest, AiToolDef, AiUsage } from './types';

/** Один вызов инструмента в сценарии. */
export interface FakeToolCall {
  tool: string;
  args?: unknown;
}

/**
 * Шаг сценария: реплика модели, её рассуждение либо вызовы инструментов.
 *
 * `parallel` — несколько вызовов ОДНОГО шага. Это не украшение сценария, а единственный способ
 * воспроизвести живой канал: SDK запускает вызовы одного шага, не дожидаясь предыдущего, и
 * сценарий, умеющий только по одному, оставлял непокрытым ровно тот режим, в котором ход терял
 * правки.
 */
export type FakeStep =
  | { text: string }
  | { reasoning: string }
  | FakeToolCall
  | { parallel: readonly FakeToolCall[] }
  /**
   * Модель начала вызов и не дописала аргументы: ход обрывается прямо здесь.
   *
   * Режим, ради которого шаг и заведён, воспроизвести иначе нечем: аргументы инструмента приходят
   * потоком, и обрыв посреди JSON не даёт ни `tool_call`, ни `tool_result` — то есть выглядит как
   * отсутствие всякой попытки. Без него цикл нельзя проверить на самом тихом из своих исходов.
   */
  | { truncated: { tool: string } };

/** Настройки сценарного провайдера. */
export interface FakeProviderOptions {
  id?: string;
  displayName?: string;
  capabilities?: Partial<AiCapabilities>;
  /** Прервать ход ошибкой после того, как сценарий отыгран. */
  failWith?: string;
  /**
   * Расход, приписываемый каждому шагу. Настоящие цифры приходят от провайдера, здесь они заданы
   * сценарием — иначе накопление статистики хода нечем проверить, кроме живого запроса.
   */
  usagePerStep?: AiUsage;
}

const DEFAULT_CAPABILITIES: AiCapabilities = {
  streaming: true,
  tools: true,
  images: false,
  languages: ['ru', 'en'],
};

/**
 * Провайдер, отыгрывающий заданный сценарий.
 *
 * @param script - Шаги в порядке исполнения.
 * @param options - Идентификация и возможности.
 */
export function createFakeProvider(
  script: readonly FakeStep[],
  options: FakeProviderOptions = {}
): AiProvider {
  const capabilities = { ...DEFAULT_CAPABILITIES, ...options.capabilities };

  return {
    id: options.id ?? 'fake',
    displayName: options.displayName ?? 'Сценарий (без модели)',
    origin: 'browser',
    detect: async () => ({ available: true }),
    capabilities: () => capabilities,

    async *stream(req: AiRequest, signal?: AbortSignal): AsyncIterable<AiEvent> {
      const byName = new Map(req.tools.map((t) => [t.name, t]));
      let step = 0;

      for (const item of script) {
        if (signal?.aborted) {
          yield { type: 'done', reason: 'aborted' };
          return;
        }
        if ('text' in item) {
          yield { type: 'delta', text: item.text };
          continue;
        }
        if ('reasoning' in item) {
          yield { type: 'reasoning', text: item.reasoning };
          continue;
        }
        if ('truncated' in item) {
          // Порядок тот же, что у настоящего адаптера: сначала внятная ошибка, потом `done` с
          // диагностикой. Шаг сценария на этом кончается — дописывать вызов уже нечем.
          yield {
            type: 'error',
            message: `Ответ оборвался посреди аргументов вызова ${item.truncated.tool}.`,
            retryable: false,
          };
          yield {
            type: 'done',
            reason: 'error',
            stop: { reason: 'other', truncatedCall: item.truncated.tool },
          };
          return;
        }
        if (req.maxSteps !== undefined && step >= req.maxSteps) {
          yield {
            type: 'error',
            message: `Превышен предел шагов (${req.maxSteps}).`,
            retryable: false,
          };
          yield { type: 'done', reason: 'error' };
          return;
        }
        step += 1;

        const calls = 'parallel' in item ? item.parallel : [item];
        const targets: { id: string; call: FakeToolCall; tool: AiToolDef }[] = [];
        for (const [i, call] of calls.entries()) {
          const tool = byName.get(call.tool);
          if (!tool) {
            // Сценарий назвал инструмент, которого модели не давали, — это ошибка самого теста.
            yield {
              type: 'error',
              message: `Инструмент "${call.tool}" не передан модели.`,
              retryable: false,
            };
            yield { type: 'done', reason: 'error' };
            return;
          }
          targets.push({
            id: calls.length === 1 ? `call_${step}` : `call_${step}_${i}`,
            call,
            tool,
          });
        }

        for (const { id, call } of targets) {
          yield { type: 'tool_call', id, name: call.tool, args: call.args ?? {} };
        }

        // Вызовы ЗАПУСКАЮТСЯ все сразу и только потом ожидаются — так же, как это делает SDK:
        // он не ждёт результата предыдущего инструмента, прежде чем начать следующий. Ожидание
        // по одному прятало бы от тестов гонку за черновик, ради которой режим и заведён.
        const started = targets.map((t) => t.tool.execute(t.call.args ?? {}));
        for (const [i, result] of (await Promise.all(started)).entries()) {
          yield { type: 'tool_result', id: targets[i].id, result };
        }
        // Шаг сценария = вызовы инструментов, поэтому расход сообщается здесь же, где растёт счётчик
        // предела шагов. Событие идёт и без заданных цифр: сам факт шага — половина метрики.
        yield { type: 'step_usage', usage: options.usagePerStep ?? {} };
      }

      if (options.failWith) {
        yield { type: 'error', message: options.failWith, retryable: true };
        yield { type: 'done', reason: 'error' };
        return;
      }
      yield { type: 'done', reason: 'complete' };
    },
  };
}
