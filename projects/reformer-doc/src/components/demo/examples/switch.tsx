import { SwitchField, switchBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const switchDocConfig: ComponentDocConfig = {
  name: 'Switch',
  importFrom: '@reformer/ui-kit',
  description:
    'Переключатель on/off на Radix (button role=switch). Значение — boolean. Для форм — SwitchField с inline-раскладкой: подпись рисуется справа из componentProps.label, верхнюю метку FormField не дублирует.',
  variants: [
    {
      id: 'basic',
      title: 'Переключатель on/off',
      description: 'Значение — boolean. По умолчанию выключен (false); подпись справа из label.',
      render: makeFieldVariant({
        initial: false,
        component: SwitchField,
        componentProps: { label: 'Push-уведомления' },
      }),
      code: `{
  value: model.$.notifications,
  component: SwitchField,
  componentProps: { label: 'Push-уведомления' },
}`,
    },
    {
      id: 'checked',
      title: 'Включён по умолчанию',
      description: 'initial: true — переключатель в положении «включено».',
      render: makeFieldVariant({
        initial: true,
        component: SwitchField,
        componentProps: { label: 'Автосохранение' },
      }),
      code: `{
  value: model.$.autosave, // initial: true
  component: SwitchField,
  componentProps: { label: 'Автосохранение' },
}`,
    },
  ],
  examples: [
    {
      id: 'no-label',
      title: 'Без подписи (метка снаружи)',
      description:
        'Без label контрол рендерит только сам переключатель — подпись остаётся на потребителе.',
      render: makeFieldVariant({
        initial: true,
        component: SwitchField,
        componentProps: {},
      }),
      code: `componentProps: {} // подпись рисуется рядом вручную`,
    },
    {
      id: 'validation',
      title: 'Обязательное включение (валидатор)',
      description:
        'required() на boolean требует значение true. touched-поле в положении «выкл» показывает ошибку.',
      render: makeFieldVariant({
        initial: false,
        component: SwitchField,
        componentProps: { label: 'Согласен с условиями' },
        validators: [required({ message: 'Необходимо принять условия' })],
        touched: true,
      }),
      code: `{
  value: model.$.agree,
  component: SwitchField,
  componentProps: { label: 'Согласен с условиями' },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.agree, [required({ message: 'Необходимо принять условия' })]);`,
    },
  ],
  api: {
    component: SwitchField,
    initialValue: false,
    baseComponentProps: { label: 'Push-уведомления' },
    valuePresets: [
      { label: 'Включить (true)', value: true },
      { label: 'Выключить (false)', value: false },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label задаётся baseComponentProps (иначе перетрёт initialValues undefined-ом).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(switchBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.notifications,
  component: SwitchField,
  componentProps: {
    label: 'Push-уведомления',${v.required ? '\n    required: true,' : ''}
  },
}`,
  },
};
