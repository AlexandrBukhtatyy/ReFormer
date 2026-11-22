/**
 * Форма следующего хода — для выбора «Правит: …» над полем ввода.
 *
 * Человек должен видеть, какую форму правит ход, ДО отправки запроса: иначе переключение на другую
 * форму между ходами выглядело так, будто ассистент «пишет не туда». Форма хода — закреплённая в
 * панели, форма активной вкладки или форма файла её модуля (`AgentBridge.targetForm`); всё это
 * знает мост, и спрашивается он: разбор и поиск формы файла он запоминает.
 *
 * @module plugins/forms/ai/ui/useTargetForm
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { AgentBridge, TargetForm } from '../session/bridge';

/** Форма следующего хода или `null`: ход спросит, с какой работать, или создаст новую. */
export function useTargetForm(
  bridge: Pick<AgentBridge, 'targetForm' | 'onDidChangeTarget'>
): TargetForm | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const subscription = bridge.onDidChangeTarget(onChange);
      return () => {
        subscription.dispose();
      };
    },
    [bridge]
  );
  const read = useCallback(() => bridge.targetForm(), [bridge]);
  return useSyncExternalStore(subscribe, read);
}
