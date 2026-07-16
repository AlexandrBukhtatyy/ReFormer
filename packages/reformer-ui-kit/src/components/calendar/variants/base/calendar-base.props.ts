import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Calendar (field-версия single-date) — единый источник `api.controls[]` (reformer-doc)
 * и DSL-валидации `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `value`/`onChange` — seam (маппятся адаптером на `selected`/`onSelect`), поэтому в `x-runtimeProps`,
 * а не в `properties`. `x-registryName: 'Calendar'` — на этот вариант смотрит алиас `CalendarField`.
 */
export const calendarBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Calendar',
  properties: {
    mode: {
      type: 'string',
      enum: ['single'],
      default: 'single',
      description: 'Режим выбора. Field-версия — только single (одна дата, value: Date | null).',
      'x-doc': { group: 'Behavior', type: "'single'", kind: 'enum' },
    },
    captionLayout: {
      type: 'string',
      enum: ['label', 'dropdown', 'dropdown-months', 'dropdown-years'],
      default: 'label',
      description: 'Шапка месяца: статичная подпись или дропдауны выбора месяца/года.',
      'x-doc': {
        group: 'Behavior',
        type: "'label' | 'dropdown' | 'dropdown-months' | 'dropdown-years'",
        kind: 'enum',
      },
    },
    showOutsideDays: {
      type: 'boolean',
      default: true,
      description: 'Показывать дни соседних месяцев в первой и последней неделе.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс корневого элемента.',
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
      description: 'Выбор даты. Повторный клик по выбранной дате сбрасывает значение в null.',
    },
  },
} as const satisfies PropsSchema;
