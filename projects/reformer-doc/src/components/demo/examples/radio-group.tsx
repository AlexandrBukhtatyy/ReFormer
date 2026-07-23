import { RadioGroupField, radioGroupBasePropsSchema } from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

const LOAN = [
  { value: 'consumer', label: 'Потребительский' },
  { value: 'mortgage', label: 'Ипотека' },
  { value: 'auto', label: 'Авто' },
];

const SIZES = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
];

export const radioGroupDocConfig: ComponentDocConfig = {
  name: 'RadioGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Группа радио-кнопок на Radix (контейнер role=radiogroup). Field-версия рендерит опции из массива options; значение — строка (option.value | null). Для форм — RadioGroupField.',
  variants: [
    {
      id: 'vertical',
      title: 'Одиночный выбор (options)',
      description:
        'Плоский список опций через проп options. Значение — строка (value: string | null). По умолчанию вертикальная раскладка (grid gap-3).',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroupField,
        componentProps: { label: 'Тип кредита', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: RadioGroupField,
  componentProps: {
    label: 'Тип кредита',
    options: [
      { value: 'consumer', label: 'Потребительский' },
      { value: 'mortgage', label: 'Ипотека' },
      { value: 'auto', label: 'Авто' },
    ],
  },
}`,
    },
    {
      id: 'horizontal',
      title: 'Горизонтальная раскладка (className)',
      description:
        'className переопределяет раскладку контейнера: grid-flow-col раскладывает варианты в строку.',
      render: makeFieldVariant({
        initial: 'm',
        component: RadioGroupField,
        componentProps: {
          label: 'Размер',
          options: SIZES,
          className: 'grid-flow-col w-fit gap-6',
        },
      }),
      code: `componentProps: {
  label: 'Размер',
  options: [
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
  ],
  className: 'grid-flow-col w-fit gap-6',
}`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательный выбор (валидатор)',
      description:
        'правило required в validation-схеме (validate из @reformer/core/validation). touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroupField,
        componentProps: { label: 'Тип кредита', options: LOAN },
        validators: [required({ message: 'Выберите тип кредита' })],
        touched: true,
      }),
      code: `{
  value: model.$.loanType,
  component: RadioGroupField,
  componentProps: { label: 'Тип кредита', options: LOAN },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);`,
    },
    {
      id: 'disabled',
      title: 'Отключённая группа',
      description:
        'disabled приходит из состояния узла (control.disable()), а не из componentProps — блокирует все варианты.',
      render: makeFieldVariant({
        initial: 'mortgage',
        component: RadioGroupField,
        componentProps: { label: 'Тип кредита', options: LOAN },
        disabled: true,
      }),
      code: `const control = form.loanType;
control.disable(); // блокирует всю группу`,
    },
  ],
  api: {
    component: RadioGroupField,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ message: 'Выберите тип' })],
    valuePresets: [
      { label: 'Потребительский', value: 'consumer' },
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Очистить (null)', value: null },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label/options — задаются baseComponentProps (иначе перетрут initialValues undefined-ами).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(radioGroupBasePropsSchema), {
      omit: ['label', 'options'],
    }),
    code: (v) =>
      `{
  value: model.$.loanType,
  component: RadioGroupField,
  componentProps: {
    label: 'Тип кредита',
    options: LOAN,${v.required ? '\n    required: true,' : ''}${v.description ? `\n    description: '${v.description}',` : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
