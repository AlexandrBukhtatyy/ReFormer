import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFileUploadContext, useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemRetryTrigger`. */
export interface FileUploadItemRetryTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Рендерить собственный элемент вместо `<button>` (пропсы мержатся в него). */
  asChild?: boolean;
}

/**
 * FileUpload.ItemRetryTrigger — кнопка повтора упавшей загрузки. Рендерится только
 * в статусе `error` (в остальных повтор бессмыслен).
 */
export const FileUploadItemRetryTrigger = forwardRef<
  HTMLButtonElement,
  FileUploadItemRetryTriggerProps
>(function FileUploadItemRetryTrigger({ asChild, children, ...props }, ref) {
  const { getItemRetryTriggerProps } = useFileUploadContext();
  const { item } = useFileUploadItemContext();
  if (item.status !== 'error') return null;
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} {...getItemRetryTriggerProps(item)} {...props}>
      {children}
    </Comp>
  );
});

FileUploadItemRetryTrigger.displayName = 'FileUpload.ItemRetryTrigger';
