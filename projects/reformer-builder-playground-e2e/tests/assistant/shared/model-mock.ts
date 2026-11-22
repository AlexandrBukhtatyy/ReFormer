/**
 * Модель для e2e ассистента: подмена локального OpenAI-совместимого сервера (так его отдаёт
 * Ollama) с очередью ответов по сценарию.
 *
 * ## Один запрос — один ответ из очереди
 *
 * Ассистент ходит к модели шагами: на каждый шаг хода — отдельный POST. Сценарий кладёт в
 * очередь ответы ровно по числу шагов, которые он ждёт. Кончилась очередь — это ошибка сценария,
 * а не повод повторить последний ответ: прежняя подмена так и делала и прятала лишние обращения
 * (лишний шаг, вторую попытку), которые и есть предмет многих тестов. Лишний запрос получает
 * HTTP 500 и записывается в {@link ModelMock.unanswered} — фикстура проваливает по нему тест.
 *
 * ## Ответ целиком, а не потоком
 *
 * `route.fulfill` отдаёт тело разом, поэтому «текст несколькими кусками» — это несколько
 * событий SSE в одном теле: SDK разбирает их как поток, и лента склеивает куски так же, как
 * при настоящем медленном сервере. Держать ответ во времени умеет шлюз ({@link ModelMock.held}):
 * запрос висит, пока тест его не отпустит, — так проверяется всё, что происходит посреди хода.
 *
 * @module tests/assistant/shared/model-mock
 */

import type { Page, Route } from '@playwright/test';

/** Адрес локального сервера по умолчанию — его подставляют настройки канала «Локальный». */
const MODELS_URL = '**/localhost:11434/v1/models';
const COMPLETIONS_URL = '**/localhost:11434/v1/chat/completions';

/** Модель в списке сервера. */
export const MODEL_ID = 'e2e-model';

/** Вызов инструмента в ответе модели. */
export interface ToolCall {
  readonly tool: string;
  readonly args: unknown;
}

/** Причина конца шага, как её пишет OpenAI-совместимый сервер. */
export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'content_filter';

/**
 * Шаг модели, отданный потоком SSE.
 *
 * Части идут в порядке «рассуждение → текст → вызовы»: так их отдают думающие модели.
 */
export interface StreamReply {
  /** Рассуждение (`delta.reasoning_content`). */
  readonly reasoning?: string;
  /** На сколько событий разбить рассуждение. По умолчанию — одно. */
  readonly reasoningChunks?: number;
  readonly text?: string;
  /** На сколько событий разбить текст. По умолчанию — одно. */
  readonly textChunks?: number;
  /** Вызовы инструментов шага; больше одного — параллельные вызовы. */
  readonly tools?: readonly ToolCall[];
  /**
   * Причина конца. По умолчанию — `tool_calls`, если есть вызовы, иначе `stop`.
   * `null` — поток без события конца.
   */
  readonly finish?: FinishReason | null;
}

/** Отказ сервера кодом HTTP. */
export interface HttpFailure {
  readonly status: number;
  readonly body?: unknown;
}

/** Обрыв соединения — сервер не ответил вовсе. */
export interface NetworkFailure {
  readonly network: 'connectionrefused' | 'connectionreset' | 'failed';
}

export type ModelReply = StreamReply | HttpFailure | NetworkFailure;

/** Ответ текстом. */
export const say = (text: string, textChunks?: number): StreamReply => ({ text, textChunks });

/** Вызов одного инструмента. */
export const call = (tool: string, args: unknown): StreamReply => ({ tools: [{ tool, args }] });

/** Шлюз: запрос модели висит, пока тест его не отпустит. */
export interface Gate {
  /** Запрос дошёл до подмены и ждёт. */
  readonly reached: Promise<void>;
  /** Отпустить запрос — подмена отдаст ответ, назначенный шлюзу. */
  release(): void;
}

/** Реплика тела запроса — то, что ассистент отправил модели. */
export interface ModelMessage {
  readonly role: string;
  readonly content?: unknown;
  readonly tool_calls?: readonly { readonly function: { readonly name: string } }[];
  readonly tool_call_id?: string;
}

/** Тело запроса к модели на одном шаге хода. */
export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly tools?: readonly { readonly function: { readonly name: string } }[];
}

interface Queued {
  readonly reply: ModelReply;
  readonly gate?: { open: Promise<void>; arrived: () => void };
}

/** Подменённая модель. */
export interface ModelMock {
  /** Тела запросов к модели по порядку. */
  readonly requests: readonly ModelRequest[];
  /** Запросы, на которые в очереди не нашлось ответа, — номерами по порядку. */
  readonly unanswered: readonly number[];
  /** Положить ответы в конец очереди. */
  reply(...replies: readonly ModelReply[]): void;
  /** Положить в очередь ответ, который уйдёт только после `release()` шлюза. */
  held(reply: ModelReply): Gate;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

/** Предполётный запрос CORS — браузер шлёт его перед POST с JSON. */
const preflight = (route: Route): Promise<void> => route.fulfill({ status: 204, headers: CORS });

/**
 * Подменяет локальный сервер: список из одной модели и ответы из очереди.
 *
 * Зовётся до открытия билдера — подмена ставится на страницу и живёт до конца теста.
 */
export async function installModelMock(page: Page): Promise<ModelMock> {
  const requests: ModelRequest[] = [];
  const unanswered: number[] = [];
  const queue: Queued[] = [];

  await page.route(MODELS_URL, (route) =>
    route.request().method() === 'OPTIONS'
      ? preflight(route)
      : route.fulfill({ json: { data: [{ id: MODEL_ID }] }, headers: CORS })
  );

  await page.route(COMPLETIONS_URL, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') return preflight(route);
    if (method !== 'POST') return route.continue();

    requests.push(route.request().postDataJSON() as ModelRequest);
    const next = queue.shift();
    if (next === undefined) {
      unanswered.push(requests.length);
      return route.fulfill({
        status: 500,
        headers: CORS,
        json: { error: { message: 'e2e: в сценарии нет ответа на этот запрос' } },
      });
    }
    if (next.gate !== undefined) {
      next.gate.arrived();
      await next.gate.open;
    }
    // Запрос мог быть отменён, пока висел на шлюзе: «Остановить» рвёт соединение. Отвечать
    // тогда некому, и отказ подмены — не ошибка сценария.
    try {
      await answer(route, next.reply);
    } catch {
      // Запрос уже закрыт браузером.
    }
  });

  return {
    requests,
    unanswered,
    reply(...replies) {
      for (const reply of replies) queue.push({ reply });
    },
    held(reply) {
      let release!: () => void;
      let arrived!: () => void;
      const open = new Promise<void>((resolve) => (release = resolve));
      const reached = new Promise<void>((resolve) => (arrived = resolve));
      queue.push({ reply, gate: { open, arrived } });
      return { reached, release };
    },
  };
}

function answer(route: Route, reply: ModelReply): Promise<void> {
  if ('network' in reply) return route.abort(reply.network);
  if ('status' in reply) {
    return route.fulfill({
      status: reply.status,
      headers: CORS,
      json: reply.body ?? { error: { message: `e2e: HTTP ${String(reply.status)}` } },
    });
  }
  return route.fulfill({
    status: 200,
    headers: { ...CORS, 'content-type': 'text/event-stream' },
    body: streamOf(reply),
  });
}

/** Ответ шага потоком SSE OpenAI-совместимого сервера. */
export function streamOf(reply: StreamReply): string {
  const event = (body: Record<string, unknown>): string =>
    `data: ${JSON.stringify({ id: 'e2e', object: 'chat.completion.chunk', created: 0, model: MODEL_ID, ...body })}\n\n`;
  const delta = (part: Record<string, unknown>, finish: FinishReason | null = null): string =>
    event({
      choices: [{ index: 0, delta: { role: 'assistant', ...part }, finish_reason: finish }],
    });

  let body = '';
  for (const piece of split(reply.reasoning, reply.reasoningChunks)) {
    body += delta({ reasoning_content: piece });
  }
  for (const piece of split(reply.text, reply.textChunks)) body += delta({ content: piece });
  const tools = reply.tools ?? [];
  if (tools.length > 0) {
    body += delta({
      tool_calls: tools.map((tool, index) => ({
        index,
        id: `call_${String(index)}_${tool.tool}`,
        type: 'function',
        function: { name: tool.tool, arguments: JSON.stringify(tool.args) },
      })),
    });
  }
  const finish =
    reply.finish === undefined ? (tools.length > 0 ? 'tool_calls' : 'stop') : reply.finish;
  if (finish !== null) {
    body += event({ choices: [{ index: 0, delta: {}, finish_reason: finish }] });
  }
  body += event({
    choices: [],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
  return `${body}data: [DONE]\n\n`;
}

/** Разбить текст на `parts` кусков примерно поровну; пустой текст — ни одного. */
function split(text: string | undefined, parts = 1): string[] {
  if (text === undefined || text === '') return [];
  const size = Math.ceil(text.length / Math.max(1, parts));
  const pieces: string[] = [];
  for (let at = 0; at < text.length; at += size) pieces.push(text.slice(at, at + size));
  return pieces;
}

/** Текст всех реплик запроса одной строкой — для поиска в нём. */
export function textOf(request: ModelRequest): string {
  return request.messages
    .map((message) =>
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '')
    )
    .join('\n');
}

/** Последняя реплика пользователя в запросе — там затравка хода и подсказки моста. */
export function lastUserText(request: ModelRequest): string {
  const last = [...request.messages].reverse().find((message) => message.role === 'user');
  return typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '');
}

/** Ответы инструментов в запросе — реплики `tool` по порядку. */
export function toolResults(request: ModelRequest): string[] {
  return request.messages
    .filter((message) => message.role === 'tool')
    .map((message) =>
      typeof message.content === 'string' ? message.content : JSON.stringify(message.content ?? '')
    );
}

/** Имена инструментов, предложенных модели в запросе. */
export function toolNames(request: ModelRequest): string[] {
  return (request.tools ?? []).map((tool) => tool.function.name);
}
