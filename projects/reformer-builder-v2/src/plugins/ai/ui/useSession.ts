/**
 * Подписка панели на состояние сессии ассистента.
 *
 * `useSyncExternalStore`, а не собственный `useState` с подпиской: снимок сессии стабилен по
 * ссылке между изменениями, и React вправе на это рассчитывать. Серверного снимка нет —
 * приложение целиком клиентское, поэтому третий аргумент повторяет второй.
 *
 * @module plugins/ai/ui/useSession
 */

import { useSyncExternalStore } from 'react';
import type { AiSession, AiSessionState } from '../session/session';

/** Текущее состояние сессии. */
export function useAiSession(session: AiSession): AiSessionState {
  return useSyncExternalStore(
    (listener) => {
      const subscription = session.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    () => session.get(),
    () => session.get()
  );
}
