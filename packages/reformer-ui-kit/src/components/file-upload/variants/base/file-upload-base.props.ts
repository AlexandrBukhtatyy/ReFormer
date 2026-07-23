import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема варианта `file-upload/base` — единый источник `api.controls[]`
 * (reformer-doc) и DSL-валидации `componentProps` (renderer-json).
 *
 * `x-registryName: 'FileUpload'` — на это имя смотрит диспетчер `FileUploadField`
 * (варианты `button`/`dropzone` — один контракт, разный визуал).
 */
export const fileUploadBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'FileUpload',
  properties: {
    variant: {
      type: 'string',
      enum: ['button', 'dropzone', 'input'],
      default: 'button',
      description:
        'Представление: кнопка-триггер, зона drag-and-drop или компактный инпут с кнопкой-иконкой.',
      'x-doc': { group: 'Control', type: "'button' | 'dropzone' | 'input'" },
    },
    placeholder: {
      type: 'string',
      description:
        'Видимый текст кнопки (button), зоны (dropzone) или пустого инпута (input). Подпись поля — отдельная конвенция label (рендерит FormField).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    invalid: {
      type: 'boolean',
      default: false,
      description:
        'Явно пометить поле невалидным (подсветка рамки у dropzone/input). Под FormField не нужен: aria-invalid приходит от обёртки при ошибке валидации; button показывает ошибку текстом (FormField.Error).',
      'x-doc': { group: 'State', type: 'boolean' },
    },
    hint: {
      type: 'string',
      description: 'Подсказка с ограничениями («PDF, до 5 МБ, максимум 3 файла»).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    accept: {
      type: 'string',
      description:
        'Допустимые типы в синтаксисе нативного accept: ".pdf", "image/png", "image/*", список через запятую. Применяется и к drag-and-drop.',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    multiple: {
      type: 'boolean',
      default: false,
      description: 'Несколько файлов. При false новая селекция заменяет текущую.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    maxFiles: {
      type: 'number',
      minimum: 1,
      description: 'Максимум файлов в списке (действует при multiple).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    maxFileSize: {
      type: 'number',
      minimum: 0,
      description: 'Максимальный размер одного файла, байты.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    minFileSize: {
      type: 'number',
      minimum: 0,
      description: 'Минимальный размер одного файла, байты (1 — отсев пустых).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    maxTotalFileSize: {
      type: 'number',
      minimum: 0,
      description: 'Максимальный суммарный размер всех файлов, байты.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    preventDuplicates: {
      type: 'boolean',
      default: true,
      description: 'Отклонять дубликаты (совпадение имени и размера).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    allowDrop: {
      type: 'boolean',
      default: true,
      description: 'Принимать drag-and-drop на зоне.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    allowPaste: {
      type: 'boolean',
      default: false,
      description: 'Принимать файлы из буфера обмена (paste на сфокусированной зоне).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    capture: {
      type: 'string',
      enum: ['user', 'environment'],
      description: 'Источник камеры для мобильного пикера (фронтальная/тыловая).',
      'x-doc': { group: 'Behavior', type: "'user' | 'environment'" },
    },
    autoUpload: {
      type: 'boolean',
      default: true,
      description: 'Автозагрузка принятых файлов (действует при заданном uploader).',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (value/onChange/onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'File[] | RemoteFileRef[] | null',
      description:
        'Выбранные файлы. Без uploader — File[]; с uploader — сериализуемые дескрипторы загруженных. null — пусто.',
    },
    onChange: {
      group: 'Control',
      type: '(value: File[] | RemoteFileRef[] | null) => void',
      description: 'Изменение списка; пустой список приходит как null.',
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
      description: 'Файлы, отклонённые отбором (в значение поля не попадают).',
    },
  },
} as const satisfies PropsSchema;
