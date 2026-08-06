/**
 * Буфер обмена дерева файлов: пути, скопированные через контекстное меню панели («Копировать» →
 * «Вставить»). Отдельный стор, а не локальный стейт панели — буфер должен переживать переключение
 * левой панели (Файлы → Палитра → Файлы), при котором `FilesPanel` размонтируется.
 *
 * Это НЕ системный буфер обмена: `navigator.clipboard` умеет текст и картинки, а FS Access-путь
 * файла в него не положишь — копируем внутри приложения по путям проекта.
 *
 * @module reformer-builder/store/file-clipboard
 */

import { useSyncExternalStore } from 'react';
import { createStore } from './create-store';

/** Что лежит в буфере: пути записей дерева относительно корня проекта. */
export interface FileClipboardState {
  paths: string[];
}

const initial: FileClipboardState = { paths: [] };

export const fileClipboardStore = createStore<FileClipboardState>(initial);

export const fileClipboardActions = {
  /** Положить пути в буфер (перезаписывает предыдущее содержимое). */
  copy: (paths: string[]) => fileClipboardStore.setState({ paths: [...paths] }),
  clear: () => fileClipboardStore.setState({ paths: [] }),
};

/** Пути в буфере (пустой массив — буфер пуст). */
export function useFileClipboard(): string[] {
  return useSyncExternalStore(
    fileClipboardStore.subscribe,
    () => fileClipboardStore.getState().paths,
    () => fileClipboardStore.getState().paths
  );
}
