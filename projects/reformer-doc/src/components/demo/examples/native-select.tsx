import { NativeSelectField, nativeSelectBasePropsSchema } from '@reformer/ui-kit';
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

const GROUPED = [
  { value: 'msk', label: 'Москва', group: 'Россия' },
  { value: 'spb', label: 'Санкт-Петербург', group: 'Россия' },
  { value: 'minsk', label: 'Минск', group: 'Беларусь' },
];

export const nativeSelectDocConfig: ComponentDocConfig = {
  name: 'NativeSelect',
  importFrom: '@reformer/ui-kit',
  description:
    'Стилизованный native <select> (не Radix — семантика и клавиатура браузерные). Значение — строка (option.value), пустой выбор → null. Для форм — NativeSelectField (options → <option>).',
  variants: [
    {
      id: 'single',
      title: 'Одиночный выбор (options)',
      description:
        'Плоский список опций через проп options. Значение — строка (value: string | null).',
      render: makeFieldVariant({
        initial: null,
        component: NativeSelectField,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: NativeSelectField,
  componentProps: {
    label: 'Тип кредита',
    placeholder: 'Выберите тип',
    options: [
      { value: 'consumer', label: 'Потребительский' },
      { value: 'mortgage', label: 'Ипотека' },
    ],
  },
}`,
    },
    {
      id: 'grouped',
      title: 'Группировка опций (options + group)',
      description: 'Опции с одинаковым group объединяются в нативный <optgroup>.',
      render: makeFieldVariant({
        initial: null,
        component: NativeSelectField,
        componentProps: { label: 'Город', placeholder: 'Выберите город', options: GROUPED },
      }),
      code: `componentProps: {
  label: 'Город',
  options: [
    { value: 'msk', label: 'Москва', group: 'Россия' },
    { value: 'minsk', label: 'Минск', group: 'Беларусь' },
  ],
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
        component: NativeSelectField,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
        validators: [required({ message: 'Выберите тип кредита' })],
        touched: true,
      }),
      code: `{
  value: model.$.loanType,
  component: NativeSelectField,
  componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
  validators: [required({ message: 'Выберите тип кредита' })],
}`,
    },
  ],
  api: {
    component: NativeSelectField,
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
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(nativeSelectBasePropsSchema), {
      omit: ['label', 'options'],
    }),
    code: (v) =>
      `{
  value: model.$.loanType,
  component: NativeSelectField,
  componentProps: {
    label: 'Тип кредита',
    options: LOAN,
    placeholder: '${v.placeholder}',${v.required ? '\n    required: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
