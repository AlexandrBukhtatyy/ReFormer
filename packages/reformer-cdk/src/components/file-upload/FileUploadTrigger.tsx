import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFileUploadContext } from './FileUploadContext';

/** Props `FileUpload.Trigger`. */
export interface FileUploadTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Рендерить собственный элемент вместо `<button>` (пропсы мержатся в него). */
  asChild?: boolean;
}

/**
 * FileUpload.Trigger — кнопка «выбрать файлы»: открывает системный пикер.
 *
 * @example Со своей кнопкой из ui-kit
 * ```tsx
 * <FileUpload.Trigger asChild>
 *   <Button variant="outline">Выбрать файлы</Button>
 * </FileUpload.Trigger>
 * ```
 */
export const FileUploadTrigger = forwardRef<HTMLButtonElement, FileUploadTriggerProps>(
  function FileUploadTrigger({ asChild, children, ...props }, ref) {
    const { getTriggerProps } = useFileUploadContext();
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} {...getTriggerProps()} {...props}>
        {children}
      </Comp>
    );
  }
);

FileUploadTrigger.displayName = 'FileUpload.Trigger';
