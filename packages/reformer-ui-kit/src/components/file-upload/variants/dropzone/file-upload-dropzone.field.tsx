import { withFormControl } from '@/fields/with-form-control';
import { fileUploadAdapter } from '../base/file-upload-base.field';
import { FileUploadDropzone } from './file-upload-dropzone';

/**
 * Field-версия dropzone-варианта: тот же value-based адаптер, что у base
 * (контракт один — визуал разный). Rich handle реализует сам композит.
 */
export const FileUploadDropzoneField = withFormControl(FileUploadDropzone, fileUploadAdapter, {
  exposesHandle: true,
});
