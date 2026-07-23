import { ToggleField, toggleBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

export const toggleDocConfig: ComponentDocConfig = {
  name: 'Toggle',
  importFrom: '@reformer/ui-kit',
  description:
    'Двухпозиционная кнопка на Radix (button + aria-pressed). Значение — boolean (pressed). В ОТЛИЧИЕ от Checkbox/Switch — НЕ inline-label: подпись поля рисует FormField сверху из componentProps.label, а контент кнопки (иконка/текст) задаётся через children. Стиль — variant (default/outline), размер — size.',
  variants: [
    {
      id: 'basic',
      title: 'Переключатель (нажат/отжат)',
      description: 'Значение — boolean. Контент кнопки — children; подпись поля — сверху из label.',
      render: makeFieldVariant({
        initial: false,
        component: ToggleField,
        componentProps: { label: 'Форматирование', children: 'Полужирный' },
      }),
      code: `{
  value: model.$.bold,
  component: ToggleField,
  componentProps: { label: 'Форматирование', children: 'Полужирный' },
}`,
    },
    {
      id: 'outline',
      title: 'Вариант outline, включён по умолчанию',
      description:
        'variant=outline (граница вместо заливки), initial: true — кнопка в положении «нажато».',
      render: makeFieldVariant({
        initial: true,
        component: ToggleField,
        componentProps: { label: 'Курсив', children: 'Курсив', variant: 'outline' },
      }),
      code: `{
  value: model.$.italic, // initial: true
  component: ToggleField,
  componentProps: { label: 'Курсив', children: 'Курсив', variant: 'outline' },
}`,
    },
  ],
  examples: [
    {
      id: 'sizes',
      title: 'Размеры (size: sm / default / lg)',
      description: 'size управляет высотой и минимальной шириной кнопки.',
      render: makeFieldVariant({
        initial: false,
        component: ToggleField,
        componentProps: { label: 'Подчёркнутый', children: 'U', size: 'lg' },
      }),
      code: `{
  value: model.$.underline,
  component: ToggleField,
  componentProps: { label: 'Подчёркнутый', children: 'U', size: 'lg' },
}`,
    },
    {
      id: 'validation',
      title: 'Обязательное нажатие (валидатор required)',
      description:
        'required() на boolean требует значение true. touched-поле в положении «отжато» показывает ошибку.',
      render: makeFieldVariant({
        initial: false,
        component: ToggleField,
        componentProps: { label: 'Подтверждение', children: 'Готово' },
        validators: [required({ message: 'Необходимо нажать' })],
        touched: true,
      }),
      code: `{
  value: model.$.confirmed,
  component: ToggleField,
  componentProps: { label: 'Подтверждение', children: 'Готово' },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.confirmed, [required({ message: 'Необходимо нажать' })]);`,
    },
  ],
  api: {
    component: ToggleField,
    initialValue: false,
    // children/label фиксированы (не управляются контролами): children несериализуем, label задаёт подпись.
    baseComponentProps: { label: 'Форматирование', children: 'Полужирный' },
    valuePresets: [
      { label: 'Нажат (true)', value: true },
      { label: 'Отжат (false)', value: false },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label задаётся baseComponentProps (иначе перетрёт initialValues undefined-ом).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(toggleBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.bold,
  component: ToggleField,
  componentProps: {
    label: 'Форматирование',
    children: 'Полужирный',
    variant: '${v.variant}',
    size: '${v.size}',${v.required ? '\n    required: true,' : ''}
  },
}`,
  },
};
