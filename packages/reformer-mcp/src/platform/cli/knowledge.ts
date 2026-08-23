/**
 * Знание, собранное из того, что доступно процессу Node: диск и (при наличии) компилятор.
 *
 * Единственный экземпляр на процесс — тот же кэш, что был у модульных загрузчиков до
 * расщепления. Ленивый: слияние индекса стоит около 17 мс, и платить их на старте сервера,
 * который может обойтись одним `resources/list`, незачем.
 *
 * @module reformer-mcp/platform/cli/knowledge
 */

import { createKnowledge, type Knowledge } from '../../core/knowledge.js';
import type { PublicSymbol } from '../../core/index/public-symbol.js';
import { createCliDocsSource } from './docs-source.js';
import { createCliIndexSource } from './index-source.js';
import { createCliRecipeSource } from './recipe-source.js';
import { createCliSpecSource } from './spec-source.js';
import { createCliIssueSink } from './issue-sink.js';

/**
 * Разбор AST — только как фолбэк для пакета без индекса.
 *
 * Импорт динамический: модуль тянет `typescript`, и грузить его на старте ради случая,
 * которого обычно нет, незачем. Отсутствие пакета (он в optionalDependencies) не ошибка —
 * вызывающий трактует это как «символов нет».
 */
async function parseSymbolsFallback(pkg: string): Promise<PublicSymbol[]> {
  const mod = await import('./symbols-parser.js');
  return mod.getPublicSymbols(pkg);
}

let cached: Knowledge | null = null;

/** Знание процесса. Создаётся при первом обращении. */
export function cliKnowledge(): Knowledge {
  return (cached ??= createKnowledge({
    docs: createCliDocsSource(),
    index: createCliIndexSource(),
    recipes: createCliRecipeSource(),
    spec: createCliSpecSource(),
    issues: createCliIssueSink(),
    symbolsFallback: parseSymbolsFallback,
  }));
}

/** Только для тестов — пересоздать знание (сбрасывает все кэши разом). */
export function __resetCliKnowledge(): void {
  cached = null;
}
