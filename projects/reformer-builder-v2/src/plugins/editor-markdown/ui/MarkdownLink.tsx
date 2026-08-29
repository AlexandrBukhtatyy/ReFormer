/**
 * Ссылка предпросмотра. Три поведения, как в редакторах, откуда пришла привычка:
 *
 * - `#якорь` — прокрутка к заголовку внутри предпросмотра (идентификатор ставит `rehype-slug`);
 * - относительный путь — открытие файла проекта вкладкой;
 * - внешний URL — новая вкладка браузера.
 *
 * Якорь ищется ВНУТРИ контейнера предпросмотра, а не по документу: slug из чужого файла
 * запросто совпадёт с идентификатором элемента оболочки, и прокрутка увела бы в интерфейс.
 *
 * @module plugins/editor-markdown/ui/MarkdownLink
 */

import type { AnchorHTMLAttributes, MouseEvent, ReactElement, RefObject } from 'react';
import type { ResourceId } from '@/sdk';
import { isExternalUrl, resolveRelativePath, splitHash } from '../markdown';
import { withoutProps } from './props';

export type MarkdownLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  readonly node?: unknown;
  /** Каталог документа: от него считаются относительные пути. */
  readonly baseDir: string;
  /** Контейнер предпросмотра — область поиска якорей. */
  readonly container: RefObject<HTMLElement | null>;
  /** Адрес ресурса по пути от корня источника. */
  readonly resolve: (projectPath: string) => ResourceId;
  /** Открыть ресурс вкладкой; отсутствует — ссылки внутри проекта остаются текстом. */
  readonly open?: (id: ResourceId) => void;
};

/** Прокручивает к якорю внутри предпросмотра. `false` — такого якоря там нет. */
function scrollToAnchor(container: HTMLElement | null, hash: string): boolean {
  if (container === null) return false;
  const target =
    container.querySelector<HTMLElement>(`#${CSS.escape(hash)}`) ??
    container.querySelector<HTMLElement>(`[name="${CSS.escape(hash)}"]`);
  if (target === null) return false;
  target.scrollIntoView({ block: 'start' });
  return true;
}

export function MarkdownLink(props: MarkdownLinkProps): ReactElement {
  const { href, children, baseDir, container, resolve, open } = props;
  const rest = withoutProps(props, [
    'node',
    'href',
    'children',
    'baseDir',
    'container',
    'resolve',
    'open',
  ]);
  const raw = typeof href === 'string' ? href : '';
  const { path, hash } = splitHash(raw);

  // Чистый якорь: прокрутка внутри своего же документа.
  if (path === '' && hash !== null) {
    return (
      <a
        {...rest}
        href={raw}
        onClick={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          scrollToAnchor(container.current, hash);
        }}
      >
        {children}
      </a>
    );
  }

  // Внешняя ссылка: браузеру. `noreferrer` обязателен — документ чужой, и открытая вкладка
  // не должна получать ссылку на окно приложения.
  if (raw === '' || isExternalUrl(raw)) {
    return (
      <a {...rest} href={raw} target="_blank" rel="noreferrer noopener">
        {children}
      </a>
    );
  }

  const projectPath = resolveRelativePath(baseDir, path);
  // Путь за пределами проекта показываем текстом: ссылка, ведущая в никуда, хуже отсутствия
  // ссылки, потому что обещает переход.
  if (projectPath === null || open === undefined) {
    return (
      <a {...rest} href={raw} onClick={(event) => event.preventDefault()}>
        {children}
      </a>
    );
  }

  return (
    <a
      {...rest}
      href={raw}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        open(resolve(projectPath));
      }}
    >
      {children}
    </a>
  );
}
