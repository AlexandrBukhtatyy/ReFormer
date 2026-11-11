/**
 * Знание для браузера: собирается из артефактов, без файловой системы и без компилятора.
 *
 * Чем отличается от CLI, и почему это не деградация, а другой профиль:
 *
 * | | CLI | браузер |
 * | --- | --- | --- |
 * | индекс, документация | с диска, у установленного пакета | из артефакта сборки |
 * | рецепты (`docs/llms/*.md`) | с диска | восстановлены из `llms.txt` артефакта |
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
import { KNOWN_PACKAGES } from '../../core/docs/packages.js';
import { createKnowledge, type Knowledge } from '../../core/knowledge.js';
import type { PlatformStatus } from '../../core/status.js';
import { createMemoryIssueSink, type MemoryIssueSink } from './issue-sink.js';
import {
  createBundleDocsSource,
  createBundleIndexSource,
  createBundleRecipeSource,
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
  /**
   * Каталог компонентов кита (`@reformer/ui-kit/catalog` или любой `{ components }` с `name`,
   * `role`, `exportName`, `subpath`), уже загруженный хостом. Без него генератор не сверяет
   * имена компонентов.
   */
  uiKitCatalog?: unknown;
  /** Версия сервера на момент сборки бандла — для `reformer://status`. */
  version?: string;
}

/** Статус браузерного знания: что вшито в артефакт. Компилятора и диска здесь нет по природе. */
function browserStatus(input: BrowserKnowledgeInput): PlatformStatus {
  const packages = input.index?.packages ?? {};
  const components = (input.uiKitCatalog as { components?: unknown } | undefined)?.components;
  return {
    profile: 'browser',
    server: { version: input.version ?? 'unknown', buildId: input.index?.builtAt ?? null },
    packages: KNOWN_PACKAGES.map((name) => {
      const index = packages[name] as { version?: unknown } | undefined;
      return {
        name,
        root: null,
        version: typeof index?.version === 'string' ? index.version : null,
        via: index ? 'bundle' : null,
      };
    }),
    typecheck: { available: false, detail: 'no compiler in the browser profile' },
    uiKitCatalog: {
      found: Array.isArray(components),
      components: Array.isArray(components) ? components.length : 0,
      source: Array.isArray(components) ? 'host' : null,
    },
    problems: [],
  };
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
    // Рецепты — файлы `docs/llms`, восстановленные из тех же текстов `llms.txt`: без них
    // `find_recipe` в браузере отвечал случайной секцией (калибровка, паритет каналов).
    recipes: createBundleRecipeSource(input.docs ?? null),
    spec: createMemorySpecSource(input.specs ?? new Map()),
    issues,
    ...(input.uiKitCatalog === undefined ? {} : { uiKitCatalog: async () => input.uiKitCatalog }),
    status: () => browserStatus(input),
    // `symbolsFallback` не передаётся намеренно — разбора AST в браузере нет, ядро подставит
    // заглушку, а деградация будет видна в ответах инструментов, а не спрятана.
  });
  return { knowledge, issues };
}
