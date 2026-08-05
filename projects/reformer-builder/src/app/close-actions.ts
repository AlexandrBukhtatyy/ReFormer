/**
 * Закрытие вкладок с защитой черновиков. У вкладки без файла в проекте единственная копия —
 * локальная (IndexedDB), и закрытие удаляет её безвозвратно. Поэтому команды таб-бара идут не
 * напрямую в стор, а через `requestClose`: если под закрытие попадают черновики с несохранёнными
 * правками — сперва модалка подтверждения ({@link module:reformer-builder/canvas/CloseTabDialog}),
 * иначе закрываем сразу.
 *
 * @module reformer-builder/app/close-actions
 */

import { dropDraft, editorActions, editorStore, isDirty, isDraft } from '../store';
import type { EditorState } from '../store';
import { closeDialogActions, type CloseIntent } from '../store/close-dialog';

/** Какие вкладки закроет команда (в порядке таб-бара). */
export function closingTabs(state: EditorState, intent: CloseIntent): string[] {
  const idx = state.order.indexOf(intent.id);
  if (idx < 0) return [];
  switch (intent.kind) {
    case 'one':
      return [intent.id];
    case 'others':
      return state.order.filter((x) => x !== intent.id);
    case 'left':
      return state.order.slice(0, idx);
    case 'right':
      return state.order.slice(idx + 1);
  }
}

/**
 * Черновики среди закрываемых, у которых есть несохранённые правки, — только они требуют
 * подтверждения. Нетронутый черновик закрываем молча: терять в нём нечего.
 */
export function losingDrafts(
  state: EditorState,
  ids: string[]
): Array<{ id: string; name: string }> {
  const out: Array<{ id: string; name: string }> = [];
  for (const id of ids) {
    const tab = state.tabs[id];
    if (tab && isDraft(tab) && isDirty(tab)) out.push({ id, name: tab.source.name });
  }
  return out;
}

/** Выполнить закрытие: убрать вкладки из стора + удалить их локальные копии. */
function runClose(state: EditorState, intent: CloseIntent): void {
  for (const id of closingTabs(state, intent)) {
    const tab = state.tabs[id];
    if (tab && isDraft(tab)) void dropDraft(id);
  }
  switch (intent.kind) {
    case 'one':
      editorActions.closeTab(intent.id);
      return;
    case 'others':
      editorActions.closeOtherTabs(intent.id);
      return;
    case 'left':
      editorActions.closeTabsToLeft(intent.id);
      return;
    case 'right':
      editorActions.closeTabsToRight(intent.id);
  }
}

/** Запросить закрытие: подтверждение при потере черновиков, иначе — сразу. */
export function requestClose(intent: CloseIntent): void {
  const state = editorStore.getState();
  const ids = closingTabs(state, intent);
  if (!ids.length) return;
  const drafts = losingDrafts(state, ids);
  if (!drafts.length) {
    runClose(state, intent);
    return;
  }
  closeDialogActions.open({ intent, total: ids.length, drafts });
}

/** Подтверждение из модалки — закрыть вместе с локальными копиями. */
export function confirmClose(intent: CloseIntent): void {
  runClose(editorStore.getState(), intent);
  closeDialogActions.close();
}
