import { forwardRef, type HTMLAttributes } from 'react';
import { formatFileSize } from './file-upload-core';
import { useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemSize`. */
export type FileUploadItemSizeProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;

/**
 * FileUpload.ItemSize — человекочитаемый размер файла (`<span>`, «1.5 МБ»).
 * Если размер неизвестен (preloaded-дескриптор без `size`) — не рендерится.
 */
export const FileUploadItemSize = forwardRef<HTMLSpanElement, FileUploadItemSizeProps>(
  function FileUploadItemSize(props, ref) {
    const { item } = useFileUploadItemContext();
    const size =
      item.status === 'uploaded' ? (item.file?.size ?? item.remote.size) : item.file.size;
    if (typeof size !== 'number') return null;
    return (
      <span ref={ref} {...props}>
        {formatFileSize(size)}
      </span>
    );
  }
);

FileUploadItemSize.displayName = 'FileUpload.ItemSize';
