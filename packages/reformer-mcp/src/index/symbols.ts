/**
 * Совместимостный фасад над слоем символов.
 *
 * Логика уехала в `core/index/symbols.ts` и принимает `Knowledge` параметром; здесь она
 * замкнута на знание процесса (`platform/cli/knowledge.ts`). Фасад временный — он держит
 * неизменными потребителей и тесты, пока их не перевели на фабрику.
 *
 * @module reformer-mcp/index/symbols
 */

import * as core from '../core/index/symbols.js';
import { cliKnowledge } from '../platform/cli/knowledge.js';
import type { PublicSymbol } from '../core/index/public-symbol.js';

/** Публичные символы одного пакета. */
export function publicSymbols(pkg: string): Promise<PublicSymbol[]> {
  return core.publicSymbols(cliKnowledge(), pkg);
}

/** Все варианты символа с этим именем, в порядке `KNOWN_PACKAGES`. */
export function findSymbols(name: string, pkg = '*'): Promise<PublicSymbol[]> {
  return core.findSymbols(cliKnowledge(), name, pkg);
}

/** Первый вариант символа, либо `null`. */
export function findOneSymbol(name: string, pkg = '*'): Promise<PublicSymbol | null> {
  return core.findOneSymbol(cliKnowledge(), name, pkg);
}

/** Предупреждение о пакетах без индекса — чтобы деградация была видимой. */
export function indexCoverageWarning(): string {
  return core.indexCoverageWarning(cliKnowledge());
}

/** Только для тестов — сбросить кэш фолбэка. */
export function __resetSymbolFallbackCache(): void {
  cliKnowledge().memo.delete('symbols:fallback');
}
