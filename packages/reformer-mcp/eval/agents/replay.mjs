/**
 * Агент без модели: кладёт в рабочий каталог эталонное решение сценария, собранное через сервер.
 *
 * Весь путь раннера проверяется детерминированно и бесплатно, поэтому прогон годится для CI. Вердикт
 * красный только тогда, когда сломан сервер, контракт или сам раннер.
 */

import path from 'node:path';
import { McpClient } from '../lib/client.mjs';
import { writeReferenceBundle } from '../scenarios/catalog.mjs';

export const kind = 'replay';

/** @param {import('./types.mjs').AgentInput} input */
export async function runAgent(input) {
  const startedAt = Date.now();
  const client = new McpClient(input.serverPath, {
    env: { REFORMER_TRACE_FILE: input.traceFile },
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
      toolCalls: [{ name: 'generate_form', ok: true }],
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
