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
      id: 'empty',
      title: 'Пустое поле',
      description: 'Виден placeholder; иконка переключения появляется только после ввода.',
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
      id: 'filled',
      title: 'Заполнено, с переключателем',
      description: 'Маскированное значение и иконка eye для показа пароля.',
      render: makeFieldVariant({
        initial: 'secret123',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Пароль' },
      }),
      code: `{
  value: model.$.password,   // 'secret123'
  component: InputPassword,
  componentProps: { label: 'Пароль' },
}`,
    },
    {
      id: 'no-toggle',
      title: 'Без переключателя',
      description: 'showToggle={false} — паттерн поля «повторите пароль», без кнопки reveal.',
      render: makeFieldVariant({
        initial: 'secret123',
        component: InputPassword,
        componentProps: {
          label: 'Повторите пароль',
          placeholder: 'Повторите пароль',
          showToggle: false,
        },
      }),
      code: `componentProps: { label: 'Повторите пароль', showToggle: false }`,
    },
    {
      id: 'disabled',
      title: 'Disabled',
      description: 'Ввод и кнопка переключения заблокированы, поле приглушено.',
      render: makeFieldVariant({
        initial: 'secret123',
        component: InputPassword,
        componentProps: { label: 'Пароль' },
        disabled: true,
      }),
      code: `{
  value: model.$.password,
  component: InputPassword,
  componentProps: { label: 'Пароль' },
}
// form.password.disable()`,
    },
    {
      id: 'invalid',
      title: 'С ошибкой (invalid)',
      description: 'Рамка и ring destructive — состояние проваленной валидации.',
      render: makeFieldVariant({
        initial: '123',
        component: InputPassword,
        componentProps: { label: 'Пароль' },
        validators: [minLength(8)],
        touched: true,
      }),
      code: `{
  value: model.$.password,   // '123' — короче минимума
  component: InputPassword,
  componentProps: { label: 'Пароль' },
  validators: [minLength(8)],
}`,
    },
  ],
  examples: [
    {
      id: 'reveal',
      title: 'Переключение видимости пароля',
      description:
        'При непустом value кнопка eye переключает маскирование ↔ открытый текст. Управляется пропом showToggle (включён по умолчанию).',
      render: makeFieldVariant({
        initial: 'secret123',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Пароль', showToggle: true },
      }),
      code: `{
  value: model.$.password,
  component: InputPassword,
  // showToggle включён по умолчанию: клик по иконке eye
  // переключает type password ↔ text
  componentProps: { label: 'Пароль', showToggle: true },
}`,
    },
    {
      id: 'validation',
      title: 'Валидация: обязательность и минимальная длина',
      description: 'Привязка валидаторов ReFormer; провал включает invalid-состояние компонента.',
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
    {
      id: 'empty-to-null',
      title: 'Нормализация пустого значения в null',
      description:
        'Пустой ввод возвращает null, а не пустую строку — удобно для required и чистой form-data.',
      render: makeFieldVariant({
        initial: '',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Оставьте пустым' },
      }),
      code: `{
  value: model.$.password,
  component: InputPassword,
  componentProps: { label: 'Пароль' },
}
// Ввод, а затем очистка поля:
// model.$.password  →  null   (не '')`,
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
