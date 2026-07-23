import { forwardRef } from 'react';
import { FileUploadBaseField } from './variants/base/file-upload-base.field';
import { FileUploadDropzoneField } from './variants/dropzone/file-upload-dropzone.field';
import { FileUploadInputField } from './variants/input/file-upload-input.field';
import type { FileUploadFieldHandle } from './variants/base/file-upload-base';

/**
 * Field-версия FileUpload — диспетчер по `variant`: `dropzone` → зона drag-and-drop,
 * `input` → компактный инпут с кнопкой-иконкой, иначе кнопка-триггер (base).
 * Контракт значения один (`File[] | RemoteFileRef[] | null`), различается только
 * представление — поэтому одно registry-имя `FileUpload`.
 *
 * `forwardRef`: все пути форвардят ref и отдают rich {@link FileUploadFieldHandle}
 * (собственный `useImperativeHandle` композитов, HOC — passthrough).
 *
 * Single-изображение с превью — отдельный {@link FileUploadAvatarField}
 * (другой тип значения → другое registry-имя `FileUploadAvatar`).
 */
export const FileUploadField = forwardRef<FileUploadFieldHandle, Record<string, unknown>>(
  function FileUploadField({ variant, ...props }, ref) {
    if (variant === 'dropzone') return <FileUploadDropzoneField ref={ref} {...props} />;
    if (variant === 'input') return <FileUploadInputField ref={ref} {...props} />;
    return <FileUploadBaseField ref={ref} {...props} />;
  }
);
FileUploadField.displayName = 'FileUploadField';
