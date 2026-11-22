/**
 * Типы раздачи каталога плагинов приложения (`plugins-serve.mjs`).
 *
 * @module bin/plugins-serve
 */

import type { RevisionMemo } from './plugins-index.mjs';

export interface ServePluginsOptions {
  /** Каталог плагинов без хвостового разделителя. */
  dir: string;
  /** Каталоги плагинов, которые отдаются; без списка — весь каталог. */
  include?: readonly string[];
  /** Память отпечатков живого каталога: с ней индекс несёт ревизии плагинов. */
  revisions?: RevisionMemo;
  /** Названные, но не собранные плагины — на каждый запрос индекса. */
  onMissing?: (plugins: readonly string[]) => void;
}

/** Адрес каталога плагинов приложения, со слэшами по краям. */
export const PLUGINS_URL_PREFIX: string;

/** Отвечает на запрос внутри каталога плагинов: индекс на лету либо файл. */
export function servePluginsDir(
  req: unknown,
  res: unknown,
  inside: string,
  options: ServePluginsOptions
): Promise<void>;
