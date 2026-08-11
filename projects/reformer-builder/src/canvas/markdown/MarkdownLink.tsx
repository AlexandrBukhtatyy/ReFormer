/**
 * Ссылка предпросмотра. Три поведения, как в VSCode:
 * `#якорь` — прокрутка к заголовку внутри предпросмотра (id ставит `rehype-slug`);
 * относительный путь — открытие файла проекта вкладкой билдера;
 * внешний URL — новая вкладка браузера.
 *
 * Якорь ищем внутри контейнера предпросмотра, а не по документу: slug'и из файла запросто
 * совпадут с id оболочки (например, `rb-properties`).
 *
 * @module reformer-builder/canvas/markdown/MarkdownLink
 */

import type { AnchorHTMLAttributes, MouseEvent, RefObject } from 'react';
import type { Element } from 'hast';
import { openProjectPath } from '../../app/save-actions';
import { withoutProps } from './hast-text';
import { isExternalUrl, resolveRelativePath, splitHash } from './resolve-asset';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  node?: Element;
  /** Каталог markdown-файла в проекте — точка отсчёта относительных путей. */
  baseDir: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
};

/** Прокрутить предпросмотр к элементу с таким `id` (или к якорю `<a name>` из raw-HTML). */
function scrollToAnchor(container: HTMLElement | null, id: string): void {
  if (!container) return;
  const escaped = CSS.escape(id);
  const target =
    container.querySelector<HTMLElement>(`#${escaped}`) ??
    container.querySelector<HTMLElement>(`[name="${escaped}"]`);
  target?.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

export default function MarkdownLink(props: Props) {
  const { href, children, baseDir, containerRef } = props;
  const rest = withoutProps(props, ['node', 'baseDir', 'containerRef', 'href', 'children']);
  const raw = href ?? '';
  const { path, hash } = splitHash(raw);

  // Внешняя ссылка (кроме чистого якоря) — обычное поведение браузера, в новой вкладке.
  if (!raw || (isExternalUrl(raw) && !raw.startsWith('#'))) {
    return (
      <a {...rest} href={raw || undefined} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }

  const projectPath = path && baseDir != null ? resolveRelativePath(baseDir, path) : null;

  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Модификаторы оставляем браузеру: «открыть в новой вкладке» должно работать как обычно.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (!path) {
      if (hash) scrollToAnchor(containerRef.current, hash);
      return;
    }
    if (projectPath) void openProjectPath(projectPath);
  };

  return (
    <a {...rest} href={raw} onClick={onClick}>
      {children}
    </a>
  );
}
