/**
 * Знание для браузера: собирается из артефактов, без файловой системы и без компилятора.
 *
 * Чем отличается от CLI, и почему это не деградация, а другой профиль:
 *
 * | | CLI | браузер |
 * | --- | --- | --- |
 * | индекс, документация | с диска, у установленного пакета | из артефакта сборки |
 * | рецепты (`docs/llms/*.md`) | есть | нет — топик уходит в каскад по секциям |
 * | разбор AST для пакетов без индекса | есть (`typescript` как opt-peer) | нет |
 * | отчёты `report_issue` | файл в проекте | память вкладки |
 *
 * Из четырёх различий три — отсутствие носителя, а не урезание логики: инструменты те же,
 * ядро то же, отличается только откуда приходят данные.
 *
 * Асинхронно здесь ровно одно — ЗАГРУЗКА артефакта; она делается вызывающим и передаётся сюда
 * готовой. Так ни один вызов инструмента не может внезапно уйти в сеть посреди хода агента.
 *
 * @module reformer-mcp/platform/browser/knowledge
 */

import type { DocsBundle, IndexBundle } from '../../core/bundle.js';
import { createKnowledge, type Knowledge } from '../../core/knowledge.js';
import { createMemoryIssueSink, type MemoryIssueSink } from './issue-sink.js';
import {
  createBundleDocsSource,
  createBundleIndexSource,
  createMemorySpecSource,
} from './sources.js';

export interface BrowserKnowledgeInput {
  /** Индексы пакетов. Без них знание пустое: на индексе стоит почти каждый инструмент. */
  index: IndexBundle;
  /**
   * Тексты `llms.txt`. Необязательны: `get_context`, `choose_api`, `get_symbol_docs`,
   * `list_symbols` и `validate_form` работают на одном индексе, и потребителю, которому
   * хватает их, незачем платить за 1.27 МБ прозы.
   */
  docs?: DocsBundle | null;
  /** Спеки, уже прочитанные хостом: имя файла → текст. */
  specs?: ReadonlyMap<string, string>;
}

export interface BrowserKnowledge {
  knowledge: Knowledge;
  /** Накопленные отчёты — хост решает, сохранять ли их и куда. */
  issues: MemoryIssueSink;
}

export function createBrowserKnowledge(input: BrowserKnowledgeInput): BrowserKnowledge {
  const issues = createMemoryIssueSink();
  const knowledge = createKnowledge({
    docs: createBundleDocsSource(input.docs ?? null),
    index: createBundleIndexSource(input.index),
    spec: createMemorySpecSource(input.specs ?? new Map()),
    issues,
    // `recipes` и `symbolsFallback` не передаются намеренно — ядро подставит заглушки,
    // а деградация будет видна в ответах инструментов, а не спрятана.
  });
  return { knowledge, issues };
}
