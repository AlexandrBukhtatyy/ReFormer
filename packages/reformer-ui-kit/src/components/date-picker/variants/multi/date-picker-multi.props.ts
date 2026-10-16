import type { PropsSchema } from '@/fields/props-schema';
import { messageDefault } from '@/i18n/message-default';

/**
 * Props-схема DatePickerMulti — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'DatePickerMulti'` — отдельная запись каталога, а не проп `mode` у `DatePicker`:
 * тип значения другой (`Date[] | null` против `Date | null`), а `x-runtimeProps.value` у записи
 * ровно один. Прецедент — `SelectMulti`.
 */
export const datePickerMultiPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'DatePickerMulti',
  'x-variantGroup': 'DatePicker',
  'x-variant': 'Несколько',
  properties: {
    placeholder: {
      type: 'string',
      ...messageDefault('kit.datePicker.placeholderMulti'),
      description: 'Текст кнопки-триггера, когда даты не выбраны.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    dateFormat: {
      type: 'string',
      description:
        'Формат дат — токены date-fns (напр. dd.MM.yyyy). Без него — dateFormat локали, ' +
        'а без того — по правилам языка (Intl, dateStyle medium).',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    numberOfMonths: {
      type: 'number',
      minimum: 1,
      default: 1,
      description: 'Сколько месяцев календаря показывать рядом.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    maxItems: {
      type: 'number',
      minimum: 1,
      description:
        'Потолок числа выбранных дат: по достижении невыбранные дни выключаются. Подсказка ' +
        'интерфейса, а не правило формы — ограничение задавайте валидатором maxLength(n).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    summaryThreshold: {
      type: 'number',
      minimum: 1,
      default: 3,
      description:
        'Сколько дат перечислить в кнопке-триггере, прежде чем схлопнуть их в сводку «Dates selected: N».',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    clearable: {
      type: 'boolean',
      default: false,
      description: 'Крестик сброса всех дат у правого края кнопки-триггера.',
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
      type: 'Date[] | null',
      description:
        'Выбранные даты по возрастанию. Пустой выбор контрол отдаёт как null: поле-массив ' +
        '(Date[], начальное []) сохранит его как [], nullable-поле (Date[] | null) — как null.',
    },
    onChange: {
      group: 'Control',
      type: '(value: Date[] | null) => void',
      description: 'Клик по дню добавляет его, повторный — снимает; снятие последней даты → null.',
    },
  },
} as const satisfies PropsSchema;
