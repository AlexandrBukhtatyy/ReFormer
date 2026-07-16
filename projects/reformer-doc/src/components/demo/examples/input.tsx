import { InputField, inputBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, min } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const inputDocConfig: ComponentDocConfig = {
  name: 'Input',
  importFrom: '@reformer/ui-kit',
  description:
    'Текстовое поле на pure shadcn Input. Вариант base — строковый; вариант number — числовой буфер (частичный ввод «1.», «-», ведущие нули). InputField диспетчеризует по type.',
  variants: [
    {
      id: 'text',
      title: 'Строковое поле',
      description: 'type=text/email/tel/url. Значение — string | null (пустой ввод → null).',
      render: makeFieldVariant({
        initial: '',
        component: InputField,
        componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      }),
      code: `{
  value: model.$.email,
  component: InputField,
  componentProps: { label: 'Email', type: 'email' },
}`,
    },
    {
      id: 'number',
      title: 'Числовое поле (буфер)',
      description:
        'type=number. Значение — number | null. Буфер сохраняет промежуточный ввод («1.», «0.05», «-»), который не эмитится до валидного числа.',
      render: makeFieldVariant({
        initial: null,
        component: InputField,
        componentProps: {
          label: 'Возраст',
          type: 'number',
          min: 0,
          placeholder: 'Введите возраст',
        },
      }),
      code: `{
  value: model.$.age,
  component: InputField,
  componentProps: { label: 'Возраст', type: 'number', min: 0 },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Валидатор required + min',
      description:
        'validators прямо в ноде схемы; touched-поле с пустым/малым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: InputField,
        componentProps: { label: 'Возраст', type: 'number', min: 18 },
        validators: [required({ message: 'Укажите возраст' }), min(18, { message: 'Минимум 18' })],
        touched: true,
      }),
      code: `{
  value: model.$.age,
  component: InputField,
  componentProps: { label: 'Возраст', type: 'number', min: 18 },
  validators: [required(), min(18)],
}`,
    },
  ],
  api: {
    component: InputField,
    initialValue: '',
    baseComponentProps: { label: 'Email' },
    validators: [required({ message: 'Обязательно' })],
    valuePresets: [
      { label: 'you@example.com', value: 'you@example.com' },
      { label: 'Очистить', value: '' },
    ],
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(inputBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.value,
  component: InputField,
  componentProps: {
    label: 'Email',
    type: '${v.type}',
    placeholder: '${v.placeholder}',${v.required ? '\n    required: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
