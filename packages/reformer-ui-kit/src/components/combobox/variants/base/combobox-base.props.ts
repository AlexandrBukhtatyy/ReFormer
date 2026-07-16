import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема Combobox (field-версия) — единый источник `api.controls[]` (reformer-doc) и
 * DSL-валидации `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `value`/`onChange` — seam (Combobox уже value-based), поэтому в `x-runtimeProps`, а не в
 * `properties`. `x-registryName: 'Combobox'` — на этот вариант смотрит алиас `ComboboxField`.
 */
export const comboboxBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Combobox',
  properties: {
    className: {
      type: 'string',
      description: 'Доп. CSS-класс триггера.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    options: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'label'],
        additionalProperties: false,
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
        },
      },
      description: 'Список опций { value, label }. Поиск идёт по label.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label }>', kind: 'readonly' },
    },
    placeholder: {
      type: 'string',
      default: 'Select an option...',
      description: 'Подсказка в триггере, пока ничего не выбрано.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    searchPlaceholder: {
      type: 'string',
      default: 'Search...',
      description: 'Подсказка в поле поиска.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    emptyText: {
      type: 'string',
      default: 'No options found.',
      description: 'Текст пустого состояния (ничего не найдено).',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    clearable: {
      type: 'boolean',
      default: false,
      description:
        'Показывать крестик очистки (сброс в null); повторный выбор опции тоже сбрасывает.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Выбранное значение (option.value). null — ничего не выбрано.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Выбор; при очистке приходит null.',
    },
  },
} as const satisfies PropsSchema;
