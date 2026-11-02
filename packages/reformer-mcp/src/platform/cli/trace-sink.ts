/**
 * Журнал вызовов сервера для замеров: `REFORMER_TRACE_FILE=<путь>` — по строке JSON на вызов.
 *
 * Раннер сценариев получает одинаковую трассу от любого агента, не разбирая его транскрипт. Текст
 * ответов и полные аргументы в журнал не пишутся: только размеры, отпечаток аргументов (по нему
 * видно повторные вызовы) и короткое начало.
 *
 * @module reformer-mcp/platform/cli/trace-sink
 */

import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ReformerServerCall } from '../../core/server/mount.js';

export const TRACE_FILE_ENV = 'REFORMER_TRACE_FILE';

const ARGUMENTS_PREVIEW_CHARS = 300;

/** Наблюдатель, пишущий в файл; `undefined`, если путь не задан, — сервер работает без трассы. */
export function createTraceSink(
  traceFile: string | undefined
): ((call: ReformerServerCall) => void) | undefined {
  if (!traceFile) return undefined;
  mkdirSync(dirname(traceFile), { recursive: true });
  let sequence = 0;
  return (call) => {
    const serialized = JSON.stringify(call.arguments ?? null);
    const entry = {
      ts: new Date().toISOString(),
      seq: ++sequence,
      pid: process.pid,
      kind: call.kind,
      name: call.name,
      argumentsChars: serialized.length,
      argumentsDigest: createHash('sha256').update(serialized).digest('hex').slice(0, 16),
      argumentsPreview: serialized.slice(0, ARGUMENTS_PREVIEW_CHARS),
      resultChars: call.resultChars,
      isError: call.isError,
      protocolError: call.protocolError,
      durationMs: Math.round(call.durationMs),
    };
    try {
      appendFileSync(traceFile, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch (error) {
      // Сбой журнала не должен ломать ответ агенту: замер покажет нехватку строк.
      console.error(`Не удалось записать трассу в ${traceFile}:`, error);
    }
  };
}
