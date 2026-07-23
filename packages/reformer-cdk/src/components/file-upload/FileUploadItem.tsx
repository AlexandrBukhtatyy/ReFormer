import { forwardRef, useMemo, type LiHTMLAttributes } from 'react';
import { FileUploadItemContext, useFileUploadContext } from './FileUploadContext';
import type { FileUploadItem as FileUploadItemType } from './types';

/** Props `FileUpload.Item`. */
export interface FileUploadItemProps extends LiHTMLAttributes<HTMLLIElement> {
  /** Элемент списка из render prop `FileUpload.ItemGroup`. */
  item: FileUploadItemType;
}

/**
 * FileUpload.Item — строка файла (`<li role="listitem" data-status="…">`).
 * Провайдит per-item контекст для `ItemName`/`ItemSize`/`ItemPreview`/`ItemProgress`/
 * `ItemDeleteTrigger`/`ItemRetryTrigger`.
 *
 * `data-status` (`local | uploading | uploaded | error`) — крючок для стилизации
 * и e2e-селекторов.
 */
export const FileUploadItem = forwardRef<HTMLLIElement, FileUploadItemProps>(
  function FileUploadItem({ item, children, ...props }, ref) {
    const { getItemProps } = useFileUploadContext();
    const contextValue = useMemo(() => ({ item }), [item]);
    return (
      <FileUploadItemContext.Provider value={contextValue}>
        <li ref={ref} {...getItemProps(item)} {...props}>
          {children}
        </li>
      </FileUploadItemContext.Provider>
    );
  }
);

FileUploadItem.displayName = 'FileUpload.Item';
