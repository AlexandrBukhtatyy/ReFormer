import { useState } from 'react';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from 'lucide-react';
import {
  ToggleGroup,
  ToggleGroupItem,
  ToggleGroupOptions,
  toggleGroupBasePropsSchema,
  ToggleGroupMulti,
} from '@reformer/ui-kit';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant, raw } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

const PERIOD = [
  { value: 'month', label: 'Месяц' },
  { value: 'quarter', label: 'Квартал' },
  { value: 'year', label: 'Год' },
];

const GENDER = [
  { value: 'male', label: 'Мужской' },
  { value: 'female', label: 'Женский' },
];

const WEEKDAYS = [
  { value: 'mon', label: 'Пн' },
  { value: 'tue', label: 'Вт' },
  { value: 'wed', label: 'Ср' },
  { value: 'thu', label: 'Чт' },
  { value: 'fri', label: 'Пт' },
];

/** Вне формы: кнопки-иконки собираются из ToggleGroup и ToggleGroupItem. */
function AlignToggleGroup() {
  const [align, setAlign] = useState('left');
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={align}
      // повторный щелчок по нажатой кнопке даёт '' — здесь выбор не снимаем
      onValueChange={(next) => next && setAlign(next)}
      aria-label="Выравнивание текста"
    >
      <ToggleGroupItem value="left" aria-label="По левому краю">
        <AlignLeftIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="По центру">
        <AlignCenterIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="По правому краю">
        <AlignRightIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

const ALIGN_CODE = `import { useState } from 'react';
import { AlignCenterIcon, AlignLeftIcon, AlignRightIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@reformer/ui-kit';

function AlignToggleGroup() {
  const [align, setAlign] = useState('left');
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      value={align}
      // повторный щелчок по нажатой кнопке даёт '' — здесь выбор не снимаем
      onValueChange={(next) => next && setAlign(next)}
      aria-label="Выравнивание текста"
    >
      <ToggleGroupItem value="left" aria-label="По левому краю">
        <AlignLeftIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="По центру">
        <AlignCenterIcon />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="По правому краю">
        <AlignRightIcon />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}`;

// Пропсы панели API — из props-схемы варианта. label и options задаются baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(toggleGroupBasePropsSchema), {
  omit: ['label', 'options'],
});

export const toggleGroupDocConfig: ComponentDocConfig = {
  name: 'ToggleGroup',
  importFrom: '@reformer/ui-kit',
  description:
    'Ряд кнопок-сегментов. ToggleGroupOptions — одно значение (string | null), ToggleGroupMulti — несколько (string[] | null).',
  variants: [
    fieldVariant({
      id: 'default',
      title: 'Одно значение',
      description:
        'ToggleGroupOptions рисует кнопки из options. Значение — string | null; щелчок по нажатой кнопке снимает выбор.',
      field: 'gender',
      component: ToggleGroupOptions,
      componentName: 'ToggleGroupOptions',
      initial: 'male',
      showInitial: true,
      props: { label: 'Пол', options: GENDER },
    }),
    fieldVariant({
      id: 'outline',
      title: 'С рамкой',
      description: 'variant: "outline" — кнопки с общей рамкой, как сегменты одного поля.',
      field: 'period',
      component: ToggleGroupOptions,
      componentName: 'ToggleGroupOptions',
      initial: 'quarter',
      showInitial: true,
      props: { label: 'Период', options: PERIOD, variant: 'outline' },
    }),
    fieldVariant({
      id: 'multi',
      title: 'Несколько значений',
      description:
        'ToggleGroupMulti: значение — string[] | null, снятие последней кнопки даёт null. maxItems выключает остальные кнопки, когда выбрано три.',
      field: 'workdays',
      component: ToggleGroupMulti,
      componentName: 'ToggleGroupMulti',
      initial: null,
      props: { label: 'Дни встреч', options: WEEKDAYS, variant: 'outline', maxItems: 3 },
    }),
    {
      id: 'manual',
      title: 'Кнопки-иконки вне формы',
      description:
        'ToggleGroup и ToggleGroupItem — части Radix для своей разметки. У кнопок без текста нужен aria-label.',
      render: AlignToggleGroup,
      code: ALIGN_CODE,
    },
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Обязательный выбор',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'period',
      component: ToggleGroupOptions,
      componentName: 'ToggleGroupOptions',
      initial: null,
      props: { label: 'Период', options: PERIOD, variant: 'outline', required: true },
      validators: [required({ code: 'period.required' })],
      rules: "required({ code: 'period.required' })",
      messages: { 'period.required': 'Выберите период' },
      touched: true,
    }),
    fieldVariant({
      id: 'disabled',
      title: 'Заблокированная группа',
      description:
        'Блокировка — состоянием поля (disable()), а не пропом: выключаются все кнопки сразу.',
      field: 'gender',
      component: ToggleGroupOptions,
      componentName: 'ToggleGroupOptions',
      initial: 'female',
      showInitial: true,
      props: { label: 'Пол', options: GENDER },
      disabled: true,
    }),
  ],
  api: {
    component: ToggleGroupOptions,
    initialValue: null,
    baseComponentProps: { label: 'Период', options: PERIOD },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Выберите вариант' },
    valuePresets: [
      { label: 'Месяц', value: 'month' },
      { label: 'Год', value: 'year' },
      { label: 'Очистить (null)', value: null },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'period',
        component: 'ToggleGroupOptions',
        props: { label: 'Период', options: raw('PERIODS') },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
