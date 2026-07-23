import { forwardRef, useImperativeHandle, type ReactNode } from 'react';
import { FileUploadContext } from './FileUploadContext';
import { useFileUpload } from './useFileUpload';
import type { FileUploadHandle, UseFileUploadOptions } from './types';

/** Props `FileUpload.Root`: опции хука + children. */
export interface FileUploadRootProps extends UseFileUploadOptions {
  children?: ReactNode;
}

/**
 * FileUpload.Root — провайдер контекста и владелец поведения выбора/загрузки файлов.
 *
 * Сам рендерит только служебные узлы: hidden `<input type="file">` (настоящий input —
 * основа доступности: `label`/click/`focus()` работают нативно) и visually-hidden
 * `aria-live`-регион статусов («файл добавлен», «загрузка завершена», ошибки).
 * Всю видимую разметку дают слоты (`Trigger`/`Dropzone`/`ItemGroup`/…) и обёртки
 * из `@reformer/ui-kit`.
 *
 * Режимы значения поля:
 * - **deferred** (без `uploader`) — значение `File[]`, сеть — забота консумента при submit;
 * - **immediate** (задан `uploader`) — файлы уходят на сервер при выборе, значение —
 *   сериализуемые дескрипторы {@link RemoteFileRef} (только успешно загруженные).
 *
 * @example Deferred: кнопка + список
 * ```tsx
 * <FileUpload.Root value={value} onChange={setValue} accept=".pdf" multiple maxFiles={3}>
 *   <FileUpload.Trigger>Выбрать файлы</FileUpload.Trigger>
 *   <FileUpload.ItemGroup>
 *     {(item) => (
 *       <FileUpload.Item key={item.key} item={item}>
 *         <FileUpload.ItemName />
 *         <FileUpload.ItemSize />
 *         <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
 *       </FileUpload.Item>
 *     )}
 *   </FileUpload.ItemGroup>
 * </FileUpload.Root>
 * ```
 *
 * @example Immediate: dropzone + прогресс + retry
 * ```tsx
 * <FileUpload.Root
 *   value={refs}
 *   onChange={setRefs}
 *   multiple
 *   uploader={(file, { onProgress, signal }) => api.upload(file, onProgress, signal)}
 * >
 *   <FileUpload.Dropzone>Перетащите файлы или нажмите</FileUpload.Dropzone>
 *   <FileUpload.ItemGroup>
 *     {(item) => (
 *       <FileUpload.Item key={item.key} item={item}>
 *         <FileUpload.ItemName />
 *         <FileUpload.ItemProgress />
 *         <FileUpload.ItemRetryTrigger>Повторить</FileUpload.ItemRetryTrigger>
 *         <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
 *       </FileUpload.Item>
 *     )}
 *   </FileUpload.ItemGroup>
 * </FileUpload.Root>
 * ```
 *
 * @example Управление снаружи через ref
 * ```tsx
 * const uploadRef = useRef<FileUploadHandle>(null);
 * <button onClick={() => uploadRef.current?.openFilePicker()}>Добавить</button>
 * <FileUpload.Root ref={uploadRef} …>…</FileUpload.Root>
 * ```
 */
export const FileUploadRoot = forwardRef<FileUploadHandle, FileUploadRootProps>(
  function FileUploadRoot({ children, ...options }, ref) {
    const fileUpload = useFileUpload(options);

    useImperativeHandle(
      ref,
      () => ({
        openFilePicker: fileUpload.openFilePicker,
        addFiles: fileUpload.addFiles,
        removeItem: fileUpload.removeItem,
        clear: fileUpload.clear,
        retry: fileUpload.retry,
        abort: fileUpload.abort,
        focus: fileUpload.focus,
      }),
      [fileUpload]
    );

    return (
      <FileUploadContext.Provider value={fileUpload}>
        <input {...fileUpload.getHiddenInputProps()} />
        {children}
        <div {...fileUpload.getLiveRegionProps()}>{fileUpload.liveMessage}</div>
      </FileUploadContext.Provider>
    );
  }
);

FileUploadRoot.displayName = 'FileUpload.Root';
