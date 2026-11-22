import { forwardRef, type HTMLAttributes } from 'react';
import { useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemName`. */
export type FileUploadItemNameProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children'>;

/**
 * FileUpload.ItemName — имя файла (`<span>`). Для `uploaded` без локального файла
 * берётся имя из дескриптора.
 */
export const FileUploadItemName = forwardRef<HTMLSpanElement, FileUploadItemNameProps>(
  function FileUploadItemName(props, ref) {
    const { item } = useFileUploadItemContext();
    const name =
      item.status === 'uploaded' ? (item.file?.name ?? item.remote.name) : item.file.name;
    return (
      <span ref={ref} {...props}>
        {name}
      </span>
    );
  }
);

FileUploadItemName.displayName = 'FileUpload.ItemName';
