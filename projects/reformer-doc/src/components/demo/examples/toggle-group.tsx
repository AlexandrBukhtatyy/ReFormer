import { ToggleGroupField, toggleGroupBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

const GENDER = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const PLAN = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

export const toggleGroupDocConfig: ComponentDocConfig = {
  name: 'ToggleGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Группа кнопок-переключателей на Radix (single-режим, контейнер role=radiogroup). Field-версия рендерит опции из массива options; значение — строка (option.value | null). Для форм — ToggleGroupField.',
  variants: [
    {
      id: 'default',
      title: 'Одиночный выбор (options)',
      description:
        'Плоский список опций через проп options. Значение — строка (value: string | null). variant по умолчанию — сплошные кнопки без рамки.',
      render: makeFieldVariant({
        initial: 'male',
        component: ToggleGroupField,
        componentProps: { label: 'Пол', options: GENDER },
      }),
      code: `{
  value: model.$.gender,
  component: ToggleGroupField,
  componentProps: {
    label: 'Пол',
    options: [
      { value: 'male', label: 'Мужской' },
      { value: 'female', label: 'Женский' },
    ],
  },
}`,
    },
    {
      id: 'outline',
      title: 'Стиль outline (variant)',
      description:
        'variant="outline" рисует кнопки с рамкой (сегментированный контрол). Удобно для более длинных наборов.',
      render: makeFieldVariant({
        initial: 'quarter',
        component: ToggleGroupField,
        componentProps: { label: 'Период', options: PLAN, variant: 'outline' },
      }),
      code: `componentProps: {
  label: 'Период',
  options: [
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
    { value: 'year', label: 'Год' },
  ],
  variant: 'outline',
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательный выбор (валидатор)',
      description:
        'validators: [required()] прямо в ноде схемы. touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: ToggleGroupField,
        componentProps: { label: 'Пол', options: GENDER },
        validators: [required({ message: 'Выберите пол' })],
        touched: true,
      }),
      code: `{
  value: model.$.gender,
  component: ToggleGroupField,
  componentProps: { label: 'Пол', options: GENDER },
  validators: [required({ message: 'Выберите пол' })],
}`,
    },
    {
      id: 'disabled',
      title: 'Отключённая группа',
      description:
        'disabled приходит из состояния узла (control.disable()), а не из componentProps — блокирует все варианты.',
      render: makeFieldVariant({
        initial: 'female',
        component: ToggleGroupField,
        componentProps: { label: 'Пол', options: GENDER },
        disabled: true,
      }),
      code: `const control = form.gender;
control.disable(); // блокирует всю группу`,
    },
  ],
  api: {
    component: ToggleGroupField,
    initialValue: null,
    baseComponentProps: { label: 'Пол', options: GENDER },
    validators: [required({ message: 'Выберите вариант' })],
    valuePresets: [
      { label: 'Мужской', value: 'male' },
      { label: 'Женский', value: 'female' },
      { label: 'Очистить (null)', value: null },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label/options — задаются baseComponentProps (иначе перетрут initialValues undefined-ами).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(toggleGroupBasePropsSchema), {
      omit: ['label', 'options'],
    }),
    code: (v) =>
      `{
  value: model.$.gender,
  component: ToggleGroupField,
  componentProps: {
    label: 'Пол',
    options: GENDER,${v.variant ? `\n    variant: '${v.variant}',` : ''}${v.required ? '\n    required: true,' : ''}${v.description ? `\n    description: '${v.description}',` : ''}
  },
  validators: [required()],
}`,
  },
};
