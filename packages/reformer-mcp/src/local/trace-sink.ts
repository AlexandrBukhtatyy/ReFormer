/**
 * Журнал вызовов сервера для замеров: `REFORMER_TRACE_FILE=<путь>` — по строке JSON на вызов.
 *
 * Раннер сценариев получает одинаковую трассу от любого агента, не разбирая его транскрипт. По
 * умолчанию текст ответов и полные аргументы в журнал не пишутся: только размеры, отпечаток
 * аргументов (по нему видно повторные вызовы) и короткое начало.
 *
 * Полный режим — `REFORMER_TRACE_FULL=1`: строка несёт аргументы целиком и текст ответа. Он нужен
 * для разбора прогона, когда транскрипт агента ответа не хранит, и для сверки, что модель получила
 * то же, что отдал сервер. Стенд сценариев включает его сам: сырьё прогона остаётся в `.tmp`.
 *
 * Общий ключ с транскриптом агента — номер вызова инструмента `call` (по порядку, только `tools/call`)
 * и отпечаток аргументов `argumentsDigest`: агент считает его той же функцией
 * ({@link argumentsDigest}; копия для стендов — `eval/lib/digest.mjs`). Номер `seq` считает все вызовы,
 * включая чтение ресурсов.
 *
 * @module @reformer/mcp/local/trace-sink
 */

import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { INNER_CALLS_META, type ReformerServerCall } from '../contract/call.js';

export const TRACE_FILE_ENV = 'REFORMER_TRACE_FILE';
export const TRACE_FULL_ENV = 'REFORMER_TRACE_FULL';

const ARGUMENTS_PREVIEW_CHARS = 300;

/** Значение переменной окружения включает режим: `1`, `true`, `yes`. */
export const isTraceFull = (value: string | undefined): boolean =>
  value !== undefined && /^(1|true|yes)$/i.test(value.trim());

/**
 * Отпечаток аргументов вызова: первые 16 знаков SHA-256 их JSON. Агент, отправивший аргументы,
 * получает тот же отпечаток: порядок ключей JSON-RPC сохраняет.
 */
export function argumentsDigest(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex')
    .slice(0, 16);
}

/**
 * Текст ответа, как его прочтёт клиент: блоки `content` инструмента или `contents` ресурса —
 * их тексты через перевод строки; блок без текста — его JSON.
 */
export function resultText(result: unknown): string | null {
  if (result === null || typeof result !== 'object') return null;
  const record = result as { content?: unknown; contents?: unknown };
  const blocks = record.content ?? record.contents;
  if (!Array.isArray(blocks)) return JSON.stringify(result);
  return blocks
    .map((block) =>
      block !== null &&
      typeof block === 'object' &&
      typeof (block as { text?: unknown }).text === 'string'
        ? (block as { text: string }).text
        : JSON.stringify(block)
    )
    .join('\n');
}

/** Вложенные вызовы `run_script` из `_meta` ответа — полем `inner` строки трассы. */
function innerCallsOf(result: unknown): { inner?: unknown } {
  if (result === null || typeof result !== 'object') return {};
  const meta = (result as { _meta?: Record<string, unknown> })._meta;
  const inner = meta?.[INNER_CALLS_META];
  return Array.isArray(inner) ? { inner } : {};
}

export interface TraceSinkOptions {
  /** Полный режим: аргументы целиком и текст ответа. */
  readonly full?: boolean;
}

/** Наблюдатель, пишущий в файл; `undefined`, если путь не задан, — сервер работает без трассы. */
export function createTraceSink(
  traceFile: string | undefined,
  options: TraceSinkOptions = {}
): ((call: ReformerServerCall) => void) | undefined {
  if (!traceFile) return undefined;
  mkdirSync(dirname(traceFile), { recursive: true });
  let sequence = 0;
  let tools = 0;
  return (call) => {
    const serialized = JSON.stringify(call.arguments ?? null);
    const entry = {
      ts: new Date().toISOString(),
      seq: ++sequence,
      ...(call.kind === 'tool' ? { call: ++tools } : {}),
      pid: process.pid,
      kind: call.kind,
      name: call.name,
      argumentsChars: serialized.length,
      argumentsDigest: argumentsDigest(call.arguments),
      argumentsPreview: serialized.slice(0, ARGUMENTS_PREVIEW_CHARS),
      resultChars: call.resultChars,
      isError: call.isError,
      protocolError: call.protocolError,
      durationMs: Math.round(call.durationMs),
      // Code Mode: вызовы инструментов изнутри `run_script` — модель их не видит, разбор прогона видит.
      ...innerCallsOf(call.result),
      ...(options.full
        ? { arguments: call.arguments ?? null, result: resultText(call.result) }
        : {}),
    };
    try {
      appendFileSync(traceFile, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      // Сбой журнала не должен ломать ответ агенту: замер покажет нехватку строк.
      console.error(`Не удалось записать трассу в ${traceFile}:`, error);
    }
  };
}
