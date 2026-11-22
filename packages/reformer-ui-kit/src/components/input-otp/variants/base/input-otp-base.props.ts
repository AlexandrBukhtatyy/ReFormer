import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема InputOTP — единый источник `api.controls[]` (reformer-doc) и DSL-валидации
 * `componentProps` (renderer-json). Поверхность в DSL — `maxLength`/`pattern`/`inputMode`/`className`;
 * `additionalProperties: false` ловит опечатки (враппер подмешивает label/required/…).
 *
 * `x-registryName: 'InputOTP'` → экспорт `InputOTPDefault` (`x-exportName`).
 */
export const inputOtpBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputOTP',
  'x-exportName': 'InputOTPDefault',
  'x-variantGroup': 'Input',
  'x-variant': 'OTP',
  properties: {
    maxLength: {
      type: 'number',
      default: 6,
      minimum: 1,
      description:
        'Число слотов (длина кода). Дефолтная раскладка разворачивает одну группу из maxLength слотов.',
      'x-doc': { group: 'Behavior', type: 'number' },
    },
    pattern: {
      type: 'string',
      description:
        'Допустимые символы — источник регулярного выражения для всего кода: ^\\d+$ — только цифры (REGEXP_ONLY_DIGITS), ^[a-zA-Z0-9]+$ — цифры и латиница. Не задан — любой символ.',
      'x-doc': { group: 'Behavior', type: 'string' },
    },
    inputMode: {
      type: 'string',
      enum: ['numeric', 'text', 'tel', 'decimal', 'email', 'url', 'search', 'none'],
      default: 'numeric',
      description: 'Экранная клавиатура мобильных устройств.',
      'x-doc': {
        group: 'Behavior',
        type: "'numeric' | 'text' | 'tel' | 'decimal' | 'email' | 'url' | 'search' | 'none'",
        kind: 'enum',
      },
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
    onComplete: {
      group: 'Behavior',
      type: '(value: string) => void',
      description:
        'Код набран целиком (заполнены все maxLength слотов). Функция — в JSON-форме недостижима, передаётся через реестр компонентов или schema-first.',
    },
  },
} as const satisfies PropsSchema;
