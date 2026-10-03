import type { PropsSchema } from '@/fields/props-schema';
import { messageDefault } from '@/i18n/message-default';
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
  properties: {
    ...fileUploadSharedProperties,
    placeholder: {
      ...fileUploadSharedProperties.placeholder,
      ...messageDefault('kit.fileUpload.dropzone'),
    },
  },
  'x-runtimeProps': fileUploadSharedRuntimeProps,
} as const satisfies PropsSchema;
