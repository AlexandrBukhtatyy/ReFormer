import { withFormControl } from '@/fields/with-form-control';
import { fileUploadAdapter } from '../base/file-upload-base.field';
import { FileUploadInput } from './file-upload-input';

/**
 * Field-версия input-варианта: тот же value-based адаптер, что у base/dropzone
 * (контракт значения один — визуал компактного инпута). Rich handle реализует композит.
 */
export const FileUploadInputField = withFormControl(FileUploadInput, fileUploadAdapter, {
  exposesHandle: true,
});
