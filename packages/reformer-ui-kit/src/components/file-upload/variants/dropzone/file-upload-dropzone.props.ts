import type { PropsSchema } from '@/fields/props-schema';
import {
  fileUploadSharedProperties,
  fileUploadSharedRuntimeProps,
} from '../base/file-upload-base.props';

/**
 * Props-схема варианта `file-upload/dropzone` (registry `FileUploadDropzone`) — зона drag-and-drop. Контракт значения и
 * набор пропсов общие с `FileUpload` (кнопка-триггер), различается только визуал.
 */
export const fileUploadDropzonePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'FileUploadDropzone',
  'x-variantGroup': 'FileUpload',
  'x-variant': 'Зона',
  properties: fileUploadSharedProperties,
  'x-runtimeProps': fileUploadSharedRuntimeProps,
} as const satisfies PropsSchema;
