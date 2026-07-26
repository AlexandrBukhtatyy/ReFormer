/**
 * React-хуки над стором редактора (`useSyncExternalStore`). Селектор должен возвращать
 * стабильную ссылку для неизменных срезов (примитивы или референциально стабильные объекты
 * состояния) — иначе лишние ре-рендеры.
 *
 * @module reformer-builder/store/hooks
 */

import { useSyncExternalStore } from 'react';
import type { JsonPath } from '../model';
import { editorStore } from './editor-store';
import * as R from './reducers';
import type { EditorState, TabState, UiState } from './types';

/** Подписаться на срез состояния редактора. */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  return useSyncExternalStore(
    editorStore.subscribe,
    () => selector(editorStore.getState()),
    () => selector(editorStore.getState())
  );
}

/** Активная вкладка (или `null`). */
export function useActiveTab(): TabState | null {
  return useEditor(R.activeTab);
}

/** UI-флаги оболочки. */
export function useUi(): UiState {
  return useEditor((s) => s.ui);
}

/** Путь выделенного узла активной вкладки. */
export function useSelectionPath(): JsonPath | null {
  return useEditor((s) => R.activeTab(s)?.selectionPath ?? null);
}

/** Порядок вкладок (стабильная ссылка — меняется только при open/close). */
export function useTabOrder(): string[] {
  return useEditor((s) => s.order);
}

/** Id активной вкладки. */
export function useActiveTabId(): string | null {
  return useEditor((s) => s.activeTabId);
}

/** Вкладка по id (для рендера одной вкладки в таб-баре). */
export function useTab(id: string): TabState | undefined {
  return useEditor((s) => s.tabs[id]);
}
