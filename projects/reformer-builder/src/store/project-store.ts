/**
 * Состояние Mode B (проектная связка): выбранный каталог, обнаруженные схемы, резолв prettier,
 * флаг сканирования, доступность «Переоткрыть». Отдельный стор — не мешаем редакторному.
 *
 * @module reformer-builder/store/project-store
 */

import { useSyncExternalStore } from 'react';
import type { TreeEntry } from '../io/discovery';
import type { ResolvedPrinter } from '../io/prettier-config';
import { createStore } from './create-store';

/** Состояние проекта (Mode B). */
export interface ProjectState {
  dirHandle: FileSystemDirectoryHandle | null;
  dirName: string | null;
  /**
   * Плоское файловое дерево открытого каталога (файлы+папки; схемы помечены). Заполняется лениво:
   * содержатся только уровни уже загруженных каталогов ({@link ProjectState.loadedDirs}).
   */
  tree: TreeEntry[];
  /** Каталоги, чьё содержимое уже прочитано (корень — пустая строка). */
  loadedDirs: Set<string>;
  /** Каталоги, содержимое которых читается прямо сейчас (индикатор в строке дерева). */
  loadingDirs: Set<string>;
  printer: ResolvedPrinter | null;
  scanning: boolean;
  /** Ошибка сканирования (показываем в панели). */
  error: string | null;
  /** В IndexedDB есть сохранённый каталог → показать «Переоткрыть». */
  canReopen: boolean;
}

const initial: ProjectState = {
  dirHandle: null,
  dirName: null,
  tree: [],
  loadedDirs: new Set(),
  loadingDirs: new Set(),
  printer: null,
  scanning: false,
  error: null,
  canReopen: false,
};

export const projectStore = createStore<ProjectState>(initial);

export const projectActions = {
  setScanning: (scanning: boolean) => projectStore.setState((s) => ({ ...s, scanning })),
  setCanReopen: (canReopen: boolean) => projectStore.setState((s) => ({ ...s, canReopen })),
  set: (patch: Partial<ProjectState>) => projectStore.setState((s) => ({ ...s, ...patch })),
  clear: () => projectStore.setState({ ...initial, loadedDirs: new Set(), loadingDirs: new Set() }),
};

/** Подписаться на срез состояния проекта. */
export function useProject<T>(selector: (s: ProjectState) => T): T {
  return useSyncExternalStore(
    projectStore.subscribe,
    () => selector(projectStore.getState()),
    () => selector(projectStore.getState())
  );
}
