/**
 * Слой `store/` — состояние редактора: вкладки с per-tab state, история снимков, выделение,
 * dirty, UI-флаги. Dependency-free снапшот-стор на `useSyncExternalStore`. Логика — чистые
 * редьюсеры (`reducers.ts`), связывание с React — `hooks.ts`.
 *
 * @module reformer-builder/store
 */

export * from './types';
export { createStore, type Store } from './create-store';
export { editorStore, editorActions } from './editor-store';
export {
  useEditor,
  useActiveTab,
  useUi,
  useSelectionPath,
  useSelectionPaths,
  useTabOrder,
  useActiveTabId,
  useTab,
} from './hooks';
export { activeTab, isDirty, isDraft, initialState, HISTORY_CAP } from './reducers';
export { startDraftSync, dropDraft, draftsDelta, toRecord, toTab } from './drafts';
