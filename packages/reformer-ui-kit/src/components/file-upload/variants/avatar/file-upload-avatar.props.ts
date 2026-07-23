import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема варианта `file-upload/avatar` — single-изображение с превью.
 * Отдельное registry-имя: другой тип значения (`File | RemoteFileRef | null`
 * вместо массива) — другой seam-контракт.
 */
export const fileUploadAvatarPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'FileUploadAvatar',
  properties: {
    shape: {
      type: 'string',
      enum: ['circle', 'square'],
      default: 'circle',
      description: 'Форма превью.',
      'x-doc': { group: 'Control', type: "'circle' | 'square'" },
    },
    label: {
      type: 'string',
      default: 'Загрузить изображение',
      description: 'Доступное имя зоны (aria-label).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    accept: {
      type: 'string',
      default: 'image/*',
      description: 'Допустимые типы в синтаксисе нативного accept.',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    maxFileSize: {
      type: 'number',
      minimum: 0,
      description: 'Максимальный размер файла, байты.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    capture: {
      type: 'string',
      enum: ['user', 'environment'],
      description: 'Источник камеры для мобильного пикера.',
      'x-doc': { group: 'Behavior', type: "'user' | 'environment'" },
    },
    invalid: {
      type: 'boolean',
      default: false,
      description:
        'Явно пометить поле невалидным (подсветка рамки зоны). Под FormField не нужен: aria-invalid приходит от обёртки при ошибке валидации.',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    value: {
      group: 'Control',
      type: 'File | RemoteFileRef | null',
      description: 'Выбранное изображение (single). null — пусто.',
    },
    onChange: {
      group: 'Control',
      type: '(value: File | RemoteFileRef | null) => void',
      description: 'Выбор/замена/удаление изображения.',
    },
    uploader: {
      group: 'Behavior',
      type: '(file: File, ctx: { onProgress; signal }) => Promise<RemoteFileRef>',
      description:
        'Загрузчик immediate-режима. В JSON-форме недостижим: требует функцию — передаётся через реестр.',
    },
    onReject: {
      group: 'Behavior',
      type: '(rejections: FileRejection[]) => void',
      description: 'Файлы, отклонённые отбором.',
    },
  },
} as const satisfies PropsSchema;
