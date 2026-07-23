import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { useFileUploadContext } from './FileUploadContext';
import type { FileUploadItem } from './types';

/** Props `FileUpload.ItemGroup`. */
export interface FileUploadItemGroupProps extends Omit<
  HTMLAttributes<HTMLUListElement>,
  'children'
> {
  /** Render prop: вызывается для каждого элемента списка (как `FormArray.List`). */
  children: (item: FileUploadItem) => ReactNode;
}

/**
 * FileUpload.ItemGroup — семантический список выбранных файлов (`<ul role="list">`).
 * Пустой список не рендерится вовсе.
 *
 * @example
 * ```tsx
 * <FileUpload.ItemGroup>
 *   {(item) => (
 *     <FileUpload.Item key={item.key} item={item}>
 *       <FileUpload.ItemName />
 *       <FileUpload.ItemDeleteTrigger>×</FileUpload.ItemDeleteTrigger>
 *     </FileUpload.Item>
 *   )}
 * </FileUpload.ItemGroup>
 * ```
 */
export const FileUploadItemGroup = forwardRef<HTMLUListElement, FileUploadItemGroupProps>(
  function FileUploadItemGroup({ children, ...props }, ref) {
    const { items, getItemGroupProps } = useFileUploadContext();
    if (items.length === 0) return null;
    return (
      <ul ref={ref} {...getItemGroupProps()} {...props}>
        {items.map((item) => children(item))}
      </ul>
    );
  }
);

FileUploadItemGroup.displayName = 'FileUpload.ItemGroup';
