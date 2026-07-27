/**
 * Чистые переходы состояния редактора (без React/стора) — тестируются напрямую. Древовидные
 * мутации делегируются `model/mutate` через {@link MutationResult}; здесь — вкладки, история,
 * выделение, dirty, UI. Выделение «следует» за узлом: `commit` берёт `newPath` из результата.
 *
 * @module reformer-builder/store/reducers
 */

import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import { isContainerNode } from '@reformer/renderer-json';
import {
  canAcceptChildren,
  childSlots,
  duplicateNode,
  emptySchema,
  flipDirection,
  getAt,
  groupBlock,
  insertNode,
  isDivContainer,
  moveNode,
  navTarget,
  parentNodePath,
  pathEquals,
  removeIndices,
  reorderBlock,
  siblingInfo,
  ungroupNode,
  type JsonPath,
  type MutationResult,
  type NavDir,
} from '../model';
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
    quickAddOpen: false,
    rawJsonOpen: true,
    leftPanel: 'files',
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

/** Новая вкладка формы (без истории, не dirty: `savedSchema === schema`). */
export function makeTab(id: string, source: TabSource, schema: JsonFormSchema): TabState {
  return {
    id,
    source,
    kind: 'form',
    schema,
    savedSchema: schema,
    past: [],
    future: [],
    selectionPath: ['root'],
    selectionPaths: [['root']],
    anchorPath: ['root'],
    hoverPath: null,
    activeStep: 0,
    lastCoalesceKey: null,
  };
}

/**
 * Новая вкладка кода (произвольный файл в Monaco). `schema`/история/выделение не используются —
 * несут заглушку `emptySchema()`; источник истины — `text`, baseline dirty — `savedText`.
 */
export function makeCodeTab(
  id: string,
  source: TabSource,
  text: string,
  language: string
): TabState {
  const schema = emptySchema();
  return {
    id,
    source,
    kind: 'code',
    schema,
    savedSchema: schema,
    text,
    savedText: text,
    language,
    past: [],
    future: [],
    selectionPath: null,
    selectionPaths: [],
    anchorPath: null,
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

/** Открыть code-вкладку (или активировать уже открытую). */
export function openCodeTab(
  state: EditorState,
  id: string,
  source: TabSource,
  text: string,
  language: string
): EditorState {
  if (state.tabs[id]) return { ...state, activeTabId: id };
  return {
    ...state,
    tabs: { ...state.tabs, [id]: makeCodeTab(id, source, text, language) },
    order: [...state.order, id],
    activeTabId: id,
  };
}

/** Правка текста code-вкладки (Monaco onChange). Только для `kind: 'code'`. */
export function setTabText(state: EditorState, id: string, text: string): EditorState {
  const tab = state.tabs[id];
  if (!tab || tab.kind !== 'code' || tab.text === text) return state;
  return { ...state, tabs: { ...state.tabs, [id]: { ...tab, text } } };
}

/** Отметить сохранённым текст активной code-вкладки (baseline dirty). */
export function markCodeSaved(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) =>
    tab.kind === 'code' ? { ...tab, savedText: tab.text } : tab
  );
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
  next: {
    schema: JsonFormSchema;
    selectionPath: JsonPath | null;
    selectionPaths?: JsonPath[];
    anchorPath?: JsonPath | null;
  },
  coalesceKey?: string
): TabState {
  const coalesce = coalesceKey != null && coalesceKey === tab.lastCoalesceKey;
  const snap: HistorySnapshot = { schema: tab.schema, selectionPath: tab.selectionPath };
  const past = coalesce ? tab.past : [...tab.past, snap].slice(-HISTORY_CAP);
  const selectionPaths = next.selectionPaths ?? (next.selectionPath ? [next.selectionPath] : []);
  return {
    ...tab,
    schema: next.schema,
    selectionPath: next.selectionPath,
    selectionPaths,
    anchorPath: next.anchorPath !== undefined ? next.anchorPath : next.selectionPath,
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
      selectionPaths: prev.selectionPath ? [prev.selectionPath] : [],
      anchorPath: prev.selectionPath,
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
      selectionPaths: nextSnap.selectionPath ? [nextSnap.selectionPath] : [],
      anchorPath: nextSnap.selectionPath,
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
  return updateActiveTab(state, (tab) => ({
    ...tab,
    selectionPath: path,
    selectionPaths: path ? [path] : [],
    anchorPath: path,
  }));
}

export function setHover(state: EditorState, path: JsonPath | null): EditorState {
  return updateActiveTab(state, (tab) => ({ ...tab, hoverPath: path }));
}

export function setActiveStep(state: EditorState, index: number): EditorState {
  return updateActiveTab(state, (tab) => ({ ...tab, activeStep: index }));
}

// ── горячие клавиши: навигация, мульти-выделение, перемещение, удаление ─────────

/** Смежный блок соседей текущего выделения (в одном массив-слоте), либо `null`. */
function selectionBlock(
  tab: TabState
): { slotPath: JsonPath; start: number; count: number } | null {
  const paths = tab.selectionPaths.length
    ? tab.selectionPaths
    : tab.selectionPath
      ? [tab.selectionPath]
      : [];
  if (!paths.length) return null;
  const infos = paths.map((p) => siblingInfo(tab.schema, p));
  if (infos.some((x) => x === null)) return null;
  const slot = infos[0]!.slotPath;
  if (!infos.every((x) => pathEquals(x!.slotPath, slot))) return null;
  const idxs = infos.map((x) => x!.index).sort((a, b) => a - b);
  for (let i = 1; i < idxs.length; i++) if (idxs[i] !== idxs[i - 1] + 1) return null;
  return { slotPath: slot, start: idxs[0], count: idxs.length };
}

/** Индексы выделения в одном слоте (смежные ИЛИ несмежные — для удаления), либо `null`. */
function selectionIndices(tab: TabState): { slotPath: JsonPath; indices: number[] } | null {
  const paths = tab.selectionPaths.length
    ? tab.selectionPaths
    : tab.selectionPath
      ? [tab.selectionPath]
      : [];
  if (!paths.length) return null;
  const infos = paths.map((p) => siblingInfo(tab.schema, p));
  if (infos.some((x) => x === null)) return null;
  const slot = infos[0]!.slotPath;
  if (!infos.every((x) => pathEquals(x!.slotPath, slot))) return null;
  return { slotPath: slot, indices: infos.map((x) => x!.index) };
}

/** Массив-слот контейнера для добавления ребёнка (`children`/`steps`), либо создать `children`. */
function insertSlotOf(
  node: JsonNode,
  path: JsonPath
): { slotPath: JsonPath; count: number } | null {
  const slots = childSlots(node, path).filter((s) => !s.single);
  const slot = slots.find((s) => s.kind === 'children') ?? slots[0];
  if (slot) return { slotPath: slot.path, count: slot.nodes.length };
  return isContainerNode(node) ? { slotPath: [...path, 'children'], count: 0 } : null;
}

/**
 * Навигация выделения (дерево-outline). `extend` (Shift, только для `up`/`down`) расширяет смежный
 * диапазон соседей от якоря; иначе — одиночное выделение целевого узла.
 */
export function navigate(state: EditorState, dir: NavDir, extend = false): EditorState {
  return updateActiveTab(state, (tab) => {
    const cursor = tab.selectionPath ?? ['root'];
    const target = navTarget(tab.schema, cursor, dir);
    if (!target) return tab;
    if (extend && (dir === 'up' || dir === 'down')) {
      const anchor = tab.anchorPath ?? cursor;
      const a = siblingInfo(tab.schema, anchor);
      const t = siblingInfo(tab.schema, target);
      if (a && t && pathEquals(a.slotPath, t.slotPath)) {
        const lo = Math.min(a.index, t.index);
        const hi = Math.max(a.index, t.index);
        const paths: JsonPath[] = [];
        for (let i = lo; i <= hi; i++) paths.push([...a.slotPath, i]);
        return { ...tab, selectionPath: target, selectionPaths: paths, anchorPath: anchor };
      }
    }
    return { ...tab, selectionPath: target, selectionPaths: [target], anchorPath: target };
  });
}

/** Esc: схлопнуть мульти-выделение к активному; если оно и так одиночное — подняться к родителю. */
export function collapseSelection(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    if (tab.selectionPaths.length > 1) {
      const cur = tab.selectionPath;
      return { ...tab, selectionPaths: cur ? [cur] : [], anchorPath: cur };
    }
    const parent = tab.selectionPath ? parentNodePath(tab.selectionPath) : null;
    return {
      ...tab,
      selectionPath: parent,
      selectionPaths: parent ? [parent] : [],
      anchorPath: parent,
    };
  });
}

/** ⌘←: вынести узел на уровень родителя (сразу после него). Только одиночный. */
function moveOut(schema: JsonFormSchema, path: JsonPath): MutationResult | null {
  const parentP = parentNodePath(path);
  if (!parentP) return null;
  const parentSib = siblingInfo(schema, parentP);
  if (!parentSib) return null;
  return moveNode(schema, path, parentSib.slotPath, parentSib.index + 1);
}

/** ⌘→: внести узел в предыдущего соседа-контейнер (последним ребёнком). Только одиночный. */
function moveIn(schema: JsonFormSchema, path: JsonPath): MutationResult | null {
  const sib = siblingInfo(schema, path);
  if (!sib || sib.index === 0) return null;
  const prevPath = [...sib.slotPath, sib.index - 1];
  const prevNode = getAt(schema, prevPath) as JsonNode | undefined;
  if (!prevNode || !canAcceptChildren(prevNode)) return null;
  const slots = childSlots(prevNode, prevPath).filter((s) => !s.single);
  const slot = slots.find((s) => s.kind === 'children') ?? slots[0];
  if (!slot) return null;
  return moveNode(schema, path, slot.path, slot.nodes.length);
}

/**
 * Переместить выделение: `up`/`down` — реордер смежного блока среди соседей; `left`/`right` —
 * вынести/внести (только одиночное). Всё — с записью в историю.
 */
export function moveSelection(state: EditorState, dir: NavDir): EditorState {
  return updateActiveTab(state, (tab) => {
    const block = selectionBlock(tab);
    if (!block) return tab;
    if (dir === 'up' || dir === 'down') {
      const res = reorderBlock(
        tab.schema,
        block.slotPath,
        block.start,
        block.count,
        dir === 'up' ? -1 : 1
      );
      if (!res) return tab;
      const paths: JsonPath[] = [];
      for (let i = 0; i < block.count; i++) paths.push([...block.slotPath, res.newStart + i]);
      const curInfo = tab.selectionPath ? siblingInfo(tab.schema, tab.selectionPath) : null;
      const off = curInfo
        ? Math.max(0, Math.min(curInfo.index - block.start, block.count - 1))
        : block.count - 1;
      return pushHistory(tab, {
        schema: res.schema,
        selectionPath: [...block.slotPath, res.newStart + off],
        selectionPaths: paths,
        anchorPath: paths[0],
      });
    }
    if (block.count !== 1) return tab;
    const path = [...block.slotPath, block.start];
    const moved = dir === 'left' ? moveOut(tab.schema, path) : moveIn(tab.schema, path);
    if (!moved) return tab;
    return pushHistory(tab, { schema: moved.schema, selectionPath: moved.newPath });
  });
}

/** Удалить выделение (узел/группу, в т.ч. несмежную); выделение → ближайший сосед или владелец слота. */
export function deleteSelection(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    const sel = selectionIndices(tab);
    if (!sel) return tab;
    const nextSchema = removeIndices(tab.schema, sel.slotPath, sel.indices);
    const arrAfter = getAt(nextSchema, sel.slotPath);
    const remaining = Array.isArray(arrAfter) ? arrAfter.length : 0;
    const minIdx = Math.min(...sel.indices);
    const newSel: JsonPath =
      remaining > 0
        ? [...sel.slotPath, Math.min(minIdx, remaining - 1)]
        : (parentNodePath([...sel.slotPath, 0]) ?? ['root']);
    return pushHistory(tab, { schema: nextSchema, selectionPath: newSel });
  });
}

/** ⌘D: дублировать активный узел (одиночное выделение). */
export function duplicateSelection(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    if (!tab.selectionPath || tab.selectionPaths.length !== 1) return tab;
    const res = duplicateNode(tab.schema, tab.selectionPath);
    return pushHistory(tab, { schema: res.schema, selectionPath: res.newPath });
  });
}

/**
 * Добавить компонент (готовый узел) умно по контексту: в выделенный контейнер (в конец детей),
 * после выделенного листа (соседом), либо в корень, если ничего не выделено. Выделяет новый узел.
 */
export function addComponent(state: EditorState, node: JsonNode): EditorState {
  return updateActiveTab(state, (tab) => {
    const sel = tab.selectionPath;
    const selNode = sel ? (getAt(tab.schema, sel) as JsonNode | undefined) : undefined;
    let slotPath: JsonPath;
    let index: number;

    const into = sel && selNode && canAcceptChildren(selNode) ? insertSlotOf(selNode, sel) : null;
    if (sel && into) {
      slotPath = into.slotPath;
      index = into.count;
    } else if (sel) {
      const sib = siblingInfo(tab.schema, sel);
      if (sib) {
        slotPath = sib.slotPath;
        index = sib.index + 1;
      } else {
        const parent = parentNodePath(sel) ?? ['root'];
        const pnode = getAt(tab.schema, parent) as JsonNode | undefined;
        const ps = pnode ? insertSlotOf(pnode, parent) : null;
        if (!ps) return tab;
        slotPath = ps.slotPath;
        index = ps.count;
      }
    } else {
      const rs = insertSlotOf(tab.schema.root, ['root']);
      if (!rs) return tab;
      slotPath = rs.slotPath;
      index = rs.count;
    }

    const res = insertNode(tab.schema, slotPath, index, node);
    return pushHistory(tab, { schema: res.schema, selectionPath: res.newPath });
  });
}

/** ⌘G: сгруппировать выделенные смежные поля в новый вертикальный `div`; выделить группу. */
export function groupSelection(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    const block = selectionBlock(tab);
    if (!block) return tab;
    const res = groupBlock(tab.schema, block.slotPath, block.start, block.count);
    return pushHistory(tab, { schema: res.schema, selectionPath: res.newPath });
  });
}

/** ⌘⇧G: разгруппировать выделенный `div` (заменить его детьми). No-op для не-div. */
export function ungroupSelection(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    if (!tab.selectionPath) return tab;
    const res = ungroupNode(tab.schema, tab.selectionPath);
    if (res.schema === tab.schema) return tab;
    return pushHistory(tab, { schema: res.schema, selectionPath: res.newPath });
  });
}

/** ⌘⇧L: сменить раскладку выделенного `div` (вертикально ⇄ горизонтально). No-op для не-div. */
export function flipSelection(state: EditorState): EditorState {
  return updateActiveTab(state, (tab) => {
    if (!tab.selectionPath) return tab;
    const node = getAt(tab.schema, tab.selectionPath) as JsonNode | undefined;
    if (!node || !isDivContainer(node)) return tab;
    const res = flipDirection(tab.schema, tab.selectionPath);
    return pushHistory(tab, { schema: res.schema, selectionPath: tab.selectionPath });
  });
}

/** Shift+ЛКМ: расширить смежный диапазон соседей от якоря до `path` (в одном слоте). */
export function extendSelectionTo(state: EditorState, path: JsonPath): EditorState {
  return updateActiveTab(state, (tab) => {
    const anchor = tab.anchorPath ?? tab.selectionPath ?? path;
    const a = siblingInfo(tab.schema, anchor);
    const t = siblingInfo(tab.schema, path);
    if (a && t && pathEquals(a.slotPath, t.slotPath)) {
      const lo = Math.min(a.index, t.index);
      const hi = Math.max(a.index, t.index);
      const paths: JsonPath[] = [];
      for (let i = lo; i <= hi; i++) paths.push([...a.slotPath, i]);
      return { ...tab, selectionPath: path, selectionPaths: paths, anchorPath: anchor };
    }
    return { ...tab, selectionPath: path, selectionPaths: [path], anchorPath: path };
  });
}

/** ⌘/Ctrl+ЛКМ: тоггл узла в выделении (несмежно, в пределах одного слота). */
export function toggleSelectionAt(state: EditorState, path: JsonPath): EditorState {
  return updateActiveTab(state, (tab) => {
    const exists = tab.selectionPaths.some((p) => pathEquals(p, path));
    if (exists) {
      const remaining = tab.selectionPaths.filter((p) => !pathEquals(p, path));
      const active = remaining[remaining.length - 1] ?? null;
      return { ...tab, selectionPaths: remaining, selectionPath: active, anchorPath: active };
    }
    // добавляем только если тот же слот, что и текущее выделение; иначе — свежий выбор
    const info = siblingInfo(tab.schema, path);
    const sameSlot =
      tab.selectionPaths.length === 0 ||
      (info != null &&
        tab.selectionPaths.every((p) => {
          const pi = siblingInfo(tab.schema, p);
          return pi != null && pathEquals(pi.slotPath, info.slotPath);
        }));
    if (!sameSlot) return { ...tab, selectionPath: path, selectionPaths: [path], anchorPath: path };
    return {
      ...tab,
      selectionPath: path,
      selectionPaths: [...tab.selectionPaths, path],
      anchorPath: path,
    };
  });
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
/** Открыть/закрыть модалку быстрого добавления компонента. */
export function setQuickAdd(state: EditorState, open: boolean): EditorState {
  return { ...state, ui: { ...state.ui, quickAddOpen: open } };
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
  return tab.kind === 'code' ? tab.text !== tab.savedText : tab.schema !== tab.savedSchema;
}
