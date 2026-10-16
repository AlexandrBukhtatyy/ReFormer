import type { PropsSchema } from '@/fields/props-schema';
import { messageDefault } from '@/i18n/message-default';

/**
 * Props-схема DatePicker (single-date) — единый источник `api.controls[]` (reformer-doc)
 * и DSL-валидации `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `value`/`onChange` — seam (адаптер `datePickerAdapter` сворачивает `undefined` сброса в `null`),
 * поэтому в `x-runtimeProps`, а не в `properties`. `x-registryName: 'DatePicker'` — компонент
 * `DatePicker`.
 */
export const datePickerBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'DatePicker',
  properties: {
    placeholder: {
      type: 'string',
      ...messageDefault('kit.datePicker.placeholder'),
      description: 'Текст кнопки-триггера, когда дата не выбрана.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    dateFormat: {
      type: 'string',
      description:
        'Формат выбранной даты — токены date-fns (напр. dd.MM.yyyy). Без него — dateFormat локали, ' +
        'а без того — по правилам языка (Intl, dateStyle long).',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс кнопки-триггера.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'Date | null',
      description: 'Выбранная дата. null — ничего не выбрано.',
    },
    onChange: {
      group: 'Control',
      type: '(value: Date | null) => void',
      description: 'Выбор даты в календаре. Повторный клик по выбранной дате сбрасывает в null.',
    },
  },
} as const satisfies PropsSchema;
