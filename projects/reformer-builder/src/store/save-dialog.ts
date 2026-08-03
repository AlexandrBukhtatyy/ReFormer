/**
 * Состояние diff-модалки сохранения (спека §7.3). Держит текущий {@link SavePlan} и флаг записи.
 *
 * @module reformer-builder/store/save-dialog
 */

import { useSyncExternalStore } from 'react';
import type { SavePlan } from '../io/save';
import { createStore } from './create-store';

export interface SaveDialogState {
  plan: SavePlan | null;
  saving: boolean;
}

export const saveDialogStore = createStore<SaveDialogState>({ plan: null, saving: false });

export const saveDialogActions = {
  open: (plan: SavePlan) => saveDialogStore.setState({ plan, saving: false }),
  close: () => saveDialogStore.setState({ plan: null, saving: false }),
  setSaving: (saving: boolean) => saveDialogStore.setState((s) => ({ ...s, saving })),
};

export function useSaveDialog(): SaveDialogState {
  return useSyncExternalStore(
    saveDialogStore.subscribe,
    () => saveDialogStore.getState(),
    () => saveDialogStore.getState()
  );
}
