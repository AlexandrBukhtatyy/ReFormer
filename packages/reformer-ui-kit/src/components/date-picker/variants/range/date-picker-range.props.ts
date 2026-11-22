import type { PropsSchema } from '@/fields/props-schema';
import { messageDefault } from '@/i18n/message-default';

/**
 * Props-схема DatePickerRange — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'DatePickerRange'` — отдельная запись каталога, а не проп `mode` у `DatePicker`:
 * тип значения другой (`[Date, Date] | null` против `Date | null`), а `x-runtimeProps.value` у
 * записи ровно один. Прецедент — `SelectMulti`.
 */
export const datePickerRangePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'DatePickerRange',
  'x-variantGroup': 'DatePicker',
  'x-variant': 'Период',
  properties: {
    placeholder: {
      type: 'string',
      ...messageDefault('kit.datePicker.placeholderRange'),
      description: 'Текст кнопки-триггера, когда период не выбран.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    dateFormat: {
      type: 'string',
      description:
        'Формат дат периода — токены date-fns (напр. dd.MM.yyyy). Без него — dateFormat локали, ' +
        'а без того — по правилам языка (Intl, dateStyle long).',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    numberOfMonths: {
      type: 'number',
      minimum: 1,
      default: 2,
      description: 'Сколько месяцев календаря показывать рядом.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    clearable: {
      type: 'boolean',
      default: false,
      description: 'Крестик сброса периода у правого края кнопки-триггера.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
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
      type: '[Date, Date] | null',
      description:
        'Выбранный период [начало, конец] включительно; однодневный — две одинаковые даты. ' +
        'Сброс контрол отдаёт как null: поле-кортеж (начальное [from, to]) сохранит его как [], ' +
        'nullable-поле (начальное null) — как null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: [Date, Date] | null) => void',
      description:
        'Выбор периода: зовётся, когда выбраны оба конца, либо с null при сбросе. Пока выбрано ' +
        'одно начало, значение поля не меняется.',
    },
  },
} as const satisfies PropsSchema;
