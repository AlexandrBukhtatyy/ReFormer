/**
 * Навигация приложения: страницы меняются без загрузки документа.
 *
 * Своя, в три десятка строк: образцу хватает адреса и ссылки, а библиотека маршрутизации
 * заслонила бы то, ради чего он написан.
 *
 * @module app/router
 */

import { useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';

const NAVIGATION_EVENT = 'app:navigate';

function subscribe(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener(NAVIGATION_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener(NAVIGATION_EVENT, listener);
  };
}

const currentPath = (): string => window.location.pathname;

/** Путь открытой страницы; компонент перерисуется при переходе. */
export function usePathname(): string {
  return useSyncExternalStore(subscribe, currentPath);
}

export function navigate(path: string): void {
  if (path === window.location.pathname) return;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

interface LinkProps {
  readonly to: string;
  readonly className?: string;
  readonly children: ReactNode;
}

export function Link({ to, className, children }: LinkProps) {
  const follow = (event: MouseEvent<HTMLAnchorElement>): void => {
    // Сочетания с клавишами и средняя кнопка — «открыть в новой вкладке»: это дело браузера.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} className={className} onClick={follow}>
      {children}
    </a>
  );
}
