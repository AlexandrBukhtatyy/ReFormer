import { useState } from 'react';
import {
  Label,
  RadioGroup,
  RadioGroupItem,
  RadioGroupOptions,
  radioGroupBasePropsSchema,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Наборы вариантов для демо. id пунктов RadioGroupOptions строит из useId, поэтому одинаковые
// наборы на одной странице не конфликтуют.
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

const PLANS = [
  { value: 'basic', label: 'Базовый', tooltip: 'До трёх пользователей' },
  { value: 'team', label: 'Команда', tooltip: 'До двадцати пользователей' },
  { value: 'enterprise', label: 'Компания' },
];

const DELIVERY = [
  { value: 'courier', label: 'Курьер' },
  { value: 'pickup', label: 'Самовывоз' },
];

/** Вне формы: Radix RadioGroup и пункты с подписями собираются руками. */
function ThemeRadio() {
  const [theme, setTheme] = useState('light');
  return (
    <RadioGroup value={theme} onValueChange={setTheme}>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="light" id="theme-light" />
        <Label htmlFor="theme-light">Светлая</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="dark" id="theme-dark" />
        <Label htmlFor="theme-dark">Тёмная</Label>
      </div>
    </RadioGroup>
  );
}

const THEME_RADIO_CODE = `import { useState } from 'react';
import { Label, RadioGroup, RadioGroupItem } from '@reformer/ui-kit';

function ThemeRadio() {
  const [theme, setTheme] = useState('light');
  return (
    <RadioGroup value={theme} onValueChange={setTheme}>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="light" id="theme-light" />
        <Label htmlFor="theme-light">Светлая</Label>
      </div>
      <div className="flex items-center gap-2">
        <RadioGroupItem value="dark" id="theme-dark" />
        <Label htmlFor="theme-dark">Тёмная</Label>
      </div>
    </RadioGroup>
  );
}`;

// Пропсы панели API — из props-схемы варианта. label и options задаются baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(radioGroupBasePropsSchema), {
  omit: ['label', 'options'],
});

export const radioGroupDocConfig: ComponentDocConfig = {
  name: 'RadioGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Группа переключателей «один из нескольких». В форму — RadioGroupOptions: пункты из options, значение — string | null.',
  variants: [
    fieldVariant({
      id: 'vertical',
      title: 'Один из нескольких',
      description: 'RadioGroupOptions рисует пункты из options столбцом. Значение — string | null.',
      field: 'loanType',
      component: RadioGroupOptions,
      componentName: 'RadioGroupOptions',
      initial: null,
      props: { label: 'Тип кредита', options: LOAN },
    }),
    fieldVariant({
      id: 'horizontal',
      title: 'В строку',
      description:
        'className заменяет раскладку контейнера: flex ставит пункты в строку вместо столбца.',
      field: 'size',
      component: RadioGroupOptions,
      componentName: 'RadioGroupOptions',
      initial: 'm',
      showInitial: true,
      props: { label: 'Размер', options: SIZES, className: 'flex flex-wrap gap-6' },
    }),
    fieldVariant({
      id: 'option-hints',
      title: 'Подсказка у пункта',
      description:
        'tooltip в пункте options ставит иконку после его подписи. Клик по иконке пункт не выбирает.',
      field: 'plan',
      component: RadioGroupOptions,
      componentName: 'RadioGroupOptions',
      initial: 'team',
      showInitial: true,
      props: { label: 'Тариф', options: PLANS },
    }),
    {
      id: 'manual',
      title: 'Ручная сборка',
      description:
        'Вне формы RadioGroup и RadioGroupItem собираются руками; подпись пункта связывают через id.',
      render: ThemeRadio,
      code: THEME_RADIO_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Обязательный выбор',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'loanType',
      component: RadioGroupOptions,
      componentName: 'RadioGroupOptions',
      initial: null,
      props: { label: 'Тип кредита', options: LOAN, required: true },
      validators: [required({ code: 'loanType.required' })],
      rules: "required({ code: 'loanType.required' })",
      messages: { 'loanType.required': 'Выберите тип кредита' },
      touched: true,
    }),
    fieldVariant({
      id: 'disabled',
      title: 'Заблокированная группа',
      description:
        'Блокировка — состоянием поля (disable()), а не пропом: выключаются все пункты вместе с подписями.',
      field: 'delivery',
      component: RadioGroupOptions,
      componentName: 'RadioGroupOptions',
      initial: 'pickup',
      showInitial: true,
      props: { label: 'Доставка', options: DELIVERY },
      disabled: true,
    }),
  ],
  api: {
    component: RadioGroupOptions,
    initialValue: null,
    baseComponentProps: { label: 'Тип кредита', options: LOAN },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Выберите тип' },
    valuePresets: [
      { label: 'Потребительский', value: 'consumer' },
      { label: 'Ипотека', value: 'mortgage' },
      { label: 'Очистить (null)', value: null },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'loanType',
        component: 'RadioGroupOptions',
        props: { label: 'Тип кредита', options: raw('LOAN_TYPES') },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
