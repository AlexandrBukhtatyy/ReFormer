import { useState } from 'react';
// Тяжёлый компонент (react-day-picker, date-fns) — только из своего подпути, не из главного входа.
import {
  DatePicker,
  DatePickerRange,
  DatePickerMulti,
  datePickerBasePropsSchema,
  type DateRangeValue,
} from '@reformer/ui-kit/date-picker';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required, maxLength } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

/** Период для демо: с 10-го по 14-е число текущего месяца. */
function presetRange(): DateRangeValue {
  const today = new Date();
  return [
    new Date(today.getFullYear(), today.getMonth(), 10),
    new Date(today.getFullYear(), today.getMonth(), 14),
  ];
}

// Пропсы панели API — из props-схемы варианта. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(datePickerBasePropsSchema), {
  omit: ['label'],
});

/* ─── DatePicker вне формы: свой стейт, значение Date | undefined ─── */

function StandaloneDatePicker() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <div className="w-full max-w-sm">
      <DatePicker value={date} onChange={setDate} dateFormat="dd.MM.yyyy" />
      <p className="mt-2 text-sm text-muted-foreground">
        Выбрано: {date ? date.toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

export const datePickerDocConfig: ComponentDocConfig = {
  name: 'DatePicker',
  importFrom: '@reformer/ui-kit/date-picker',
  description:
    'Кнопка с датой, по которой открывается календарь. Одна дата — DatePicker, период — DatePickerRange, несколько дат — DatePickerMulti.',
  variants: [
    fieldVariant({
      id: 'single',
      title: 'Одна дата',
      description:
        'Значение поля — Date | null. Выбор дня закрывает календарь. Без dateFormat дата пишется по правилам языка.',
      field: 'date',
      component: DatePicker,
      componentName: 'DatePicker',
      initial: null,
      props: { label: 'Дата' },
    }),
    fieldVariant({
      id: 'format',
      title: 'Свой формат даты',
      description: 'dateFormat — токены date-fns: dd.MM.yyyy даёт «16.11.2026».',
      field: 'date',
      component: DatePicker,
      componentName: 'DatePicker',
      initial: null,
      props: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
    }),
    fieldVariant({
      id: 'range',
      title: 'Период',
      description:
        'DatePickerRange: значение — [Date, Date] | null, в демо период уже выбран. Новый период — два щелчка: начало, затем конец; пока выбрано только начало, значение поля прежнее.',
      field: 'period',
      component: DatePickerRange,
      componentName: 'DatePickerRange',
      initial: presetRange(),
      props: { label: 'Период', dateFormat: 'dd.MM.yyyy', clearable: true },
    }),
    fieldVariant({
      id: 'multi',
      title: 'Несколько дат',
      description:
        'DatePickerMulti: значение — Date[] | null по возрастанию. Щелчок добавляет день, повторный — снимает; календарь между щелчками не закрывается. maxItems гасит невыбранные дни, правило формы — maxLength(5).',
      field: 'meetings',
      component: DatePickerMulti,
      componentName: 'DatePickerMulti',
      initial: null,
      props: { label: 'Даты встреч', dateFormat: 'dd.MM', clearable: true, maxItems: 5 },
      validators: [maxLength(5)],
      rules: 'maxLength(5)',
    }),
    {
      id: 'standalone',
      title: 'Вне формы',
      description: 'Вне формы DatePicker работает с Date | undefined: undefined — дата не выбрана.',
      render: StandaloneDatePicker,
      code: `import { useState } from 'react';
import { DatePicker } from '@reformer/ui-kit/date-picker';

function StandaloneDatePicker() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <div className="w-full max-w-sm">
      <DatePicker value={date} onChange={setDate} dateFormat="dd.MM.yyyy" />
      <p className="mt-2 text-sm text-muted-foreground">
        Выбрано: {date ? date.toLocaleDateString() : '—'}
      </p>
    </div>
  );
}`,
    },
  ],
  examples: [
    fieldVariant({
      id: 'validation',
      title: 'Обязательная дата',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'date',
      component: DatePicker,
      componentName: 'DatePicker',
      initial: null,
      props: { label: 'Дата', dateFormat: 'dd.MM.yyyy', required: true },
      validators: [required({ code: 'date.required' })],
      rules: "required({ code: 'date.required' })",
      messages: { 'date.required': 'Выберите дату' },
      touched: true,
    }),
  ],
  api: {
    component: DatePicker,
    initialValue: null,
    baseComponentProps: { label: 'Дата' },
    validators: [required({ code: 'field.required' })],
    messages: { 'field.required': 'Выберите дату' },
    valuePresets: [
      { label: 'Сегодня', value: new Date() },
      { label: 'Очистить (null)', value: null },
    ],
    controls: API_CONTROLS,
    code: (v) =>
      fieldSnippet({
        field: 'date',
        component: 'DatePicker',
        props: { label: 'Дата' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
