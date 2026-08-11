/**
 * Предпросмотр markdown-файла (в стиле VSCode): GFM-рендер текста code-вкладки в React-дерево.
 * Тяжёлая часть (`react-markdown` + micromark) грузится ЛЕНИВО из {@link CodeArea}, как и Monaco.
 *
 * Что здесь важно и неочевидно:
 * — порядок rehype-плагинов: `rehype-raw` раскрывает HTML из файла, дальше НАШ `rehypeSourceLine`
 *   (ему нужны позиции исходника), затем `rehype-slug` (якоря) и только потом санитайзер;
 * — санитайзер обязателен, потому что HTML в файле чужой (см. `markdown/sanitize-schema`);
 * — `useDeferredValue`: перепарсивание документа не должно тормозить ввод в редакторе слева.
 *
 * @module reformer-builder/canvas/MarkdownPreview
 */

import { useDeferredValue, useEffect, useMemo, type RefObject } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import type { PluggableList } from 'unified';
import { splitPath } from '../io/fs-ops';
import { AssetCache } from './markdown/assets';
import CodeBlock from './markdown/CodeBlock';
import MarkdownImage from './markdown/MarkdownImage';
import MarkdownLink from './markdown/MarkdownLink';
import { rehypeSourceLine } from './markdown/rehype-source-line';
import { sanitizeSchema } from './markdown/sanitize-schema';

const REMARK_PLUGINS: PluggableList = [remarkGfm];
const REHYPE_PLUGINS: PluggableList = [
  rehypeRaw,
  rehypeSourceLine,
  rehypeSlug,
  [rehypeSanitize, sanitizeSchema],
];

export default function MarkdownPreview({
  text,
  docPath,
  dark,
  containerRef,
  contentRef,
}: {
  text: string;
  /** Путь markdown-файла в проекте — от него считаются относительные ссылки и картинки. */
  docPath?: string;
  dark: boolean;
  /** Скролл-контейнер (синхроскролл и переход по якорям работают с ним). */
  containerRef: RefObject<HTMLDivElement | null>;
  /** Обёртка содержимого — за её высотой следит ResizeObserver синхроскролла. */
  contentRef?: RefObject<HTMLDivElement | null>;
}) {
  const deferred = useDeferredValue(text);
  const baseDir = docPath == null ? null : splitPath(docPath).dirPath;

  // Один кэш blob-URL на документ: при смене файла старые URL освобождает эффект ниже.
  const assets = useMemo(() => new AssetCache(baseDir), [baseDir]);
  useEffect(() => () => assets.dispose(), [assets]);

  const components = useMemo<Components>(
    () => ({
      pre: (props) => <CodeBlock {...props} dark={dark} />,
      a: (props) => <MarkdownLink {...props} baseDir={baseDir} containerRef={containerRef} />,
      img: (props) => <MarkdownImage {...props} assets={assets} />,
    }),
    [assets, baseDir, containerRef, dark]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-rb-md-preview
      className="h-full overflow-auto bg-background outline-none"
    >
      <div ref={contentRef} className="rb-md prose prose-sm max-w-none px-8 py-6">
        <Markdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          components={components}
        >
          {deferred}
        </Markdown>
      </div>
    </div>
  );
}
