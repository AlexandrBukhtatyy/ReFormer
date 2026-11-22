// base — кнопка-триггер + список на Attachment. Компонент для формы (registry FileUpload).
export {
  FileUploadBase,
  splitFileUploadProps,
  fileUploadAdapter,
  type FileUploadBaseProps,
  type FileUploadFieldHandle,
} from './variants/base/file-upload-base';
export { FileUploadItemList } from './variants/base/file-upload-item-list';

// dropzone — зона drag-and-drop, тот же контракт значения (registry FileUploadDropzone).
export {
  FileUploadDropzone,
  type FileUploadDropzoneProps,
} from './variants/dropzone/file-upload-dropzone';

// input — компактный инпут с кнопкой-иконкой, тот же контракт значения (registry FileUploadInput).
export { FileUploadInput, type FileUploadInputProps } from './variants/input/file-upload-input';

// avatar — single-изображение с превью (отдельный контракт значения, registry FileUploadAvatar).
export {
  FileUploadAvatar,
  fileUploadSingleAdapter,
  type FileUploadAvatarProps,
} from './variants/avatar/file-upload-avatar';

// props-схемы.
export { fileUploadBasePropsSchema } from './variants/base/file-upload-base.props';
export { fileUploadDropzonePropsSchema } from './variants/dropzone/file-upload-dropzone.props';
export { fileUploadInputPropsSchema } from './variants/input/file-upload-input.props';
export { fileUploadAvatarPropsSchema } from './variants/avatar/file-upload-avatar.props';
