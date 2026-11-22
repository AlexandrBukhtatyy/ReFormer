import type { PropsSchema } from '@/fields/props-schema';
import { messageDefault } from '@/i18n/message-default';
import {
  fileUploadSharedProperties,
  fileUploadSharedRuntimeProps,
} from '../base/file-upload-base.props';

/**
 * Props-схема варианта `file-upload/input` (registry `FileUploadInput`) — компактный инпут с кнопкой-иконкой. Контракт значения и
 * набор пропсов общие с `FileUpload` (кнопка-триггер), различается только визуал.
 */
export const fileUploadInputPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'FileUploadInput',
  'x-variantGroup': 'FileUpload',
  'x-variant': 'Инпут',
  properties: {
    ...fileUploadSharedProperties,
    placeholder: {
      ...fileUploadSharedProperties.placeholder,
      ...messageDefault('kit.fileUpload.inputPlaceholder'),
    },
  },
  'x-runtimeProps': fileUploadSharedRuntimeProps,
} as const satisfies PropsSchema;
