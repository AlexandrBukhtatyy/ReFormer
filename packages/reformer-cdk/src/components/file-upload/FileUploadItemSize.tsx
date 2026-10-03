import { forwardRef, type HTMLAttributes } from 'react';
import { useI18n } from '@reformer/core/i18n';
import { useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemSize`. */
export type FileUploadItemSizeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;

/**
 * FileUpload.ItemSize — человекочитаемый размер файла (`<span>`). Число и единица — по активной
 * локали: «1.5 MB» без `I18nProvider`, «1,5 МБ» под русской.
 * Если размер неизвестен (preloaded-дескриптор без `size`) — не рендерится.
 */
export const FileUploadItemSize = forwardRef<HTMLSpanElement, FileUploadItemSizeProps>(
  function FileUploadItemSize(props, ref) {
    const { item } = useFileUploadItemContext();
    const { fileSize } = useI18n();
    const size =
      item.status === 'uploaded' ? (item.file?.size ?? item.remote.size) : item.file.size;
    if (typeof size !== 'number') return null;
    return (
      <span ref={ref} {...props}>
        {fileSize(size)}
      </span>
    );
  }
);

FileUploadItemSize.displayName = 'FileUpload.ItemSize';
