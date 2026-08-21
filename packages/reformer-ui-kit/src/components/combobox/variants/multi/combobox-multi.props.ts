import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема ComboboxMulti — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'ComboboxMulti'` — отдельная запись каталога, а не проп `multiple` у
 * `Combobox`: тип значения другой (`string[] | null` против `string | null`), а
 * `x-runtimeProps.value` у записи ровно один. Прецедент — `FileUpload` / `FileUploadAvatar`.
 */
export const comboboxMultiPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'ComboboxMulti',
  'x-variantGroup': 'Combobox',
  'x-variant': 'Несколько',
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
      default: 'Select options...',
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
      description: 'Показывать крестик сброса всего выбора справа от триггера.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    creatable: {
      type: 'boolean',
      default: false,
      description:
        'Разрешить ввести своё значение: при отсутствии совпадения — пункт «Создать», добавляющий введённое в выбор. Лейблом для него служит само значение.',
      'x-doc': { group: 'Behavior', type: 'boolean' },
    },
    maxItems: {
      type: 'number',
      minimum: 1,
      description:
        'Потолок числа выбранных: по достижении невыбранные пункты выключаются. Подсказка интерфейса, а не правило формы — ограничение задавайте валидатором maxLength(n).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    summaryThreshold: {
      type: 'number',
      minimum: 1,
      default: 3,
      description:
        'Сколько чипов показать в триггере, прежде чем схлопнуть их в сводку «Выбрано: N».',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string[] | null',
      description:
        'Выбранные значения (option.value). Пустой выбор приходит как null, а не []: массив в начальном значении модели создал бы ArrayNode, и поля не было бы вовсе.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string[] | null) => void',
      description: 'Изменение выбора; снятие последнего значения → null.',
    },
  },
} as const satisfies PropsSchema;
