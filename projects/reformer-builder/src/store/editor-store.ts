/**
 * Синглтон-стор редактора + связанные экшены. Экшены — тонкие обёртки над чистыми
 * {@link module:reformer-builder/store/reducers редьюсерами}; вся логика тестируется отдельно.
 *
 * @module reformer-builder/store/editor-store
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import type { JsonPath, MutationResult, NavDir } from '../model';
import { createStore } from './create-store';
import * as R from './reducers';
import type {
  BottomTab,
  EditorState,
  LeftPanel,
  MockSection,
  PreviewMode,
  TabSource,
  Theme,
} from './types';

/** Глобальный стор редактора. */
export const editorStore = createStore<EditorState>(R.initialState());

/** Экшены редактора (мутируют {@link editorStore}). */
export const editorActions = {
  openTab: (id: string, source: TabSource, schema: JsonFormSchema) =>
    editorStore.setState((s) => R.openTab(s, id, source, schema)),
  /** Открыть произвольный файл на редактирование в Monaco (code-вкладка). */
  openCodeTab: (id: string, source: TabSource, text: string, language: string) =>
    editorStore.setState((s) => R.openCodeTab(s, id, source, text, language)),
  /** Правка текста code-вкладки (Monaco onChange). */
  setTabText: (id: string, text: string) => editorStore.setState((s) => R.setTabText(s, id, text)),
  /** Правка секции мок-данных вкладки (нижняя панель: «Модель» / «Registry»). */
  setMockText: (id: string, section: MockSection, text: string) =>
    editorStore.setState((s) => R.setMockText(s, id, section, text)),
  /** Сбросить секцию мок-данных вкладки к синтезу из схемы. */
  resetMock: (id: string, section: MockSection) =>
    editorStore.setState((s) => R.resetMock(s, id, section)),
  /** Отметить сохранённым текст активной code-вкладки. */
  markCodeSaved: () => editorStore.setState(R.markCodeSaved),
  closeTab: (id: string) => editorStore.setState((s) => R.closeTab(s, id)),
  /** «Закрыть остальные»: оставить только вкладку `id`. */
  closeOtherTabs: (id: string) => editorStore.setState((s) => R.closeOtherTabs(s, id)),
  /** «Закрыть слева»: закрыть все вкладки левее `id`. */
  closeTabsToLeft: (id: string) => editorStore.setState((s) => R.closeTabsToLeft(s, id)),
  /** «Закрыть справа»: закрыть все вкладки правее `id`. */
  closeTabsToRight: (id: string) => editorStore.setState((s) => R.closeTabsToRight(s, id)),
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

  replaceSchema: (schema: JsonFormSchema) =>
    editorStore.setState((s) => R.replaceSchema(s, schema)),
  undo: () => editorStore.setState(R.undo),
  redo: () => editorStore.setState(R.redo),
  markSaved: () => editorStore.setState(R.markSaved),
  commitSaved: (rawText: string, lastModified?: number) =>
    editorStore.setState((s) => R.commitSaved(s, rawText, lastModified)),

  select: (path: JsonPath | null) => editorStore.setState((s) => R.select(s, path)),
  setHover: (path: JsonPath | null) => editorStore.setState((s) => R.setHover(s, path)),
  setActiveStep: (index: number) => editorStore.setState((s) => R.setActiveStep(s, index)),

  // ── горячие клавиши canvas ──
  /**
   * Навигация выделения (стрелки); направление проецируется на ось раскладки родителя — в
   * контейнере-ряду по соседям ходят ←→. `extend` — Shift-расширение диапазона вдоль оси.
   */
  navigate: (dir: NavDir, extend?: boolean) =>
    editorStore.setState((s) => R.navigate(s, dir, extend)),
  /** Переместить выделение (⌘/Ctrl+стрелки): вдоль оси раскладки — реордер, поперёк — вынести/внести. */
  moveSelection: (dir: NavDir) => editorStore.setState((s) => R.moveSelection(s, dir)),
  /** Удалить выделение (Delete/Backspace). */
  deleteSelection: () => editorStore.setState(R.deleteSelection),
  /** Дублировать выделение: без `dir` (⌘/Ctrl+D) — следом, с ⇧⌥+стрелка — до/после вдоль оси раскладки. */
  duplicateSelection: (dir?: NavDir) => editorStore.setState((s) => R.duplicateSelection(s, dir)),
  /** Esc: схлопнуть мульти-выделение / подняться к родителю. */
  collapseSelection: () => editorStore.setState(R.collapseSelection),
  /** ⌘/Ctrl+G: сгруппировать выделенные смежные поля в новый div. */
  groupSelection: () => editorStore.setState(R.groupSelection),
  /** ⌘/Ctrl+Shift+G: разгруппировать выделенный div. */
  ungroupSelection: () => editorStore.setState(R.ungroupSelection),
  /** ⌘/Ctrl+Shift+L: сменить раскладку выделенного div (вертикально ⇄ горизонтально). */
  flipSelection: () => editorStore.setState(R.flipSelection),
  /** Shift+ЛКМ: расширить смежный диапазон выделения до узла. */
  extendSelectionTo: (path: JsonPath) => editorStore.setState((s) => R.extendSelectionTo(s, path)),
  /** ⌘/Ctrl+ЛКМ: тоггл узла в выделении (несмежно). */
  toggleSelectionAt: (path: JsonPath) => editorStore.setState((s) => R.toggleSelectionAt(s, path)),

  setPreview: (mode: PreviewMode) => editorStore.setState((s) => R.setPreview(s, mode)),
  toggleRawJson: () => editorStore.setState(R.toggleRawJson),
  /** Переключить активную вкладку нижней панели (JSON схемы / мок-данные). */
  setBottomTab: (t: BottomTab) => editorStore.setState((s) => R.setBottomTab(s, t)),
  /** Скрыть/показать `$html(div)`-контейнеры в схематике. */
  toggleHideDivWrappers: () => editorStore.setState(R.toggleHideDivWrappers),
  /** Открыть модалку быстрого добавления компонента (Enter). */
  openQuickAdd: () => editorStore.setState((s) => R.setQuickAdd(s, true)),
  /** Закрыть модалку быстрого добавления. */
  closeQuickAdd: () => editorStore.setState((s) => R.setQuickAdd(s, false)),
  /** Вставить компонент умно по контексту (из модалки быстрого добавления). */
  addComponent: (node: JsonNode) => editorStore.setState((s) => R.addComponent(s, node)),
  /** Открыть raw-JSON и перейти к строке `line` (reveal + подсветка в Monaco). */
  revealRawLine: (line: number) => editorStore.setState((s) => R.revealRawLine(s, line)),
  setLeftPanel: (panel: LeftPanel) => editorStore.setState((s) => R.setLeftPanel(s, panel)),
  /** ⌘B: свернуть/развернуть левый сайдбар (восстанавливает последнюю панель). */
  toggleLeftPanel: () => editorStore.setState(R.toggleLeftPanel),
  toggleRight: () => editorStore.setState(R.toggleRight),
  setTheme: (theme: Theme) => editorStore.setState((s) => R.setTheme(s, theme)),
};
