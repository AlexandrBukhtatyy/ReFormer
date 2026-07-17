import { InputPasswordField, inputPasswordBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, minLength } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

/**
 * InputPassword — form-control (ReFormer-custom, не shadcn): поле пароля с тумблером видимости
 * (eye/eye-off). Value-based (`string | null`); тумблер появляется при непустом значении.
 */
export const inputPasswordDocConfig: ComponentDocConfig = {
  name: 'InputPassword',
  importFrom: '@reformer/ui-kit',
  description:
    'Поле ввода пароля с переключателем видимости (иконка eye/eye-off). Значение — string | null (пустой ввод → null). Иконка показывается при showToggle (по умолчанию) и непустом value.',
  variants: [
    {
      id: 'with-toggle',
      title: 'С переключателем видимости',
      description:
        'showToggle по умолчанию true — иконка eye/eye-off появляется при непустом значении.',
      render: makeFieldVariant({
        initial: '',
        component: InputPasswordField,
        componentProps: { label: 'Пароль', placeholder: 'Введите пароль' },
      }),
      code: `{
  value: model.$.password,
  component: InputPasswordField,
  componentProps: { label: 'Пароль', placeholder: 'Введите пароль' },
}`,
    },
    {
      id: 'no-toggle',
      title: 'Без переключателя (подтверждение пароля)',
      description: 'showToggle=false скрывает иконку — например, для поля «Повторите пароль».',
      render: makeFieldVariant({
        initial: '',
        component: InputPasswordField,
        componentProps: {
          label: 'Повторите пароль',
          placeholder: 'Повторите пароль',
          showToggle: false,
        },
      }),
      code: `{
  value: model.$.confirmPassword,
  component: InputPasswordField,
  componentProps: { label: 'Повторите пароль', showToggle: false },
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Валидатор required + minLength',
      description:
        'validators прямо в ноде схемы; touched-поле с пустым/коротким паролем показывает ошибку.',
      render: makeFieldVariant({
        initial: '',
        component: InputPasswordField,
        componentProps: { label: 'Пароль' },
        validators: [
          required({ message: 'Укажите пароль' }),
          minLength(8, { message: 'Минимум 8 символов' }),
        ],
        touched: true,
      }),
      code: `{
  value: model.$.password,
  component: InputPasswordField,
  componentProps: { label: 'Пароль' },
  validators: [required(), minLength(8)],
}`,
    },
  ],
  api: {
    component: InputPasswordField,
    initialValue: '',
    baseComponentProps: { label: 'Пароль' },
    validators: [required({ message: 'Обязательно' })],
    valuePresets: [
      { label: 'secret42', value: 'secret42' },
      { label: 'Очистить', value: '' },
    ],
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(inputPasswordBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.password,
  component: InputPasswordField,
  componentProps: {
    label: 'Пароль',
    placeholder: '${v.placeholder}',
    showToggle: ${v.showToggle},${v.required ? '\n    required: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
