/**
 * Вызов инструмента, написанный текстом ответа, — исполняется как настоящий.
 *
 * Qwen2.5-Coder 14B в LM Studio не делает родных вызовов вовсе: `tool_calls` в ответе пуст, а вызов
 * написан текстом — `<tools>{"name": "create_form", "arguments": {…}}</tools>`, `<tool_call>…`
 * или блоком ```json. Сервер такой шаблон не узнаёт, и без разбора ход с этой моделью кончался
 * ошибкой «модель написала вызов текстом» (`./textual-call`) на первом же шаге, не сделав ни одной
 * правки (ReFormer-4w1z; проба 2026-11-21 на OpenAI-совместимом сервере). Стенд замеров MCP
 * разбирает такие вызовы так же (`eval/agents/openai.mjs`, `OPENAI_TEXT_CALLS`).
 *
 * Разбор стоит middleware модели, а не в цикле хода: к событию `finish` цикл SDK уже закончен, и
 * исполнить вызов там нечем. Middleware превращает текст в часть `tool-call` до SDK — инструмент
 * исполняется обычным путём, а в историю диалога вызов попадает настоящим, так что следующий шаг
 * модель видит свой вызов и его результат, как после родного.
 *
 * Чего разбор НЕ делает:
 *  - не трогает шаг с родным вызовом: два способа вызова в одном ответе — скорее пересказ сделанного,
 *    чем вторая правка;
 *  - не трогает шаг без инструментов (`toolChoice: none` на последнем шаге хода, см. `./ai-sdk`);
 *  - не чинит битую запись. Нераспознанное остаётся текстом, и его по-прежнему ловит детектор
 *    `./textual-call` — ошибкой хода, а не тихим успехом.
 *
 * @module plugins/forms/ai/providers/text-calls
 */

import { generateId, type LanguageModelMiddleware } from 'ai';

type WrapStream = NonNullable<LanguageModelMiddleware['wrapStream']>;
type CallOptions = Parameters<WrapStream>[0]['params'];
type StreamResult = Awaited<ReturnType<WrapStream>>;
/** Часть потока модели — то, что провайдер отдаёт SDK. */
export type ModelStreamPart =
  StreamResult['stream'] extends ReadableStream<infer Part> ? Part : never;

/** Вызов, прочитанный из текста: имя инструмента и аргументы строкой JSON, как у родного. */
export interface TextCall {
  readonly toolName: string;
  readonly input: string;
}

/** Объект JSON верхнего уровня в тексте: где стоит и его текст, приведённый к JSON. */
interface JsonSpan {
  readonly start: number;
  readonly end: number;
  readonly json: string;
}

/** Символы после `\`, которые JSON понимает как экранирование. */
const JSON_ESCAPES = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

/** Сырой управляющий символ внутри строки — экранированным, как требует JSON. */
const escapeRaw = (char: string): string =>
  char === '\n' ? '\\n' : char === '\r' ? '\\r' : char === '\t' ? '\\t' : char;

/**
 * Объекты JSON верхнего уровня в тексте — в любой обёртке: `<tools>`, `<tool_call>`, ```json или
 * без неё. Вольности модели, которые приводятся к JSON (их собрал стенд замеров на той же модели):
 *  - сырые переводы строк и табуляции внутри строки — в коде, который она передаёт аргументом;
 *  - значение в обратных кавычках, как шаблонная строка JS: `"code": \`…\``. Внутри: `` \` `` —
 *    обратная кавычка, `"` экранируется;
 *  - экранирование, которого в JSON нет, внутри обычной строки (`` \` ``): косая черта отбрасывается.
 */
function jsonObjectsIn(text: string): JsonSpan[] {
  const found: JsonSpan[] = [];
  let depth = 0;
  /** Кавычка открытой строки: `"` или `` ` ``; `null` — вне строки. */
  let quote: '"' | '`' | null = null;
  let escaped = false;
  let current = '';
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (depth === 0) {
      if (char === '{') {
        depth = 1;
        current = char;
        start = index;
        quote = null;
        escaped = false;
      }
      continue;
    }
    if (quote === '"') {
      if (escaped) {
        escaped = false;
        current += JSON_ESCAPES.has(char) ? `\\${char}` : escapeRaw(char);
      } else if (char === '\\') escaped = true;
      else {
        if (char === '"') quote = null;
        current += escapeRaw(char);
      }
      continue;
    }
    if (quote === '`') {
      if (escaped) {
        escaped = false;
        current += char === '`' ? '`' : `\\${char}`;
      } else if (char === '\\') escaped = true;
      else if (char === '`') {
        quote = null;
        current += '"';
      } else current += char === '"' ? '\\"' : escapeRaw(char);
      continue;
    }
    if (char === '`') {
      quote = '`';
      current += '"';
      continue;
    }
    current += char;
    if (char === '"') quote = '"';
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) found.push({ start, end: index + 1, json: current });
  }
  return found;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Вызов из одного объекта JSON: `{"name": …, "arguments": {…}}` (или `parameters`, или аргументы
 * строкой JSON), в том числе в конверте OpenAI — `{"function": {"name": …, "arguments": "…"}}`.
 * Имя — только известного инструмента: чужое имя в тексте — просто данные, а не попытка вызова.
 */
function callOf(json: string, known: ReadonlySet<string>): TextCall | undefined {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  const envelope = isRecord(value.function) ? value.function : value;
  const name = envelope.name;
  if (typeof name !== 'string' || !known.has(name)) return undefined;
  let args = envelope.arguments ?? envelope.parameters ?? {};
  if (typeof args === 'string') {
    try {
      args = JSON.parse(args);
    } catch {
      return undefined;
    }
  }
  if (!isRecord(args)) return undefined;
  return { toolName: name, input: JSON.stringify(args) };
}

/** Обёртки, опустевшие после выреза вызова: теги шаблона вызова и блок кода. */
const EMPTY_WRAPPERS: readonly RegExp[] = [
  /<(tools|tool_calls?|function_calls?)>\s*<\/\1>/g,
  /```[\w-]*\s*```/g,
];

/**
 * Вызовы известных инструментов в тексте и текст без них.
 *
 * @param text - Текст ответа модели.
 * @param toolNames - Инструменты шага.
 * @returns `calls` — по порядку в тексте; `rest` — текст без вызовов и опустевших обёрток (без
 *   вызовов — исходный текст как есть).
 */
export function extractTextCalls(
  text: string,
  toolNames: Iterable<string>
): { calls: TextCall[]; rest: string } {
  const known = new Set(toolNames);
  const calls: TextCall[] = [];
  let rest = '';
  let from = 0;
  for (const span of jsonObjectsIn(text)) {
    const call = callOf(span.json, known);
    if (!call) continue;
    calls.push(call);
    rest += text.slice(from, span.start);
    from = span.end;
  }
  if (calls.length === 0) return { calls, rest: text };
  rest += text.slice(from);
  for (const wrapper of EMPTY_WRAPPERS) rest = rest.replace(wrapper, '');
  return { calls, rest: rest.replace(/\n{3,}/g, '\n\n').trim() };
}

/**
 * С чего может начаться вызов текстом: тег шаблона, блок кода, объект JSON. Текст до первого из
 * них идёт в ленту сразу, с него — придерживается до конца блока: решить, вызов ли это, можно
 * только по всему тексту.
 */
const OPENERS: readonly string[] = ['<tool', '<function', '```', '{'];
const LONGEST_OPENER = Math.max(...OPENERS.map((opener) => opener.length));

/** Где в тексте начинается первая возможная обёртка вызова; `-1` — нигде. */
function firstOpener(text: string): number {
  let first = -1;
  for (const opener of OPENERS) {
    const index = text.indexOf(opener);
    if (index >= 0 && (first < 0 || index < first)) first = index;
  }
  return first;
}

/**
 * Сколько символов в конце текста могут оказаться началом обёртки, разрезанной между кусками
 * потока (`<to` + `ols>`): их ленте пока не отдают.
 */
function partialOpenerTail(text: string): number {
  for (let length = Math.min(text.length, LONGEST_OPENER - 1); length > 0; length--) {
    const tail = text.slice(-length);
    if (OPENERS.some((opener) => opener.startsWith(tail))) return length;
  }
  return 0;
}

/** Блок текста в потоке: его ещё не отданный ленте хвост. */
interface Block {
  held: string;
  /** Встретилась ли возможная обёртка: дальше весь текст блока ждёт его конца. */
  holding: boolean;
}

/**
 * Поток модели, в котором вызовы известных инструментов, написанные текстом, стали частями
 * `tool-call`.
 *
 * Текст до первой возможной обёртки вызова идёт дальше сразу — лента не замирает на обычном ответе;
 * с обёртки блок придерживается до `text-end` и там разбирается целиком. Найденные вызовы уходят
 * перед `finish`, а причина конца шага становится `tool-calls` (сырая причина сервера — как была).
 *
 * @param toolNames - Инструменты шага: только их имена считаются вызовом.
 */
export function recoverTextCalls(
  toolNames: readonly string[]
): TransformStream<ModelStreamPart, ModelStreamPart> {
  const blocks = new Map<string, Block>();
  const recovered: TextCall[] = [];
  let nativeCall = false;

  /** Закрыть блок: придержанное — разобрать и вернуть то, что остаётся текстом. */
  const settle = (id: string): string => {
    const block = blocks.get(id);
    blocks.delete(id);
    if (!block || block.held === '') return '';
    if (nativeCall) return block.held;
    const { calls, rest } = extractTextCalls(block.held, toolNames);
    recovered.push(...calls);
    return rest;
  };

  const text = (id: string, delta: string): ModelStreamPart => ({ type: 'text-delta', id, delta });

  return new TransformStream<ModelStreamPart, ModelStreamPart>({
    transform(part, controller) {
      switch (part.type) {
        case 'text-start':
          blocks.set(part.id, { held: '', holding: false });
          controller.enqueue(part);
          return;
        case 'text-delta': {
          const block = blocks.get(part.id);
          if (!block || nativeCall) {
            controller.enqueue(part);
            return;
          }
          block.held += part.delta;
          if (block.holding) return;
          const opener = firstOpener(block.held);
          if (opener >= 0) block.holding = true;
          const cut = opener >= 0 ? opener : block.held.length - partialOpenerTail(block.held);
          if (cut > 0) {
            controller.enqueue({ ...part, delta: block.held.slice(0, cut) });
            block.held = block.held.slice(cut);
          }
          return;
        }
        case 'text-end': {
          const rest = settle(part.id);
          if (rest !== '') controller.enqueue(text(part.id, rest));
          controller.enqueue(part);
          return;
        }
        case 'tool-input-start':
        case 'tool-call':
          // Родной вызов: придержанный текст уходит как есть, дальше блоки не придерживаются.
          if (!nativeCall) {
            nativeCall = true;
            for (const [id, block] of blocks) {
              if (block.held !== '') controller.enqueue(text(id, block.held));
              block.held = '';
              block.holding = false;
            }
          }
          controller.enqueue(part);
          return;
        case 'finish': {
          // Блоки, которым сервер не прислал `text-end`, разбираются здесь же — без закрытия.
          for (const id of [...blocks.keys()]) {
            const rest = settle(id);
            if (rest !== '') controller.enqueue(text(id, rest));
          }
          // Родной вызов, пришедший уже после закрытия блока с текстовым, побеждает: текстовый
          // остаётся неисполненным — исполнить оба значило бы рискнуть одной правкой дважды.
          if (nativeCall || recovered.length === 0) {
            controller.enqueue(part);
            return;
          }
          for (const call of recovered) {
            controller.enqueue({
              type: 'tool-call',
              toolCallId: `text-call-${generateId()}`,
              toolName: call.toolName,
              input: call.input,
            });
          }
          controller.enqueue({
            ...part,
            finishReason: { ...part.finishReason, unified: 'tool-calls' },
          });
          return;
        }
        default:
          controller.enqueue(part);
      }
    },
    // Поток кончился без `finish` — придержанное отдаётся как было: решать о вызове уже некому.
    flush(controller) {
      for (const [id, block] of blocks) {
        if (block.held !== '') controller.enqueue(text(id, block.held));
      }
    },
  });
}

/** Инструменты, которые шаг разрешает звать; на шаге с `toolChoice: none` — ни одного. */
function toolNamesOf(params: CallOptions): string[] {
  if (params.toolChoice?.type === 'none') return [];
  return (params.tools ?? []).flatMap((tool) => (tool.type === 'function' ? [tool.name] : []));
}

/**
 * Middleware модели: вызовы, написанные текстом, — настоящими вызовами. Ставится на канал
 * локального сервера (`./byok`): облачные модели вызывают инструменты сами, и разбор им дал бы
 * только риск принять пример JSON в объяснении за вызов.
 */
export const textCallsMiddleware: LanguageModelMiddleware = {
  specificationVersion: 'v4',
  wrapStream: async ({ doStream, params }) => {
    const result = await doStream();
    const toolNames = toolNamesOf(params);
    if (toolNames.length === 0) return result;
    return { ...result, stream: result.stream.pipeThrough(recoverTextCalls(toolNames)) };
  },
};
