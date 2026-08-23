/**
 * `Knowledge` — всё, что сервер знает о ReFormer, и единственное, что нужно его инструментам.
 *
 * Это контейнер данных, а не god-object: инструменты остаются свободными функциями и получают
 * его параметром. Так их можно вызвать в тесте с корпусом-литералом, не поднимая ни диска, ни
 * артефакта, — и так же они работают в браузере, где источники другие, а ядро то же.
 *
 * Что здесь НЕ живёт и почему: ни путей, ни `fetch`, ни `fs`. Всё это — в `platform/*`, которая
 * собирает {@link KnowledgeSources} и передаёт их сюда. Граница проверяется механически:
 * `npm run check:no-node-globals` не должен находить в `core/` ни одного node-глобала.
 *
 * @module reformer-mcp/core/knowledge
 */

import { createDocsCorpus, type DocsCorpus, type DocsSource } from './docs/corpus.js';
import { mergeIndex, type IndexSource } from './index/merge.js';
import { EMPTY_RECIPE_SOURCE, type RecipeSource } from './docs/recipes.js';
import { EMPTY_SPEC_SOURCE, type SpecSource } from './spec/source.js';
import { UNAVAILABLE_ISSUE_SINK, type IssueSink } from './issues/sink.js';
import type { PublicSymbol } from './index/public-symbol.js';
import type { MergedIndex } from './index/types.js';

/**
 * Разбор публичных символов пакета в обход индекса.
 *
 * Существует ради одного случая: рядом с сервером стоит СТАРЫЙ `@reformer/*` без
 * `llms-index.json`. В CLI это разбор TypeScript-AST, который подтягивается динамически (и
 * потому `typescript` остаётся опциональным peer'ом). В браузере фолбэка нет вовсе —
 * и это правильно: тащить туда компилятор ради редкого случая дороже, чем честно показать,
 * что символы такого пакета не перечислены.
 */
export type SymbolsFallback = (pkg: string) => Promise<PublicSymbol[]>;

/** Что платформа обязана предоставить ядру. */
export interface KnowledgeSources {
  docs: DocsSource;
  index: IndexSource;
  /**
   * Исходные файлы `docs/llms`. Отсутствует — первая стадия `find_recipe` (подбор по имени
   * файла) отключается, топик уходит в каскад по секциям `llms.txt`.
   */
  recipes?: RecipeSource;
  /** Текст постановки задачи. Отсутствует — `plan_form` работает только от `description`. */
  spec?: SpecSource;
  /** Куда сохранять отчёты `report_issue`. Отсутствует — инструмент честно откажет. */
  issues?: IssueSink;
  /** Отсутствует — пакеты без индекса просто не дадут символов. */
  symbolsFallback?: SymbolsFallback;
}

export interface Knowledge {
  /** Слитый индекс всех пакетов, у которых он есть. */
  readonly index: MergedIndex;
  /** Документация: `llms.txt` и его секции. */
  readonly docs: DocsCorpus;
  /** Файлы `docs/llms`; в средах без них — {@link EMPTY_RECIPE_SOURCE}. */
  readonly recipes: RecipeSource;
  /** Спеки; в средах без них — {@link EMPTY_SPEC_SOURCE}. */
  readonly spec: SpecSource;
  /** Сток отчётов; в средах без записи — {@link UNAVAILABLE_ISSUE_SINK}. */
  readonly issues: IssueSink;
  /** См. {@link SymbolsFallback}. */
  readonly symbolsFallback?: SymbolsFallback;
  /**
   * Ленивые производные, общие на экземпляр: разобранные символы фолбэка, поисковые корпуса.
   *
   * Именно на экземпляр, а не на модуль. Модульный кэш был бы общим для двух разных Knowledge
   * (например, вшитого артефакта и папки проекта), и второй молча отвечал бы данными первого.
   */
  readonly memo: Map<string, unknown>;
}

/**
 * Собрать знание из источников.
 *
 * Индекс сливается сразу — он нужен почти каждому инструменту, а слияние стоит около 17 мс
 * против 784 мс у прежнего разбора AST. Документация читается лениво: до первого обращения
 * она может не понадобиться вовсе.
 */
export function createKnowledge(sources: KnowledgeSources): Knowledge {
  return {
    index: mergeIndex(sources.index),
    docs: createDocsCorpus(sources.docs),
    recipes: sources.recipes ?? EMPTY_RECIPE_SOURCE,
    spec: sources.spec ?? EMPTY_SPEC_SOURCE,
    issues: sources.issues ?? UNAVAILABLE_ISSUE_SINK,
    ...(sources.symbolsFallback ? { symbolsFallback: sources.symbolsFallback } : {}),
    memo: new Map(),
  };
}

/** Ленивая производная от знания, посчитанная один раз на экземпляр. */
export function memoize<T>(k: Knowledge, key: string, build: () => T): T {
  if (k.memo.has(key)) return k.memo.get(key) as T;
  const value = build();
  k.memo.set(key, value);
  return value;
}
