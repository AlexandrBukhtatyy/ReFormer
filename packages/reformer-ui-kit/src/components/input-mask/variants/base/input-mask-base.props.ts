import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема InputMask. Реальная поверхность в DSL — `mask`/`placeholder`/`className`;
 * `value`/`onChange`/`onBlur`/`disabled` приходят из seam (`mergeFieldPropsSchema`).
 * `additionalProperties: false` ловит опечатки `componentProps`.
 * `x-registryName: 'InputMask'` — на этот вариант смотрит алиас `InputMaskField`.
 */
export const inputMaskBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'InputMask',
  properties: {
    mask: {
      type: 'string',
      description:
        "Шаблон маски-подсказки: '9' — цифра, прочие символы — литералы (уходят в placeholder). " +
        "Напр. '+7 (999) 999-99-99'. Автовставки литералов нет — компонент только помечает формат.",
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    placeholder: {
      type: 'string',
      description: 'Подсказка внутри поля. По умолчанию равна mask.',
      'x-doc': { group: 'Textfield', type: 'string' },
    },
    className: {
      type: 'string',
      description: 'Доп. CSS-класс.',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
  },
  'x-runtimeProps': {
    value: {
      group: 'Control',
      type: 'string | null',
      description: 'Значение поля. null/undefined → пустое поле.',
    },
    onChange: {
      group: 'Control',
      type: '(value: string | null) => void',
      description: 'Изменение. Пустой ввод → null.',
    },
  },
} as const satisfies PropsSchema;
