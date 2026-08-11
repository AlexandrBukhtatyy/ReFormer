/**
 * Признак «эта code-вкладка — markdown»: от него зависит, показывать ли переключатель
 * Код/Предпросмотр/Рядом и работают ли markdown-хоткеи.
 *
 * Основной источник — `tab.language`, который проставляет `languageOf()` при открытии файла
 * (`app/save-actions`), запасной — расширение имени: язык мог не проставиться у вкладок,
 * открытых иным путём.
 *
 * @module reformer-builder/canvas/markdown/is-markdown
 */

import type { TabState } from '../../store';

/** Расширения, которые считаем markdown (`.mdx` рендерим как обычный markdown — JSX не исполняем). */
const MD_EXTENSIONS = ['.md', '.mdx', '.markdown', '.mdown', '.mkd'];

/** Markdown ли файл по имени (регистр не важен). */
export function isMarkdownName(name: string): boolean {
  const lower = name.toLowerCase();
  return MD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** Markdown ли содержимое вкладки. Для form-вкладок всегда `false` — там своя область. */
export function isMarkdownTab(tab: TabState | null | undefined): boolean {
  if (!tab || tab.kind !== 'code') return false;
  return tab.language === 'markdown' || isMarkdownName(tab.source.name);
}
