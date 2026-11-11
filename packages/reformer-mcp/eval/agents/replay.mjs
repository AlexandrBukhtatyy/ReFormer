/**
 * Агент без модели: кладёт в рабочий каталог эталонное решение сценария, собранное через сервер.
 *
 * Весь путь раннера проверяется детерминированно и бесплатно, поэтому прогон годится для CI. Вердикт
 * красный только тогда, когда сломан сервер, контракт или сам раннер.
 */

import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
import { repoRoot } from '../records/record.mjs';
import { writeReferenceBundle } from '../scenarios/catalog.mjs';

export const kind = 'replay';

/** @param {import('./types.mjs').AgentInput} input */
export async function runAgent(input) {
  const startedAt = Date.now();
  // Окружение — как у агентов с моделью (`claude-code`, `ollama`): рабочий каталог вне репозитория,
  // пакеты `@reformer/*` — от корня монорепо. Без него сборка честно отвечает «окружение».
  const client = new McpClient(input.serverPath, {
    env: {
      REFORMER_TRACE_FILE: input.traceFile,
      // Полная трасса: транскрипта у повтора нет, и разбор прогона читает ответы сервера отсюда.
      REFORMER_TRACE_FULL: '1',
      REFORMER_TYPECHECK_ROOT: repoRoot,
    },
    cwd: input.workspaceDirectory,
  });
  try {
    await client.initialize();
    if (!input.scenario.reference) {
      return failure(startedAt, 'у сценария нет эталона');
    }
    await writeReferenceBundle({
      scenario: input.scenario,
      target: input.target,
      directory: path.join(input.workspaceDirectory, 'form'),
      client,
    });
    return {
      transcriptPath: null,
      toolCalls: [
        ...(input.scenario.reference === 'plan_form' ? [{ name: 'plan_form', ok: true }] : []),
        { name: 'form_build', ok: true },
      ],
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, turns: 0 },
      costUsd: 0,
      durationMs: Date.now() - startedAt,
      exitReason: 'completed',
      finalText: '',
      isolation: { ok: true, problems: [] },
    };
  } catch (error) {
    return failure(startedAt, String(error?.message ?? error));
  } finally {
    client.close();
  }
}

function failure(startedAt, reason) {
  return {
    transcriptPath: null,
    toolCalls: [],
    usage: null,
    costUsd: 0,
    durationMs: Date.now() - startedAt,
    exitReason: 'error',
    finalText: reason,
    isolation: { ok: true, problems: [] },
  };
}
