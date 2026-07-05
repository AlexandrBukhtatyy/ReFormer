import { InputPassword } from '@reformer/ui-kit';
import { required, minLength } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import type { ComponentDocConfig } from '../types';

export const inputPasswordDocConfig: ComponentDocConfig = {
  name: 'InputPassword',
  importFrom: '@reformer/ui-kit',
  description: 'Поле пароля с переключателем видимости (иконка eye/eye-off).',
  variants: [
    {
      id: 'basic',
      title: 'С переключателем',
      description: 'Иконка появляется, когда поле непустое.',
      render: makeFieldVariant({
        initial: '',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Пароль' },
      }),
      code: `{
  value: model.$.password,
  component: InputPassword,
  componentProps: { label: 'Пароль', placeholder: 'Пароль' },
}`,
    },
    {
      id: 'no-toggle',
      title: 'Без переключателя',
      description: 'showToggle={false} — например, для подтверждения пароля.',
      render: makeFieldVariant({
        initial: '',
        component: InputPassword,
        componentProps: {
          label: 'Повторите пароль',
          placeholder: 'Повторите пароль',
          showToggle: false,
        },
      }),
      code: `componentProps: { label: 'Повторите пароль', showToggle: false }`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Минимальная длина',
      render: makeFieldVariant({
        initial: '',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Минимум 8 символов' },
        validators: [required({ message: 'Введите пароль' }), minLength(8)],
      }),
      code: `{
  value: model.$.password,
  component: InputPassword,
  componentProps: { label: 'Пароль' },
  validators: [required(), minLength(8)],
}`,
    },
  ],
  api: {
    component: InputPassword,
    initialValue: '',
    baseComponentProps: { label: 'Пароль' },
    validators: [required({ message: 'Введите пароль' }), minLength(8)],
    valuePresets: [
      { label: 'Заполнить', value: 'secret123' },
      { label: 'Очистить', value: '' },
    ],
    controls: [
      {
        prop: 'value',
        type: 'string | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Значение пароля. null/undefined — пустое поле.',
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
        prop: 'placeholder',
        type: 'string',
        group: 'Textfield',
        kind: 'text',
        default: 'Пароль',
        description: 'Подсказка внутри поля.',
      },
      {
        prop: 'showToggle',
        type: 'boolean',
        group: 'Behavior',
        kind: 'boolean',
        default: true,
        description: 'Иконка переключения видимости (при непустом value).',
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
  value: model.$.password,
  component: InputPassword,
  componentProps: { label: 'Пароль', placeholder: '${v.placeholder}'${v.showToggle ? '' : ', showToggle: false'} },
  validators: [required(), minLength(8)],
}${v.disabled ? '\n// form.password.disable()' : ''}`,
  },
};
