/**
 * Синглтон-стор редактора + связанные экшены. Экшены — тонкие обёртки над чистыми
 * {@link module:reformer-builder/store/reducers редьюсерами}; вся логика тестируется отдельно.
 *
 * @module reformer-builder/store/editor-store
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { JsonPath, MutationResult } from '../model';
import { createStore } from './create-store';
import * as R from './reducers';
import type { EditorState, LeftPanel, PreviewMode, TabSource, Theme } from './types';

/** Глобальный стор редактора. */
export const editorStore = createStore<EditorState>(R.initialState());

/** Экшены редактора (мутируют {@link editorStore}). */
export const editorActions = {
  openTab: (id: string, source: TabSource, schema: JsonFormSchema) =>
    editorStore.setState((s) => R.openTab(s, id, source, schema)),
  closeTab: (id: string) => editorStore.setState((s) => R.closeTab(s, id)),
  setActiveTab: (id: string) => editorStore.setState((s) => R.setActiveTab(s, id)),

  /** Применить результат мутации к активной вкладке (выделение → `newPath`). */
  commit: (result: MutationResult, opts?: { coalesceKey?: string }) =>
    editorStore.setState((s) => R.commit(s, result, opts)),

  /**
   * Вычислить и применить мутацию над схемой активной вкладки. Удобная точка входа для панелей/canvas:
   * `apply((schema) => mutate.setComponentProp(schema, path, key, value), { coalesceKey })`.
   */
  apply: (fn: (schema: JsonFormSchema) => MutationResult, opts?: { coalesceKey?: string }) =>
    editorStore.setState((s) => {
      const tab = R.activeTab(s);
      return tab ? R.commit(s, fn(tab.schema), opts) : s;
    }),

  replaceSchema: (schema: JsonFormSchema) => editorStore.setState((s) => R.replaceSchema(s, schema)),
  undo: () => editorStore.setState(R.undo),
  redo: () => editorStore.setState(R.redo),
  markSaved: () => editorStore.setState(R.markSaved),
  commitSaved: (rawText: string, lastModified?: number) =>
    editorStore.setState((s) => R.commitSaved(s, rawText, lastModified)),

  select: (path: JsonPath | null) => editorStore.setState((s) => R.select(s, path)),
  setHover: (path: JsonPath | null) => editorStore.setState((s) => R.setHover(s, path)),
  setActiveStep: (index: number) => editorStore.setState((s) => R.setActiveStep(s, index)),

  setPreview: (mode: PreviewMode) => editorStore.setState((s) => R.setPreview(s, mode)),
  toggleRawJson: () => editorStore.setState(R.toggleRawJson),
  /** Скрыть/показать `$html(div)`-контейнеры в схематике. */
  toggleHideDivWrappers: () => editorStore.setState(R.toggleHideDivWrappers),
  /** Открыть raw-JSON и перейти к строке `line` (reveal + подсветка в Monaco). */
  revealRawLine: (line: number) => editorStore.setState((s) => R.revealRawLine(s, line)),
  setLeftPanel: (panel: LeftPanel) => editorStore.setState((s) => R.setLeftPanel(s, panel)),
  toggleRight: () => editorStore.setState(R.toggleRight),
  setTheme: (theme: Theme) => editorStore.setState((s) => R.setTheme(s, theme)),
};
