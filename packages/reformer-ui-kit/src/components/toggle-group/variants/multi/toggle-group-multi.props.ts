import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема ToggleGroupMulti — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'ToggleGroupMulti'` — отдельная запись каталога, а не проп у `ToggleGroup`:
 * тип значения другой (`string[] | null` против `string | null`), а `x-runtimeProps.value` у
 * записи ровно один. Прецедент — `FileUpload` / `FileUploadAvatar`.
 *
 * `x-variantGroup: 'ToggleGroup'` (без `x-variant`-совпадения с именем) делает запись НЕдефолтным
 * членом группы: дефолт — тот, чей `x-registryName === x-variantGroup`.
 */
export const toggleGroupMultiPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'ToggleGroupMulti',
  'x-variantGroup': 'ToggleGroup',
  'x-variant': 'Несколько',
  properties: {
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
      description: 'Варианты выбора. Каждый рендерится как кнопка-переключатель.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label }>', kind: 'readonly' },
    },
    maxItems: {
      type: 'number',
      minimum: 1,
      description:
        'Потолок числа выбранных: по достижении невыбранные кнопки выключаются. Подсказка интерфейса, а не правило формы — ограничение задавайте валидатором maxLength(n).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    variant: {
      type: 'string',
      enum: ['default', 'outline'],
      default: 'default',
      description: 'Визуальный стиль кнопок: плоские (default) или с рамкой (outline).',
      'x-doc': { group: 'Control', type: "'default' | 'outline'" },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс контейнера группы.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
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
      description: 'Изменение выбора; снятие последнего варианта → null.',
    },
  },
} as const satisfies PropsSchema;
