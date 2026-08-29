/**
 * Рендер markdown: GFM, чужой HTML через санитайзер, картинки и ссылки проекта.
 *
 * ## Порядок плагинов rehype здесь несущий
 *
 * `rehype-raw` раскрывает HTML из файла, `rehype-slug` расставляет якоря, и только потом
 * работает санитайзер. Поменять местами последние два — значит потерять якоря (санитайзер
 * не знает, какие идентификаторы законны); поставить санитайзер первым — значит санировать
 * то, чего ещё нет, потому что HTML на этот момент лежит текстом.
 *
 * ## Почему `useDeferredValue`
 *
 * В режиме «рядом» человек печатает слева, а разбор документа идёт справа. Разбор markdown
 * на большом файле занимает десятки миллисекунд, и без отложенного значения он выполнялся бы
 * в том же кадре, что и нажатие клавиши, — то есть съедал бы отклик ввода.
 *
 * @module plugins/editor-markdown/ui/MarkdownPreview
 */

import { useDeferredValue, useEffect, useMemo, type ReactElement, type RefObject } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import type { PluggableList } from 'unified';
import type { ResourceId } from '@/sdk';
import { createAssetCache } from '../assets';
import type { MarkdownDocument, MarkdownHost } from '../host';
import { directoryOf, fenceLanguageFromClass } from '../markdown';
import { sanitizeSchema } from '../sanitize';
import { CodeBlock } from './CodeBlock';
import { MarkdownImage } from './MarkdownImage';
import { MarkdownLink } from './MarkdownLink';

const REMARK_PLUGINS: PluggableList = [remarkGfm];
const REHYPE_PLUGINS: PluggableList = [rehypeRaw, rehypeSlug, [rehypeSanitize, sanitizeSchema]];

export interface MarkdownPreviewProps {
  readonly host: MarkdownHost;
  readonly document: MarkdownDocument;
  readonly text: string;
  /** Контейнер прокрутки: в нём же ищутся якоря ссылок. */
  readonly containerRef: RefObject<HTMLDivElement | null>;
}

/** Текст блока кода из детей `<pre>`: react-markdown отдаёт их узлом, а подсветке нужен текст. */
function codeTextOf(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(codeTextOf).join('');
  if (typeof node === 'object' && node !== null) {
    const props = (node as { props?: { children?: unknown } }).props;
    if (props !== undefined) return codeTextOf(props.children);
  }
  return '';
}

export function MarkdownPreview({
  host,
  document,
  text,
  containerRef,
}: MarkdownPreviewProps): ReactElement {
  const deferred = useDeferredValue(text);
  const baseDir = directoryOf(document.ref.path);

  // Один кэш ссылок на документ: при смене файла старые освобождает эффект ниже.
  const assets = useMemo(() => createAssetCache({ host, document }), [host, document]);
  useEffect(() => () => assets.dispose(), [assets]);

  const components = useMemo<Components>(
    () => ({
      pre: (props) => {
        // Язык объявлен на вложенном `<code>` классом `language-*`; сам `<pre>` его не несёт.
        const child = props.children as { props?: { className?: string } } | undefined;
        return (
          <CodeBlock
            code={codeTextOf(props.children).replace(/\n$/, '')}
            language={fenceLanguageFromClass(child?.props?.className)}
          />
        );
      },
      a: (props) => (
        <MarkdownLink
          {...props}
          baseDir={baseDir}
          container={containerRef}
          resolve={(projectPath: string): ResourceId => host.resourceAt(document, projectPath)}
          open={host.openResource?.bind(host)}
        />
      ),
      img: (props) => <MarkdownImage {...props} assets={assets} />,
    }),
    [assets, baseDir, containerRef, document, host]
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      data-testid="markdown-preview"
      className="bg-background h-full overflow-auto outline-none"
    >
      <div className="prose prose-sm dark:prose-invert max-w-none px-8 py-6">
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
