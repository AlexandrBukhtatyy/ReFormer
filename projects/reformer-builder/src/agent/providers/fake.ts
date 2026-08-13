/**
 * Сценарный провайдер — модель, заменённая заранее заданной последовательностью действий.
 *
 * Существует не ради «заглушки на время разработки», а ради проверяемости: цикл, гейт, журнал
 * изменений и применение результата — это ~80% поверхности отказов, и все они детерминированно
 * тестируются без сети, ключей и оплаты токенов. Золотые тесты хода агента строятся на нём.
 *
 * @module reformer-builder/agent/providers/fake
 */

import type { AiCapabilities, AiEvent, AiProvider, AiRequest } from './types';

/** Шаг сценария: реплика модели либо вызов инструмента. */
export type FakeStep = { text: string } | { tool: string; args?: unknown };

/** Настройки сценарного провайдера. */
export interface FakeProviderOptions {
  id?: string;
  displayName?: string;
  capabilities?: Partial<AiCapabilities>;
  /** Прервать ход ошибкой после того, как сценарий отыгран. */
  failWith?: string;
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
        if (step >= req.maxSteps) {
          yield {
            type: 'error',
            message: `Превышен предел шагов (${req.maxSteps}).`,
            retryable: false,
          };
          yield { type: 'done', reason: 'error' };
          return;
        }
        step += 1;

        const id = `call_${step}`;
        yield { type: 'tool_call', id, name: item.tool, args: item.args ?? {} };

        const tool = byName.get(item.tool);
        if (!tool) {
          // Сценарий назвал инструмент, которого модели не давали, — это ошибка самого теста.
          yield {
            type: 'error',
            message: `Инструмент "${item.tool}" не передан модели.`,
            retryable: false,
          };
          yield { type: 'done', reason: 'error' };
          return;
        }
        yield { type: 'tool_result', id, result: await tool.execute(item.args ?? {}) };
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
