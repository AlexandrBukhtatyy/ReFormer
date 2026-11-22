import type { PropsSchema } from '@/fields/props-schema';

/**
 * Props-схема `Progress` — единый источник `api`/props (reformer-doc) и валидации
 * `componentProps` (renderer-json). `Progress` — обёртка над Radix `Progress.Root` (Root+Indicator),
 * презентационный индикатор, не form-control: нет seam (`value`/`onChange`/`onBlur`/`disabled`),
 * поэтому нет `x-runtimeProps`. `value` здесь — статичный проп отображения (не редактируемое
 * значение поля). Сериализуемые пропсы — `className`, `value`, `max`.
 *
 * `additionalProperties: false` ловит опечатки в DSL.
 * `x-registryName: 'Progress'` — каноническое имя в реестре renderer-json.
 */
export const progressBasePropsSchema = {
  type: 'object',
  additionalProperties: false,
  'x-registryName': 'Progress',
  properties: {
    className: {
      type: 'string',
      description: 'CSS-класс дорожки прогресса (Tailwind).',
      'x-doc': { group: 'Control', type: 'string', kind: 'readonly' },
    },
    value: {
      type: 'number',
      minimum: 0,
      description:
        'Текущее значение от 0 до `max`. Не задано (или вне шкалы) — прогресс неопределённый: ' +
        'полоса пустая, `data-state="indeterminate"`, без `aria-valuenow`.',
      'x-doc': { group: 'State', type: 'number', kind: 'number' },
    },
    max: {
      type: 'number',
      minimum: 1,
      default: 100,
      description:
        'Максимальное значение шкалы (по умолчанию 100): заливка — доля `value / max`, ' +
        'скринридер получает `aria-valuemax` и процент в `aria-valuetext`.',
      'x-doc': { group: 'State', type: 'number', kind: 'number' },
    },
  },
} as const satisfies PropsSchema;
