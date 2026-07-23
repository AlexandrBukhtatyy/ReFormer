// base — кнопка-триггер + список на Attachment.
export {
  FileUploadBase,
  splitFileUploadProps,
  type FileUploadBaseProps,
  type FileUploadFieldHandle,
} from './variants/base/file-upload-base';
export { FileUploadBaseField, fileUploadAdapter } from './variants/base/file-upload-base.field';
export { FileUploadItemList } from './variants/base/file-upload-item-list';

// dropzone — зона drag-and-drop, тот же контракт значения.
export {
  FileUploadDropzone,
  type FileUploadDropzoneProps,
} from './variants/dropzone/file-upload-dropzone';
export { FileUploadDropzoneField } from './variants/dropzone/file-upload-dropzone.field';

// input — компактный инпут с кнопкой-иконкой, тот же контракт значения.
export { FileUploadInput, type FileUploadInputProps } from './variants/input/file-upload-input';
export { FileUploadInputField } from './variants/input/file-upload-input.field';

// avatar — single-изображение с превью (отдельный seam-контракт).
export { FileUploadAvatar, type FileUploadAvatarProps } from './variants/avatar/file-upload-avatar';
export {
  FileUploadAvatarField,
  fileUploadSingleAdapter,
} from './variants/avatar/file-upload-avatar.field';

// field-версия + алиас FileUploadField (диспетчер по variant).
export { FileUploadField } from './file-upload-field';

// props-схемы.
export { fileUploadBasePropsSchema } from './variants/base/file-upload-base.props';
export { fileUploadAvatarPropsSchema } from './variants/avatar/file-upload-avatar.props';
