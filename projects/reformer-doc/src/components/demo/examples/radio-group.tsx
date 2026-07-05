import { RadioGroup } from '@reformer/ui-kit';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
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
  description: 'Группа радио-кнопок из массива options. Одиночный выбор, навигация стрелками.',
  variants: [
    {
      id: 'vertical',
      title: 'Вертикально',
      description: 'Раскладка по умолчанию.',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroup,
        componentProps: { label: 'Тип кредита', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: RadioGroup,
  componentProps: { label: 'Тип кредита', options: LOAN },
}`,
    },
    {
      id: 'horizontal',
      title: 'Горизонтально',
      description: 'className="!flex-row gap-6".',
      render: makeFieldVariant({
        initial: 'm',
        component: RadioGroup,
        componentProps: { label: 'Размер', options: SIZES, className: '!flex-row gap-6' },
      }),
      code: `componentProps: { label: 'Размер', options: SIZES, className: '!flex-row gap-6' }`,
    },
    {
      id: 'disabled',
      title: 'Заблокирован',
      description: 'Через control.disable().',
      render: makeFieldVariant({
        initial: 'consumer',
        component: RadioGroup,
        componentProps: { label: 'Тип кредита', options: LOAN },
        disabled: true,
      }),
      code: `form.loanType.disable();`,
    },
  ],
  examples: [
    {
      id: 'required',
      title: 'Обязательный выбор',
      render: makeFieldVariant({
        initial: null,
        component: RadioGroup,
        componentProps: { label: 'Тип кредита', options: LOAN },
        validators: [required({ message: 'Выберите тип' })],
      }),
      code: `{
  value: model.$.loanType,
  component: RadioGroup,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required({ message: 'Выберите тип' })],
}`,
    },
  ],
  api: {
    component: RadioGroup,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ message: 'Выберите тип' })],
    valuePresets: [
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Авто', value: 'auto' },
      { label: 'Очистить', value: null },
    ],
    controls: [
      {
        prop: 'value',
        type: 'string | null',
        group: 'Control',
        kind: 'readonly',
        description: 'Текущее значение; совпадает с одним из options[i].value.',
      },
      {
        prop: 'onChange',
        type: '(value: string) => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Получает event.target.value.',
      },
      {
        prop: 'options',
        type: 'RadioOption[]',
        group: 'Options',
        kind: 'readonly',
        description: 'Массив { value: string; label: string }.',
      },
      {
        prop: 'className',
        type: 'string',
        group: 'Appearance',
        kind: 'readonly',
        description: 'Раскладка контейнера (для горизонтали — !flex-row).',
      },
      {
        prop: 'onBlur',
        type: '() => void',
        group: 'Control',
        kind: 'readonly',
        description: 'Срабатывает при потере фокуса любым radio.',
      },
      {
        prop: 'disabled',
        type: 'boolean',
        group: 'State',
        kind: 'boolean',
        default: false,
        description: 'Блокирует все варианты.',
      },
    ],
    code: (v) =>
      `{
  value: model.$.loanType,
  component: RadioGroup,
  componentProps: { label: 'Тип кредита', options: LOAN },
  validators: [required()],
}${v.disabled ? '\n// form.loanType.disable()' : ''}`,
  },
};
