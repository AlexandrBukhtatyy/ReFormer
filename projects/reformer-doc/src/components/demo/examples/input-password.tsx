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
      id: 'with-toggle',
      title: 'С переключателем видимости',
      description:
        'Дефолтная форма: showToggle включён. При непустом value справа появляется кнопка eye/eye-off для показа пароля.',
      render: makeFieldVariant({
        initial: 'secret123',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Пароль' },
      }),
      code: `{
  value: model.$.password,
  component: InputPassword,
  // showToggle: true по умолчанию
  componentProps: { label: 'Пароль', placeholder: 'Пароль' },
}`,
    },
    {
      id: 'no-toggle',
      title: 'Без переключателя',
      description:
        'Форма showToggle={false} — паттерн поля «повторите пароль»: значение всегда маскировано, кнопки reveal нет.',
      render: makeFieldVariant({
        initial: 'secret123',
        component: InputPassword,
        componentProps: {
          label: 'Повторите пароль',
          placeholder: 'Повторите пароль',
          showToggle: false,
        },
      }),
      code: `{
  value: model.$.confirmPassword,
  component: InputPassword,
  componentProps: { label: 'Повторите пароль', showToggle: false },
}`,
    },
  ],
  examples: [
    {
      id: 'reveal',
      title: 'Переключение видимости пароля',
      description:
        'Приём reveal: при непустом value кнопка eye переключает маскирование ↔ открытый текст (type password ↔ text). Состояние показа локальное для компонента.',
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
      description:
        'Рецепт: привязка валидаторов ReFormer. На touched-поле провал включает invalid-состояние компонента (рамка и ring destructive).',
      render: makeFieldVariant({
        initial: '123',
        component: InputPassword,
        componentProps: { label: 'Пароль', placeholder: 'Минимум 8 символов' },
        validators: [required({ message: 'Введите пароль' }), minLength(8)],
        touched: true,
      }),
      code: `{
  value: model.$.password,   // '123' — короче минимума
  component: InputPassword,
  componentProps: { label: 'Пароль' },
  validators: [required({ message: 'Введите пароль' }), minLength(8)],
}`,
    },
    {
      id: 'empty-to-null',
      title: 'Нормализация пустого значения в null',
      description:
        "Приём: onChange приводит пустую строку к null, поэтому очищенное поле даёт null, а не '' — удобно для required и чистой form-data.",
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
