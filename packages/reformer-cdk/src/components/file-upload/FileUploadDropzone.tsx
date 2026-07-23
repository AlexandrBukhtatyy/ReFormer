import { forwardRef, type HTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFileUploadContext } from './FileUploadContext';

/** Props `FileUpload.Dropzone`. */
export interface FileUploadDropzoneProps extends HTMLAttributes<HTMLElement> {
  /** Рендерить собственный элемент вместо `<div>` (пропсы мержатся в него). */
  asChild?: boolean;
}

/**
 * FileUpload.Dropzone — зона drag-and-drop. Одновременно доступная кнопка:
 * клик и Enter/Space открывают пикер (drop никогда не единственный канал ввода).
 * Состояние подсветки — через `data-dragging`/`data-disabled`.
 *
 * Консумент задаёт `aria-label` с перечислением ограничений
 * («PNG или JPG, до 5 МБ, максимум 3 файла») — хук их текстом не формулирует.
 *
 * @example
 * ```tsx
 * <FileUpload.Dropzone
 *   aria-label="Загрузка документов: PDF, до 10 МБ"
 *   className="dropzone data-[dragging]:highlight"
 * >
 *   Перетащите файлы или нажмите
 * </FileUpload.Dropzone>
 * ```
 */
export const FileUploadDropzone = forwardRef<HTMLElement, FileUploadDropzoneProps>(
  function FileUploadDropzone({ asChild, children, ...props }, ref) {
    const { getDropzoneProps } = useFileUploadContext();
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp ref={ref as never} {...getDropzoneProps()} {...props}>
        {children}
      </Comp>
    );
  }
);

FileUploadDropzone.displayName = 'FileUpload.Dropzone';
