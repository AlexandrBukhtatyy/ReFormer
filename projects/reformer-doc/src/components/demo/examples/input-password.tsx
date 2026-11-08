import { InputPassword, inputPasswordBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, minLength } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Пропсы панели API — из props-схемы компонента. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(inputPasswordBasePropsSchema), {
  omit: ['label'],
});

export const inputPasswordDocConfig: ComponentDocConfig = {
  name: 'InputPassword',
  importFrom: '@reformer/ui-kit',
  description:
    'Поле пароля с кнопкой «показать / скрыть». Значение — string | null: пустой ввод даёт null.',
  variants: [
    fieldVariant({
      id: 'with-toggle',
      title: 'С кнопкой «показать»',
      description:
        'showToggle включён по умолчанию. Кнопка-глаз появляется, как только в поле есть текст.',
      field: 'password',
      component: InputPassword,
      componentName: 'InputPassword',
      initial: '',
      props: { label: 'Пароль', placeholder: 'Введите пароль' },
    }),
    fieldVariant({
      id: 'no-toggle',
      title: 'Без кнопки',
      description: 'showToggle: false — например, для поля «Повторите пароль».',
      field: 'confirmPassword',
      component: InputPassword,
      componentName: 'InputPassword',
      initial: '',
      props: { label: 'Повторите пароль', placeholder: 'Повторите пароль', showToggle: false },
    }),
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Правила required и minLength',
      description:
        'Правила живут в схеме валидации, а не в узле поля. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'password',
      component: InputPassword,
      componentName: 'InputPassword',
      initial: 'qwerty',
      showInitial: true,
      props: { label: 'Пароль', required: true, description: 'Не меньше 8 символов' },
      validators: [
        required({ code: 'password.required' }),
        minLength(8, { code: 'password.minLength' }),
      ],
      rules:
        "required({ code: 'password.required' }), minLength(8, { code: 'password.minLength' })",
      messages: {
        'password.required': 'Придумайте пароль',
        'password.minLength': 'Пароль короче 8 символов',
      },
      touched: true,
    }),
  ],
  api: {
    component: InputPassword,
    initialValue: '',
    baseComponentProps: { label: 'Пароль' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Обязательно' },
    valuePresets: [
      { label: 'secret42', value: 'secret42' },
      { label: 'Очистить', value: '' },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'password',
        component: 'InputPassword',
        props: { label: 'Пароль' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
