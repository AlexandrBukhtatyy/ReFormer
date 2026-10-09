/**
 * Объявления для `plugin.mjs` — конфиги сборки пишутся на TypeScript.
 *
 * @module vite/plugin
 */

import type { Plugin } from 'vite';

export interface ReformerBuilderOptions {
  /**
   * Конфиг уровня запуска — путь от корня приложения. По умолчанию `.ui_builder/config.json`;
   * файла по умолчанию может не быть, названный явно обязан существовать.
   */
  readonly config?: string;
  /**
   * Каталог плагинов приложения вместо набора, который едет с билдером, — путь от корня
   * приложения. Отдаётся целиком, как каталог `--plugins` у лаунчера.
   */
  readonly plugins?: string;
  /**
   * Откуда берётся интерфейс билдера. `auto` (по умолчанию) — из исходников, когда они лежат
   * рядом с плагином, иначе из готовой сборки; `source` и `dist` называют источник явно,
   * и его отсутствие — отказ запуска. Без параметра источник может назвать переменная
   * окружения `REFORMER_BUILDER_UI` — так в монорепозитории проверяют готовую сборку,
   * не трогая конфиг приложения.
   */
  readonly ui?: 'auto' | 'source' | 'dist';
}

/** Билдер под префиксом `/__reformer-builder/` на dev-сервере приложения. */
export function reformerBuilder(options?: ReformerBuilderOptions): Plugin;
