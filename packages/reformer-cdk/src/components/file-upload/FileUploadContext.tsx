import { createContext, useContext } from 'react';
import type { UseFileUploadReturn } from './useFileUpload';
import type { FileUploadItem } from './types';

/**
 * Значение контекста `FileUpload` — целиком {@link UseFileUploadReturn}:
 * слоты и кастомные части читают из него состояние, действия и prop-getters.
 */
export type FileUploadContextValue = UseFileUploadReturn;

export const FileUploadContext = createContext<FileUploadContextValue | null>(null);

/**
 * Хук доступа к контексту `FileUpload`. Бросает исключение вне `FileUpload.Root`.
 *
 * @returns Текущее {@link FileUploadContextValue}.
 * @throws Error если вызван вне `FileUpload.Root`.
 *
 * @example Своя кнопка очистки вне слотов
 * ```tsx
 * import { useFileUploadContext } from '@reformer/cdk/file-upload';
 *
 * function ToolbarClear() {
 *   const { items, clear } = useFileUploadContext();
 *   if (items.length === 0) return null;
 *   return <button onClick={clear}>Очистить ({items.length})</button>;
 * }
 * ```
 */
export function useFileUploadContext(): FileUploadContextValue {
  const context = useContext(FileUploadContext);
  if (!context) {
    throw new Error(
      'FileUpload.* components must be used within <FileUpload.Root>. ' +
        'Wrap your slots with <FileUpload.Root>.'
    );
  }
  return context;
}

/** Значение per-item контекста: элемент, который рендерит текущий `FileUpload.Item`. */
export interface FileUploadItemContextValue {
  item: FileUploadItem;
}

export const FileUploadItemContext = createContext<FileUploadItemContextValue | null>(null);

/**
 * Хук доступа к per-item контексту (внутри `FileUpload.Item`).
 *
 * @returns Текущий {@link FileUploadItemContextValue}.
 * @throws Error если вызван вне `FileUpload.Item`.
 */
export function useFileUploadItemContext(): FileUploadItemContextValue {
  const context = useContext(FileUploadItemContext);
  if (!context) {
    throw new Error('FileUpload.Item* components must be used within <FileUpload.Item>.');
  }
  return context;
}
