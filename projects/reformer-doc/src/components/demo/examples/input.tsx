import { Input, inputBasePropsSchema, InputNumber, InputSuggest } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, min } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const inputDocConfig: ComponentDocConfig = {
  name: 'Input',
  importFrom: '@reformer/ui-kit',
  description:
    'Текстовое поле на pure shadcn Input. Вариант base — Input (строка); вариант number — InputNumber (числовой буфер: частичный ввод «1.», «-», ведущие нули); вариант suggest — InputSuggest (свободный ввод с подсказками). Каждый кладётся в component поля как есть.',
  variants: [
    {
      id: 'text',
      title: 'Строковое поле',
      description: 'type=text/email/tel/url. Значение — string | null (пустой ввод → null).',
      render: makeFieldVariant({
        initial: '',
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      }),
      code: `{
  value: model.$.email,
  component: Input,
  componentProps: { label: 'Email', type: 'email' },
}`,
    },
    {
      id: 'number',
      title: 'Числовое поле (буфер)',
      description:
        'Отдельный компонент InputNumber (не Input с type=number). Значение — number | null. Буфер сохраняет промежуточный ввод («1.», «0.05», «-»), который не эмитится до валидного числа.',
      render: makeFieldVariant({
        initial: null,
        component: InputNumber,
        componentProps: {
          label: 'Возраст',
          min: 0,
          placeholder: 'Введите возраст',
        },
      }),
      code: `{
  value: model.$.age,
  component: InputNumber,
  componentProps: { label: 'Возраст', min: 0 },
}`,
    },
    {
      id: 'suggest',
      title: 'Подсказки при вводе',
      description:
        'Отдельный компонент InputSuggest (у Input пропа suggestions нет). Значение — введённый текст (string | null); подсказка лишь подставляет свой value.',
      render: makeFieldVariant({
        initial: null,
        component: InputSuggest,
        componentProps: { label: 'Город', suggestions: ['Москва', 'Казань', 'Новосибирск'] },
      }),
      code: `{
  value: model.$.city,
  component: InputSuggest,
  componentProps: { label: 'Город', suggestions: ['Москва', 'Казань', 'Новосибирск'] },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Валидатор required + min',
      description:
        'правила в validation-схеме (validate из @reformer/core/validation); touched-поле с пустым/малым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: InputNumber,
        componentProps: { label: 'Возраст', min: 18 },
        validators: [required({ message: 'Укажите возраст' }), min(18, { message: 'Минимум 18' })],
        touched: true,
      }),
      code: `{
  value: model.$.age,
  component: InputNumber,
  componentProps: { label: 'Возраст', min: 18 },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.age, [required(), min(18)]);`,
    },
  ],
  api: {
    component: Input,
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
  component: Input,
  componentProps: {
    label: 'Email',
    type: '${v.type}',
    placeholder: '${v.placeholder}',${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
