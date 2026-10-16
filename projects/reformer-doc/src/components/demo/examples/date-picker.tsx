import { useState } from 'react';
// heavy subpath: DatePicker тянет Calendar (react-day-picker) — импорт из своего subpath, не из barrel.
import {
  DatePicker,
  DatePickerRange,
  DatePickerMulti,
  datePickerBasePropsSchema,
  type DateRangeValue,
} from '@reformer/ui-kit/date-picker';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

/** Период с префиллом: с 10-го по 14-е число текущего месяца. */
function presetRange(): DateRangeValue {
  const today = new Date();
  return [
    new Date(today.getFullYear(), today.getMonth(), 10),
    new Date(today.getFullYear(), today.getMonth(), 14),
  ];
}

/* ─── Ручная сборка base (управляемый DatePicker с локальным состоянием) ─── */

function ControlledDatePickerVariant() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <div style={{ maxWidth: 280, width: '100%' }}>
      <DatePicker value={date} onChange={setDate} dateFormat="dd.MM.yyyy" />
      <p style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
        Выбрано: {date ? date.toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

export const datePickerDocConfig: ComponentDocConfig = {
  name: 'DatePicker',
  importFrom: '@reformer/ui-kit/date-picker',
  description:
    'Выбор даты: Popover с Calendar (single) и кнопкой-триггером, показывающей выбранную дату. В форме DatePicker кладётся в component как есть и привязывается к полю значением Date | null. Период — DatePickerRange ([Date, Date] | null), несколько дат — DatePickerMulti (Date[] | null).',
  variants: [
    {
      id: 'single',
      title: 'Выбор даты (single, field)',
      description:
        'DatePicker привязан к полю формы: значение — Date | null. Выбор даты в календаре закрывает поповер.',
      render: makeFieldVariant({
        initial: null,
        component: DatePicker,
        componentProps: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
      }),
      code: `{
  model: model.$.date,
  component: DatePicker,
  componentProps: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
}`,
    },
    {
      id: 'range',
      title: 'Период (DatePickerRange)',
      description:
        'Значение — кортеж [Date, Date] | null. Два клика: начало, затем конец; пока выбрано только начало, значение поля прежнее. Кортеж в начальном значении — тоже поле.',
      render: makeFieldVariant({
        initial: presetRange(),
        component: DatePickerRange,
        componentProps: { label: 'Период', dateFormat: 'dd.MM.yyyy', clearable: true },
      }),
      code: `{
  model: model.$.period, // [Date, Date] | null
  component: DatePickerRange,
  componentProps: { label: 'Период', dateFormat: 'dd.MM.yyyy', clearable: true },
}`,
    },
    {
      id: 'multi',
      title: 'Несколько дат (DatePickerMulti)',
      description:
        'Значение — Date[] | null по возрастанию. Клик добавляет день, повторный — снимает; календарь между кликами не закрывается. maxItems гасит невыбранные дни.',
      render: makeFieldVariant({
        initial: [],
        component: DatePickerMulti,
        componentProps: { label: 'Даты встреч', dateFormat: 'dd.MM', clearable: true, maxItems: 5 },
      }),
      code: `{
  model: model.$.meetings, // Date[], начальное []
  component: DatePickerMulti,
  componentProps: { label: 'Даты встреч', clearable: true, maxItems: 5 },
}

// потолок как правило формы — в validation-схеме:
validate(model.$.meetings, [maxLength(5)]);`,
    },
    {
      id: 'controlled-base',
      title: 'Ручная сборка (base, управляемый)',
      description:
        'Форма вне схемы: чистый DatePicker варианта base с локальным состоянием (value / onChange).',
      render: ControlledDatePickerVariant,
      code: `import { DatePicker } from '@reformer/ui-kit/date-picker';

const [date, setDate] = useState<Date | undefined>();

<DatePicker value={date} onChange={setDate} dateFormat="dd.MM.yyyy" />`,
    },
  ],
  examples: [
    {
      id: 'validation',
      title: 'Обязательная дата (валидатор)',
      description:
        'правило required в validation-схеме (validate из @reformer/core/validation). touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: DatePicker,
        componentProps: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
        validators: [required({ code: 'field.required' })],
        messages: { 'field.required': 'Выберите дату' },
        touched: true,
      }),
      code: `{
  model: model.$.date,
  component: DatePicker,
  componentProps: { label: 'Дата' },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.date, [required({ code: 'date.required' })]);`,
    },
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
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label — задаётся baseComponentProps (иначе перетрёт initialValues undefined-ом).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(datePickerBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  model: model.$.date,
  component: DatePicker,
  componentProps: {
    label: 'Дата',
    placeholder: '${v.placeholder}',
    dateFormat: '${v.dateFormat}',${v.required ? '\n    required: true,' : ''}
  },
}

// правила — в validation-схеме (@reformer/core/validation):
validate(model.$.date, [required()]);`,
  },
};
