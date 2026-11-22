/**
 * Журнал проблем знания CLI: что не прочиталось, не нашлось или не разобралось.
 *
 * Источники знания по-прежнему не роняют сервер (битый индекс одного пакета не должен отключать
 * остальные), но и не молчат: каждое проглоченное исключение оставляет запись, которую показывает
 * `reformer://status`. Повторы схлопываются по паре «источник + подробность».
 *
 * Журнал сбрасывается вместе со знанием ({@link clearKnowledgeProblems}): после пересборки пакетов
 * старые проблемы описывали бы файлы, которых уже нет.
 *
 * @module @reformer/mcp/local/problems
 */

import type { KnowledgeProblem } from '../contract/status.js';

const problems = new Map<string, KnowledgeProblem>();

/** Ограничение длины подробности: стек или сырой JSON в статусе не нужны. */
const DETAIL_LIMIT = 300;

function detailOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  return typeof cause === 'string' ? cause : String(cause);
}

/** Записать проблему источника. */
export function reportKnowledgeProblem(source: string, cause: unknown): void {
  const detail = detailOf(cause).replace(/\s+/g, ' ').trim().slice(0, DETAIL_LIMIT);
  problems.set(`${source}\u0000${detail}`, { source, detail });
}

/** Все записи по порядку появления. */
export function knowledgeProblems(): KnowledgeProblem[] {
  return [...problems.values()];
}

/** Сбросить журнал. */
export function clearKnowledgeProblems(): void {
  problems.clear();
}
