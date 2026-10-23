/**
 * Форма активной вкладки — для подписи «Правит: …» над полем ввода.
 *
 * Ход правит форму активной вкладки, и человек должен видеть, какую, ДО отправки запроса: иначе
 * переключение на другую форму между ходами выглядело так, будто ассистент «пишет не туда».
 *
 * Формой считается документ, за который берётся стек форм и в тексте которого он узнаёт свою
 * форму, — то же условие, по которому ход берётся за вкладку. Спрашивается мост: он знает стеки, а
 * разбор запоминает по тексту — панель перерисовывается на каждый кусок ответа модели.
 *
 * @module plugins/reformer/ai/ui/useActiveForm
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { AiHost } from '../host';
import type { AgentBridge } from '../session/bridge';

/** Путь формы активной вкладки от корня проекта или `null`: вкладки нет, или в ней не форма. */
export function useActiveForm(
  host: AiHost,
  bridge: Pick<AgentBridge, 'activeForm'>
): string | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = host.onDidChangeActive?.(onChange);
      return () => {
        subscription?.dispose();
      };
    },
    [host]
  );
  const read = useCallback(() => bridge.activeForm(), [bridge]);
  return useSyncExternalStore(subscribe, read);
}
