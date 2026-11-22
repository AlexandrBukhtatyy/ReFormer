// Main compound component
export { FileUpload, type FileUploadComponent } from './FileUpload';

// Sub-components (also available as FileUpload.Trigger, etc.)
export { FileUploadRoot, type FileUploadRootProps } from './FileUploadRoot';
export { FileUploadTrigger, type FileUploadTriggerProps } from './FileUploadTrigger';
export { FileUploadDropzone, type FileUploadDropzoneProps } from './FileUploadDropzone';
export { FileUploadItemGroup, type FileUploadItemGroupProps } from './FileUploadItemGroup';
export { FileUploadItem, type FileUploadItemProps } from './FileUploadItem';
export { FileUploadItemPreview, type FileUploadItemPreviewProps } from './FileUploadItemPreview';
export { FileUploadItemName, type FileUploadItemNameProps } from './FileUploadItemName';
export { FileUploadItemSize, type FileUploadItemSizeProps } from './FileUploadItemSize';
export { FileUploadItemProgress, type FileUploadItemProgressProps } from './FileUploadItemProgress';
export {
  FileUploadItemDeleteTrigger,
  type FileUploadItemDeleteTriggerProps,
} from './FileUploadItemDeleteTrigger';
export {
  FileUploadItemRetryTrigger,
  type FileUploadItemRetryTriggerProps,
} from './FileUploadItemRetryTrigger';
export { FileUploadClearTrigger, type FileUploadClearTriggerProps } from './FileUploadClearTrigger';

// Hook
export { useFileUpload } from './useFileUpload';

// Context and hooks
export {
  FileUploadContext,
  useFileUploadContext,
  FileUploadItemContext,
  useFileUploadItemContext,
  type FileUploadContextValue,
  type FileUploadItemContextValue,
} from './FileUploadContext';

// Pure state core (React-free) — переиспользуется в тестах и своих обёртках
export {
  fileUploadReducer,
  initialFileUploadState,
  selectFiles,
  projectValue,
  reconcileItems,
  fileItemKey,
  formatFileSize,
  makeFileError,
  type FileUploadState,
  type FileUploadAction,
  type SelectFilesOptions,
  type SelectFilesResult,
} from './file-upload-core';

// Types
export type {
  RemoteFileRef,
  FileError,
  FileRejection,
  FileUploadItem as FileUploadItemData,
  FileUploadValue,
  FileUploadUploader,
  UseFileUploadOptions,
  FileUploadHandle,
} from './types';

export type {
  UseFileUploadReturn,
  FileUploadIds,
  FileUploadRootPropGetters,
  FileUploadDropzonePropGetters,
} from './useFileUpload';
