import { InputMaskField, inputMaskBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const inputMaskDocConfig: ComponentDocConfig = {
  name: 'InputMask',
  importFrom: '@reformer/ui-kit',
  description:
    'Текстовое поле с маской-подсказкой поверх shadcn Input. Шаблон mask показывается в placeholder (символ «9» = цифра, прочие символы — литералы); автовставки литералов нет — компонент помечает формат. Значение — string | null (пустой ввод → null). Для форм — InputMaskField.',
  variants: [
    {
      id: 'phone',
      title: 'Маска телефона',
      description:
        "mask='+7 (999) 999-99-99'. placeholder подсвечивает формат, значение — string | null.",
      render: makeFieldVariant({
        initial: '',
        component: InputMaskField,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
      }),
      code: `{
  value: model.$.phone,
  component: InputMaskField,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
}`,
    },
    {
      id: 'date',
      title: 'Маска даты',
      description: "mask='99.99.9999' с собственным placeholder — формат DD.MM.YYYY.",
      render: makeFieldVariant({
        initial: '',
        component: InputMaskField,
        componentProps: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
      }),
      code: `{
  value: model.$.birthDate,
  component: InputMaskField,
  componentProps: { label: 'Дата рождения', mask: '99.99.9999', placeholder: 'ДД.ММ.ГГГГ' },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Валидатор required',
      description:
        'validator прямо в ноде схемы; touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: '',
        component: InputMaskField,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        validators: [required({ message: 'Укажите телефон' })],
        touched: true,
      }),
      code: `{
  value: model.$.phone,
  component: InputMaskField,
  componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
  validators: [required()],
}`,
    },
  ],
  api: {
    component: InputMaskField,
    initialValue: '',
    baseComponentProps: { label: 'Телефон' },
    validators: [required({ message: 'Обязательно' })],
    valuePresets: [
      { label: '+7 (900) 000-00-00', value: '+7 (900) 000-00-00' },
      { label: 'Очистить', value: '' },
    ],
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(inputMaskBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.value,
  component: InputMaskField,
  componentProps: {
    label: 'Телефон',
    mask: '${v.mask}',${v.placeholder ? `\n    placeholder: '${v.placeholder}',` : ''}${v.required ? '\n    required: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
