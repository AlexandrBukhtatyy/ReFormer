import { InputMask } from '@reformer/ui-kit';
import { required, pattern } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

export const inputMaskDocConfig: ComponentDocConfig = {
  name: 'InputMask',
  importFrom: '@reformer/ui-kit',
  description: 'Текстовое поле с маской-подсказкой. Символ «9» — цифра, остальное — литералы.',
  variants: [
    {
      id: 'phone',
      title: 'Телефон',
      description: 'Маска +7 (999) 999-99-99.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
      }),
      code: `{
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
}`,
    },
    {
      id: 'date',
      title: 'Дата',
      description: 'Маска 99.99.9999 с явным placeholder.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
      }),
      code: `componentProps: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' }`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Телефон с проверкой формата',
      description: 'Маска — только подсказка UI; формат проверяет валидатор pattern.',
      render: makeFieldVariant({
        initial: '',
        component: InputMask,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        validators: [
          required({ message: 'Введите телефон' }),
          pattern(/^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/, { message: 'Неверный формат' }),
        ],
      }),
      code: `{
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
  validators: [required(), pattern(/^\\+7 \\(\\d{3}\\) \\d{3}-\\d{2}-\\d{2}$/)],
}`,
    },
  ],
  api: {
    component: InputMask,
    initialValue: '',
    baseComponentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
    validators: [required({ message: 'Введите телефон' })],
    valuePresets: [{ label: 'Очистить', value: '' }],
    controls: [
      {
        prop: 'value',
        type: 'string | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Значение. null/undefined — пустое поле.',
      },
      {
        prop: 'onChange',
        type: '(value: string | null) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Пустая строка приводится к null.',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса.',
      },
      {
        prop: 'mask',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: '+7 (999) 999-99-99',
        description: 'Шаблон: «9» — цифра, остальные символы — литералы placeholder.',
      },
      {
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: '',
        description: 'Подсказка внутри поля.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует ввод.',
      },
    ],
    code: (v) => `{
  value: model.$.phone,
  component: InputMask,
  componentProps: { label: 'Телефон', mask: '${v.mask}'${v.placeholder ? `, placeholder: '${v.placeholder}'` : ''} },
  validators: [required()],
}${v.disabled ? '\n// form.phone.disable()' : ''}`,
  },
};
