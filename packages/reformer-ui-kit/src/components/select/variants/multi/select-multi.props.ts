import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема SelectMulti — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'SelectMulti'` — отдельная запись каталога, а не проп у `Select`: тип значения
 * другой (`string[] | null` против `string | null`), а `x-runtimeProps.value` у записи ровно один.
 * Прецедент — `FileUpload` / `FileUploadAvatar`.
 *
 * Отдельной записи `SelectAsyncMulti` НЕ существует и существовать не может: `Select` и
 * `SelectAsync` — одна запись каталога (`x-registryName: 'Select'` стоит на `select-async.props.ts`,
 * а `SelectField` — алиас `SelectAsyncField`). Асинхронный источник, поиск и пагинация здесь —
 * это ПРОПСЫ (`resource`), а не отдельный вариант.
 */
export const selectMultiPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'SelectMulti',
  'x-variantGroup': 'Select',
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
          group: { type: 'string' },
        },
      },
      description:
        'Inline-опции. Взаимоисключающи с resource: если заданы — источник не опрашивается.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label; group? }>', kind: 'readonly' },
    },
    selectedOptions: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'label'],
        additionalProperties: false,
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
          group: { type: 'string' },
        },
      },
      description:
        'Лейблы для уже выбранных значений, которых может не быть в текущей странице опций (сменился поиск, догрузилась страница, перезагрузился источник). Без справочника чип показал бы сырой value.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label; group? }>', kind: 'readonly' },
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
      description: 'Подсказка в поле поиска (показывается при resource с серверным поиском).',
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
    resource: {
      group: 'Options',
      type: 'ResourceConfig<unknown>',
      description:
        'Асинхронный источник опций (static / preload / partial). В JSON-форме недостижим: требует функцию load.',
    },
  },
} as const satisfies PropsSchema;
