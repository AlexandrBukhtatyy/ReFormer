import { withFormControl, type FieldAdapter } from '@/fields/with-form-control';
import { FileUploadBase } from './file-upload-base';

/**
 * FileUpload уже value-based (`value: File[] | RemoteFileRef[] | null`, `onChange(value)`,
 * `onBlur`) — адаптер почти identity: маппинга DOM-события нет, HOC нужен лишь чтобы
 * отбросить `control` (renderer-путь). Пустой массив нормализуется в `null`,
 * чтобы `required()` срабатывал без изменений.
 */
export const fileUploadAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => (Array.isArray(v) && v.length > 0 ? v : null),
  toValue: (v) => v ?? null,
};

/**
 * `exposesHandle: true` — FileUploadBase сам реализует {@link FileUploadFieldHandle}
 * (useImperativeHandle), поэтому HOC форвардит ref потребителя прямо в композит
 * (passthrough), без своего baseline-handle.
 */
export const FileUploadBaseField = withFormControl(FileUploadBase, fileUploadAdapter, {
  exposesHandle: true,
});
