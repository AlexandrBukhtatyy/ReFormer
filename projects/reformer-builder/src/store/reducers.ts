/**
 * Чистые переходы состояния редактора (без React/стора) — тестируются напрямую. Древовидные
 * мутации делегируются `model/mutate` через {@link MutationResult}; здесь — вкладки, история,
 * выделение, dirty, UI. Выделение «следует» за узлом: `commit` берёт `newPath` из результата.
 *
 * @module reformer-builder/store/reducers
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { JsonPath, MutationResult } from '../model';
import type {
  EditorState,
  HistorySnapshot,
  LeftPanel,
  PreviewMode,
  TabSource,
  TabState,
  Theme,
  UiState,
} from './types';

/** Максимум снимков в истории (снимки дёшевы из-за structural sharing, но ограничиваем). */
export const HISTORY_CAP = 100;

/** Начальные UI-флаги. */
export function initialUi(): UiState {
  return {
    preview: 'wire',
    hideDivWrappers: false,
    rawJsonOpen: true,
    leftPanel: 'palette',
    rightOpen: true,
    theme: 'light',
    revealLine: null,
    revealNonce: 0,
  };
}

/** Пустое состояние редактора. */
export function initialState(): EditorState {
  return { tabs: {}, order: [], activeTabId: null, ui: initialUi() };
}

/** Новая вкладка (без истории, не dirty: `savedSchema === schema`). */
export function makeTab(id: string, source: TabSource, schema: JsonFormSchema): TabState {
  return {
    id,
    source,
    schema,
    savedSchema: schema,
    past: [],
    future: [],
    selectionPath: ['root'],
    hoverPath: null,
    activeStep: 0,
    lastCoalesceKey: null,
  };
}

// ── вкладки ────────────────────────────────────────────────────────────────

/** Открыть вкладку (или активировать уже открытую с тем же id). */
export function openTab(
  state: EditorState,
  id: string,
  source: TabSource,
  schema: JsonFormSchema
): EditorState {
  if (state.tabs[id]) return { ...state, activeTabId: id };
  return {
    ...state,
    tabs: { ...state.tabs, [id]: makeTab(id, source, schema) },
    order: [...state.order, id],
    activeTabId: id,
  };
}

/** Закрыть вкладку; активной становится соседняя. */
export function closeTab(state: EditorState, id: string): EditorState {
  if (!state.tabs[id]) return state;
  const tabs = { ...state.tabs };
  delete tabs[id];
  const order = state.order.filter((x) => x !== id);
  let activeTabId = state.activeTabId;
  if (activeTabId === id) {
    const idx = state.order.indexOf(id);
    activeTabId = order[Math.min(idx, order.length - 1)] ?? null;
  }
  return { ...state, tabs, order, activeTabId };
}

/** Сделать вкладку активной. */
export function setActiveTab(state: EditorState, id: string): EditorState {
  return state.tabs[id] ? { ...state, activeTabId: id } : state;
}

// ── активная вкладка: helper ─────────────────────────────────────────────────

function updateActiveTab(state: EditorState, fn: (tab: TabState) => TabState): EditorState {
  const id = state.activeTabId;
  if (!id || !state.tabs[id]) return state;
  const nextTab = fn(state.tabs[id]);
  if (nextTab === state.tabs[id]) return state;
  return { ...state, tabs: { ...state.tabs, [id]: nextTab } };
}

function pushHistory(
  tab: TabState,
  next: { schema: JsonFormSchema; selectionPath: JsonPath | null },
  coalesceKey?: string
): TabState {
  const coalesce = coalesceKey != null && coalesceKey === tab.lastCoalesceKey;
  const snap: HistorySnapshot = { schema: tab.schema, selectionPath: tab.selectionPath };
  const past = coalesce ? tab.past : [...tab.past, snap].slice(-HISTORY_CAP);
  return {
    ...tab,
    schema: next.schema,
    selectionPath: next.selectionPath,
    past,
    future: [],
    lastCoalesceKey: coalesceKey ?? null,
  };
}

// ── правки схемы ─────────────────────────────────────────────────────────────

/**
 * Применить результат мутации к активной вкладке: снимок в историю, новая схема, выделение → `newPath`.
 * `coalesceKey` схлопывает серию (например, ввод в одно текстовое поле) в одну запись истории.
 */
export function commit(
  state: EditorState,
  result: MutationResult,
  opts?: { coalesceKey?: string }
): EditorState {
  return updateActiveTab(state, (tab) =>
    pushHistory(tab, { schema: result.schema, selectionPath: result.newPath }, opts?.coalesceKey)
  );
}

/** Заменить схему целиком (коммит из raw-JSON): снимок в историю, выделение сохраняется. */
export function replaceSchema(state: EditorState, schema: JsonFormSchema): EditorState {
  return updateActiveTab(state, (tab) =>
    pushHistory(tab, { schema, selectionPath: tab.selectionPath })
  );
}

/** Отменить последнюю правку активной вкладки. */
export function undo(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    if (!tab.past.length) return tab;
    const prev = tab.past[tab.past.length - 1];
    const current: HistorySnapshot = { schema: tab.schema, selectionPath: tab.selectionPath };
    return {
      ...tab,
      schema: prev.schema,
      selectionPath: prev.selectionPath,
      past: tab.past.slice(0, -1),
      future: [current, ...tab.future],
      lastCoalesceKey: null,
    };
  });
}

/** Повторить отменённую правку. */
export function redo(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    if (!tab.future.length) return tab;
    const nextSnap = tab.future[0];
    const current: HistorySnapshot = { schema: tab.schema, selectionPath: tab.selectionPath };
    return {
      ...tab,
      schema: nextSnap.schema,
      selectionPath: nextSnap.selectionPath,
      past: [...tab.past, current].slice(-HISTORY_CAP),
      future: tab.future.slice(1),
      lastCoalesceKey: null,
    };
  });
}

/** Пометить активную вкладку сохранённой (dirty=false): baseline = текущая схема. */
export function markSaved(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => ({ ...tab, savedSchema: tab.schema }));
}

/**
 * Зафиксировать сохранение в файл (Mode B): baseline-схема = текущая, обновить `rawText` и
 * `lastModified` источника (сброс dirty + актуальная база для diff/конфликтов).
 */
export function commitSaved(
  state: EditorState,
  rawText: string,
  lastModified?: number
): EditorState {
  return updateActiveTab(state, (tab) => ({
    ...tab,
    savedSchema: tab.schema,
    source: {
      ...tab.source,
      rawText,
      lastModified: lastModified ?? tab.source.lastModified,
    },
  }));
}

// ── выделение / навигация ─────────────────────────────────────────────────────

export function select(state: EditorState, path: JsonPath | null): EditorState {
  return updateActiveTab(state, (tab) => ({ ...tab, selectionPath: path }));
}

export function setHover(state: EditorState, path: JsonPath | null): EditorState {
  return updateActiveTab(state, (tab) => ({ ...tab, hoverPath: path }));
}

export function setActiveStep(state: EditorState, index: number): EditorState {
  return updateActiveTab(state, (tab) => ({ ...tab, activeStep: index }));
}

// ── UI ───────────────────────────────────────────────────────────────────────

export function setPreview(state: EditorState, preview: PreviewMode): EditorState {
  return { ...state, ui: { ...state.ui, preview } };
}
export function toggleRawJson(state: EditorState): EditorState {
  return { ...state, ui: { ...state.ui, rawJsonOpen: !state.ui.rawJsonOpen } };
}
/** Переключить скрытие `$html(div)`-контейнеров в схематике. */
export function toggleHideDivWrappers(state: EditorState): EditorState {
  return { ...state, ui: { ...state.ui, hideDivWrappers: !state.ui.hideDivWrappers } };
}
/** Открыть raw-JSON и запросить reveal строки `line` (1-based). Nonce++ — повтор той же строки сработает. */
export function revealRawLine(state: EditorState, line: number): EditorState {
  return {
    ...state,
    ui: { ...state.ui, rawJsonOpen: true, revealLine: line, revealNonce: state.ui.revealNonce + 1 },
  };
}
export function setLeftPanel(state: EditorState, leftPanel: LeftPanel): EditorState {
  return { ...state, ui: { ...state.ui, leftPanel } };
}
export function toggleRight(state: EditorState): EditorState {
  return { ...state, ui: { ...state.ui, rightOpen: !state.ui.rightOpen } };
}
export function setTheme(state: EditorState, theme: Theme): EditorState {
  return { ...state, ui: { ...state.ui, theme } };
}

// ── селекторы ─────────────────────────────────────────────────────────────────

export function activeTab(state: EditorState): TabState | null {
  return state.activeTabId ? (state.tabs[state.activeTabId] ?? null) : null;
}

/** Dirty активной вкладки: схема разошлась с baseline (сравнение по ссылке — иммутабельность). */
export function isDirty(tab: TabState): boolean {
  return tab.schema !== tab.savedSchema;
}
