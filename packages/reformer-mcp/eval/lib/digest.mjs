/**
 * Отпечаток аргументов вызова инструмента — тот же, что пишет трасса сервера
 * (`src/platform/cli/trace-sink.ts`, `argumentsDigest`): первые 16 знаков SHA-256 их JSON.
 *
 * По нему журнал агента и трасса сервера сходятся вызов к вызову, даже когда агент зовёт
 * инструменты параллельно и порядок прихода на сервер не совпадает с порядком в транскрипте.
 * Совпадение двух реализаций держит тест (`tests/eval-run-log.test.ts`).
 *
 * @module reformer-mcp/eval/lib/digest
 */

import { createHash } from 'node:crypto';

/** @param {unknown} value */
export function argumentsDigest(value) {
  return createHash('sha256')
    .update(JSON.stringify(value ?? null))
    .digest('hex')
    .slice(0, 16);
}
