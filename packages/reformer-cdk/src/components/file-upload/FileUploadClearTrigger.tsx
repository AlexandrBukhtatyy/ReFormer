import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Slot } from '../form-wizard/Slot';
import { useFileUploadContext } from './FileUploadContext';

/** Props `FileUpload.ClearTrigger`. */
export interface FileUploadClearTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Рендерить собственный элемент вместо `<button>` (пропсы мержатся в него). */
  asChild?: boolean;
}

/**
 * FileUpload.ClearTrigger — кнопка полной очистки списка (все активные загрузки
 * прерываются). Заблокирована при пустом списке.
 */
export const FileUploadClearTrigger = forwardRef<HTMLButtonElement, FileUploadClearTriggerProps>(
  function FileUploadClearTrigger({ asChild, children, ...props }, ref) {
    const { getClearTriggerProps } = useFileUploadContext();
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} {...getClearTriggerProps()} {...props}>
        {children}
      </Comp>
    );
  }
);

FileUploadClearTrigger.displayName = 'FileUpload.ClearTrigger';
