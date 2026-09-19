import {
  NativeSelectWithOptions,
  nativeSelectBasePropsSchema,
  NativeSelectMulti,
} from '@reformer/ui-kit';
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
    'Стилизованный native <select> (не Radix — семантика и клавиатура браузерные). Значение — строка (option.value), пустой выбор → null. Для форм — NativeSelectWithOptions (options → <option>).',
  variants: [
    {
      id: 'single',
      title: 'Одиночный выбор (options)',
      description:
        'Плоский список опций через проп options. Значение — строка (value: string | null).',
      render: makeFieldVariant({
        initial: null,
        component: NativeSelectWithOptions,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
      }),
      code: `{
  value: model.$.loanType,
  component: NativeSelectWithOptions,
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
        component: NativeSelectWithOptions,
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
    {
      id: 'multi',
      title: 'Множественный выбор (NativeSelectMulti)',
      description:
        'Нативный <select multiple>: no-JS/legacy, клавиатура браузера (Ctrl+клик, Shift+стрелки). Не для тач-устройств. placeholder отсутствует намеренно — в листбоксе он стал бы выбираемым пунктом.',
      render: makeFieldVariant({
        initial: null,
        component: NativeSelectMulti,
        componentProps: {
          label: 'Цели кредита',
          options: LOAN,
          rows: 5,
        },
      }),
      code: `{
  value: model.signalAt('purposes')!,
  component: NativeSelectMulti,
  componentProps: { options: LOAN, rows: 5 },
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
        component: NativeSelectWithOptions,
        componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
        validators: [required({ message: 'Выберите тип кредита' })],
        touched: true,
      }),
      code: `{
  value: model.$.loanType,
  component: NativeSelectWithOptions,
  componentProps: { label: 'Тип кредита', placeholder: 'Выберите тип', options: LOAN },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.loanType, [required({ message: 'Выберите тип кредита' })]);`,
    },
  ],
  api: {
    component: NativeSelectWithOptions,
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
  component: NativeSelectWithOptions,
  componentProps: {
    label: 'Тип кредита',
    options: LOAN,
    placeholder: '${v.placeholder}',${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.value, [required()]);`,
  },
};
