/**
 * Контракт канала к модели.
 *
 * Собственный интерфейс, а не тип из SDK, по двум причинам: адаптер конкретного SDK становится
 * заменяемым (и удаляемым) файлом, а тесты цикла получают сценарный провайдер без сети и ключей.
 *
 * Цикл вызовов держит ПРОВАЙДЕР: у современных SDK он встроен (`stopWhen`), и воспроизводить его
 * поверх — значит бороться с библиотекой. Наш код владеет исполнением инструментов ({@link AiToolDef.execute}),
 * то есть тем, что действительно должно оставаться под контролем редактора.
 *
 * @module reformer-builder/agent/providers/types
 */

import type { ToolOutcome } from '../core/types';

/** Реплика диалога. */
export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Инструмент, отдаваемый модели. */
export interface AiToolDef {
  name: string;
  description: string;
  /** JSON Schema аргументов. */
  inputSchema: object;
  /**
   * Не меняет форму. Нужен провайдеру, чтобы схлопывать повторные ЧТЕНИЯ в накопленном контексте:
   * ответ пишущего инструмента устареть не может — он говорит о своей правке и ни о чём больше.
   */
  readOnly: boolean;
  /** Исполнение на стороне редактора. Провайдер отдаёт модели только `outcome.text`. */
  execute(args: unknown): Promise<ToolOutcome>;
}

/** Запрос к модели. */
export interface AiRequest {
  system: string;
  messages: readonly AiMessage[];
  tools: readonly AiToolDef[];
  /** Предел шагов «модель → инструмент → модель» за один ход. */
  maxSteps: number;
}

/**
 * Расход токенов на одном шаге.
 *
 * Нужен не для счёта денег, а как единственный объективный измеритель оптимизаций: «стало быстрее»
 * на глаз неотличимо от «модель в этот раз сходила удачнее». Все поля необязательны — локальные
 * серверы сообщают в лучшем случае суммарный вход, и отсутствие цифры это не ошибка.
 *
 * `cachedInputTokens` — единственное доказательство, что кэш префикса реально сработал: без него
 * «включили кэширование» проверяется только счётом в биллинге через сутки.
 */
export interface AiUsage {
  inputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
}

/** Событие потока. */
export type AiEvent =
  | { type: 'delta'; text: string }
  /**
   * Ход рассуждения модели. Отдельно от `delta` намеренно: это черновик мысли, а не ответ — в
   * ленту он идёт свёрнутым и в историю диалога не возвращается. Но и терять его нельзя: у
   * think-моделей весь поток до первого инструмента приходит именно сюда, и без него панель
   * выглядит зависшей, а обрыв на пределе длины — беспричинным.
   */
  | { type: 'reasoning'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; result: ToolOutcome }
  /** Шаг закончен: расход токенов. Провайдер, не сообщающий его, просто не шлёт событие. */
  | { type: 'step_usage'; usage: AiUsage }
  | { type: 'error'; message: string; retryable: boolean }
  | { type: 'done'; reason: 'complete' | 'aborted' | 'error' };

/** Возможности канала. */
export interface AiCapabilities {
  streaming: boolean;
  /**
   * Умеет ли модель вызывать инструменты. Без этого правки схемы невозможны в принципе, и такой
   * провайдер не предлагается как канал редактирования — молчаливый отказ был бы хуже.
   */
  tools: boolean;
  images: boolean;
  /** Коды языков; отсутствие нужного — основание предупредить пользователя. */
  languages: readonly string[];
}

/** Результат проверки доступности. */
export interface AiDetection {
  available: boolean;
  reason?: string;
}

/** Канал к модели. */
export interface AiProvider {
  readonly id: string;
  readonly displayName: string;
  /** Где исполняется запрос: влияет на предупреждения интерфейса о том, куда уходит текст. */
  readonly origin: 'browser' | 'loopback';
  detect(): Promise<AiDetection>;
  capabilities(): AiCapabilities;
  stream(req: AiRequest, signal?: AbortSignal): AsyncIterable<AiEvent>;
}
