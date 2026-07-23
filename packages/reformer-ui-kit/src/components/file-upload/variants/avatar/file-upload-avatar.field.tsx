import { withFormControl, type FieldAdapter } from '@/fields/with-form-control';
import { FileUploadAvatar } from './file-upload-avatar';

/**
 * Avatar — single-файл: значение поля `File | RemoteFileRef | null`, а CDK-слой
 * работает с массивом. Адаптер конвертирует single ↔ массив длины 1.
 */
export const fileUploadSingleAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => (Array.isArray(v) ? (v[0] ?? null) : null),
  toValue: (v) => (v == null ? null : [v]),
};

/** Field-версия avatar-варианта. Rich handle реализует сам композит. */
export const FileUploadAvatarField = withFormControl(FileUploadAvatar, fileUploadSingleAdapter, {
  exposesHandle: true,
});
