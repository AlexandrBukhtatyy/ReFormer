import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemProgress`. */
export interface FileUploadItemProgressProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'children'
> {
  /** Кастомный рендер (полоса, спиннер). По умолчанию — текст «NN%». */
  children?: (progress: number) => ReactNode;
}

/**
 * FileUpload.ItemProgress — прогресс загрузки элемента. Рендерится только в статусе
 * `uploading`: `role="progressbar"` + `aria-valuenow` (целые проценты), `data-progress`
 * для CSS.
 *
 * @example Полоса прогресса
 * ```tsx
 * <FileUpload.ItemProgress className="h-1 bg-muted">
 *   {(p) => <div style={{ width: `${p}%` }} className="h-full bg-primary" />}
 * </FileUpload.ItemProgress>
 * ```
 */
export const FileUploadItemProgress = forwardRef<HTMLDivElement, FileUploadItemProgressProps>(
  function FileUploadItemProgress({ children, ...props }, ref) {
    const { item } = useFileUploadItemContext();
    if (item.status !== 'uploading') return null;
    const percent = Math.round(item.progress);
    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-progress={percent}
        {...props}
      >
        {children ? children(percent) : `${percent}%`}
      </div>
    );
  }
);

FileUploadItemProgress.displayName = 'FileUpload.ItemProgress';
