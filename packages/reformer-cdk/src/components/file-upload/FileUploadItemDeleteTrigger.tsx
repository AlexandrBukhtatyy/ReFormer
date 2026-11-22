import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFileUploadContext, useFileUploadItemContext } from './FileUploadContext';

/** Props `FileUpload.ItemDeleteTrigger`. */
export interface FileUploadItemDeleteTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Рендерить собственный элемент вместо `<button>` (пропсы мержатся в него). */
  asChild?: boolean;
}

/**
 * FileUpload.ItemDeleteTrigger — кнопка удаления файла из списка. Активная загрузка
 * при удалении прерывается. `aria-label` уже содержит имя файла
 * («Удалить файл report.pdf»).
 */
export const FileUploadItemDeleteTrigger = forwardRef<
  HTMLButtonElement,
  FileUploadItemDeleteTriggerProps
>(function FileUploadItemDeleteTrigger({ asChild, children, ...props }, ref) {
  const { getItemDeleteTriggerProps } = useFileUploadContext();
  const { item } = useFileUploadItemContext();
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} {...getItemDeleteTriggerProps(item)} {...props}>
      {children}
    </Comp>
  );
});

FileUploadItemDeleteTrigger.displayName = 'FileUpload.ItemDeleteTrigger';
