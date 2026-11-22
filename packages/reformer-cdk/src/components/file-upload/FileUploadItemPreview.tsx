import { forwardRef, type ImgHTMLAttributes, type ReactNode } from 'react';
import { useFileUploadContext, useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemPreview`. */
export interface FileUploadItemPreviewProps extends Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'children'
> {
  /** Фолбэк для не-изображений (иконка по типу файла и т.п.). */
  children?: ReactNode;
}

/** MIME элемента: локальный файл приоритетнее дескриптора. */
function itemMime(item: { file?: File; remote?: { type?: string } }): string {
  return item.file?.type ?? item.remote?.type ?? '';
}

/**
 * FileUpload.ItemPreview — превью файла. Для изображений рендерит `<img>` с managed
 * object URL (создаётся лениво, revoke — на удалении элемента и unmount; сам слот
 * URL никогда не создаёт — этим владеет хук). Для остального — `children` (фолбэк).
 *
 * @example Превью с иконкой-фолбэком
 * ```tsx
 * <FileUpload.ItemPreview className="size-10 rounded object-cover">
 *   <FileIcon />
 * </FileUpload.ItemPreview>
 * ```
 */
export const FileUploadItemPreview = forwardRef<HTMLImageElement, FileUploadItemPreviewProps>(
  function FileUploadItemPreview({ children, alt, ...props }, ref) {
    const { getPreviewUrl } = useFileUploadContext();
    const { item } = useFileUploadItemContext();

    const isImage = itemMime(item).startsWith('image/');
    const url = isImage ? getPreviewUrl(item.key) : null;

    if (!url) return <>{children}</>;
    return <img ref={ref} src={url} alt={alt ?? ''} {...props} />;
  }
);

FileUploadItemPreview.displayName = 'FileUpload.ItemPreview';
