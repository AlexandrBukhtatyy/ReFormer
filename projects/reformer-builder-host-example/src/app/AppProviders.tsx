import type { ReactNode } from 'react';
import { NotificationsViewport } from '../notifications/NotificationsViewport';

/**
 * Всё, что приложение даёт любой своей странице: здесь — уведомления.
 *
 * Билдер стоит внутри (см. `main.tsx`), поэтому и форма в его превью получает то же самое:
 * отправленная там форма показывает уведомление приложения, а не билдера.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <NotificationsViewport />
    </>
  );
}
