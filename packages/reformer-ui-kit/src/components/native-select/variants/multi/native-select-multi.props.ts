import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема NativeSelectMulti — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). `additionalProperties: false` ловит опечатки.
 *
 * `x-registryName: 'NativeSelectMulti'` — отдельная запись каталога, а не проп у `NativeSelect`:
 * тип значения другой (`string[] | null` против `string | null`), а `x-runtimeProps.value` у
 * записи ровно один. Прецедент — `FileUpload` / `FileUploadAvatar`.
 *
 * `placeholder` отсутствует НАМЕРЕННО: у одиночного варианта это `<option value="">` в начале
 * списка, а в multiple-листбоксе такая опция становится выбираемым мусорным пунктом. Это
 * единственное вынужденное расхождение с общим набором пропсов мультивыборов кита.
 */
export const nativeSelectMultiPropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'NativeSelectMulti',
  'x-variantGroup': 'NativeSelect',
  'x-variant': 'Несколько',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'label'],
        additionalProperties: false,
        properties: {
          value: { type: ['string', 'number'] },
          label: { type: 'string' },
          group: { type: 'string' },
        },
      },
      description:
        'Опции списка. Строятся в <option> (сериализуемый источник для формы/DSL); одинаковый group объединяется в <optgroup>.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label; group? }>', kind: 'readonly' },
    },
    rows: {
      type: 'number',
      minimum: 2,
      description:
        'Число видимых строк (нативный атрибут size). По умолчанию браузер показывает 4. Назван rows, а не size: size в ките — ступень шкалы размеров.',
      'x-doc': { group: 'Control', type: 'number' },
    },
    maxItems: {
      type: 'number',
      minimum: 1,
      description:
        'Потолок числа выбранных: по достижении невыбранные опции выключаются. Подсказка интерфейса, а не правило формы — ограничение задавайте валидатором maxLength(n).',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс поля.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string[] | null',
      description:
        'Выбранные значения (option.value как строки). Пустой выбор приходит как null, а не []: массив в начальном значении модели создал бы ArrayNode, и поля не было бы вовсе.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string[] | null) => void',
      description: 'Изменение выбора; снятие всех вариантов → null.',
    },
  },
} as const satisfies PropsSchema;
