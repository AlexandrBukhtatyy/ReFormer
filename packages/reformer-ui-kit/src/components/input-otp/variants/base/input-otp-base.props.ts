import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема InputOTP — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Реальная поверхность в DSL — 2 ключа (`maxLength`/`className`);
 * `additionalProperties: false` ловит опечатки (враппер подмешивает label/required/…).
 *
 * `x-registryName: 'InputOTP'` — на этот вариант смотрит алиас `InputOTPField`.
 */
export const inputOtpBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputOTP',
  properties: {
    maxLength: {
      type: 'number',
      default: 6,
      minimum: 1,
      description:
        'Число слотов (длина кода). Дефолтная раскладка разворачивает одну группу из maxLength слотов.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс скрытого input.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (value/onChange/onBlur/disabled) подмешает mergeFieldPropsSchema.
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Набранный код. null — пусто.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение кода. Пустой ввод → null.',
    },
  },
} as const satisfies PropsSchema;
