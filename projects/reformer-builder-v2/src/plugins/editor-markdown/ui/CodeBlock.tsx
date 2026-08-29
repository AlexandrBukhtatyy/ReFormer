/**
 * Блок кода в предпросмотре: подсветка без единой связи с редактором.
 *
 * ## Почему не Monaco
 *
 * В v1 блоки красил `monaco.editor.colorize`, и это стоило предпросмотру зависимости
 * от редактора: в v2 такая зависимость невыразима вовсе (`plugins/**` не импортируют друг
 * друга), а тянуть её портом значило бы, что markdown не показывается, пока не поднят
 * редактор кода. Здесь подсветка своя и грузится ЛЕНИВО — чанк с грамматиками появляется
 * при первом блоке кода, а документ без кода за него не платит.
 *
 * ## Разметка приходит от подсветчика, и это безопасно
 *
 * `highlight.js` экранирует исходный текст сам — на выходе только его собственные `<span>`
 * с классами. Это единственное место предпросмотра, где HTML вставляется без санитайзера,
 * и оно допустимо ровно потому, что источник разметки — не файл, а библиотека, которой
 * файл отдан как ТЕКСТ.
 *
 * @module plugins/editor-markdown/ui/CodeBlock
 */

import { useEffect, useState, type ReactElement } from 'react';

/** Подсветчик в объёме, который здесь нужен. Тип свой — модуль грузится динамически. */
interface Highlighter {
  getLanguage(name: string): unknown;
  highlight(code: string, options: { language: string }): { value: string };
}

/**
 * Общий промис загрузки: блоков в документе десятки, а грамматики нужны одни.
 *
 * `common` вместо полного набора — это сорок популярных языков вместо двухсот; всё, чего
 * в нём нет, останется без подсветки, и это правильный размен для документации проекта форм.
 */
let highlighter: Promise<Highlighter> | null = null;

function loadHighlighter(): Promise<Highlighter> {
  highlighter ??= import('highlight.js/lib/common').then(
    (module) => module.default as unknown as Highlighter
  );
  return highlighter;
}

export interface CodeBlockProps {
  readonly code: string;
  /** Имя грамматики или `null` — тогда блок остаётся моноширинным без цвета. */
  readonly language: string | null;
}

export function CodeBlock({ code, language }: CodeBlockProps): ReactElement {
  /** Готовая подсветка вместе с тем, ДЛЯ ЧЕГО она посчитана. */
  const [highlighted, setHighlighted] = useState<{
    code: string;
    language: string;
    html: string;
  } | null>(null);

  useEffect(() => {
    if (language === null) return;
    let alive = true;
    void loadHighlighter()
      .then((hljs) => {
        // Язык мог не оказаться в наборе: тогда блок остаётся без подсветки, а не пустым.
        if (!alive || hljs.getLanguage(language) === undefined) return;
        setHighlighted({ code, language, html: hljs.highlight(code, { language }).value });
      })
      .catch((error: unknown) => {
        // Подсветка — украшение. Её отказ не должен уносить с собой текст блока.
        console.error('[markdown] подсветка блока кода не загрузилась', error);
      });
    return () => {
      alive = false;
    };
  }, [code, language]);

  // Показываем подсветку, только если она посчитана для ЭТОГО текста и языка. Так сброс
  // не требует отдельной записи состояния в эффекте: устаревший результат просто не подходит.
  const html =
    highlighted !== null && highlighted.code === code && highlighted.language === language
      ? highlighted.html
      : null;

  return (
    <pre className="bg-muted/60 overflow-x-auto rounded-md border p-3 text-[12.5px] leading-relaxed">
      <code
        className={language === null ? 'hljs' : `hljs language-${language}`}
        {...(html === null ? { children: code } : { dangerouslySetInnerHTML: { __html: html } })}
      />
    </pre>
  );
}
