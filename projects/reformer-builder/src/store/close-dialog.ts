/**
 * Состояние модалки подтверждения закрытия вкладок. Открывается, только когда среди закрываемых
 * есть черновики с несохранёнными правками: у них нет файла на диске, поэтому закрытие удаляет
 * единственную (локальную) копию безвозвратно.
 *
 * @module reformer-builder/store/close-dialog
 */

import { useSyncExternalStore } from 'react';
import { createStore } from './create-store';

/** Команда закрытия из таб-бара — интерпретируется `app/close-actions`. */
export type CloseIntent =
  | { kind: 'one'; id: string }
  | { kind: 'others'; id: string }
  | { kind: 'left'; id: string }
  | { kind: 'right'; id: string };

/** Запрос на подтверждение: что закрываем и какие копии при этом теряются. */
export interface ClosePending {
  intent: CloseIntent;
  /** Сколько вкладок закроется всего (включая безопасные). */
  total: number;
  /** Черновики с несохранёнными правками — их локальные копии удалятся. */
  drafts: Array<{ id: string; name: string }>;
}

export interface CloseDialogState {
  pending: ClosePending | null;
}

export const closeDialogStore = createStore<CloseDialogState>({ pending: null });

export const closeDialogActions = {
  open: (pending: ClosePending) => closeDialogStore.setState({ pending }),
  close: () => closeDialogStore.setState({ pending: null }),
};

export function useCloseDialog(): CloseDialogState {
  return useSyncExternalStore(
    closeDialogStore.subscribe,
    () => closeDialogStore.getState(),
    () => closeDialogStore.getState()
  );
}
