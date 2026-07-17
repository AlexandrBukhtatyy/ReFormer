import { useState } from 'react';
// heavy subpath: DatePicker тянет Calendar (react-day-picker) — импорт из своего subpath, не из barrel.
import {
  DatePicker,
  DatePickerField,
  datePickerBasePropsSchema,
} from '@reformer/ui-kit/date-picker';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

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
    'Выбор даты: Popover с Calendar (single) и кнопкой-триггером, показывающей выбранную дату. Field-версия DatePickerField привязана к полю формы значением Date | null.',
  variants: [
    {
      id: 'single',
      title: 'Выбор даты (single, field)',
      description:
        'DatePickerField привязан к полю формы: значение — Date | null. Выбор даты в календаре закрывает поповер.',
      render: makeFieldVariant({
        initial: null,
        component: DatePickerField,
        componentProps: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
      }),
      code: `{
  value: model.$.date,
  component: DatePickerField,
  componentProps: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
}`,
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
        'validators: [required()] прямо в ноде схемы. touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: DatePickerField,
        componentProps: { label: 'Дата', dateFormat: 'dd.MM.yyyy' },
        validators: [required({ message: 'Выберите дату' })],
        touched: true,
      }),
      code: `{
  value: model.$.date,
  component: DatePickerField,
  componentProps: { label: 'Дата' },
  validators: [required({ message: 'Выберите дату' })],
}`,
    },
  ],
  api: {
    component: DatePickerField,
    initialValue: null,
    baseComponentProps: { label: 'Дата' },
    validators: [required({ message: 'Выберите дату' })],
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
  value: model.$.date,
  component: DatePickerField,
  componentProps: {
    label: 'Дата',
    placeholder: '${v.placeholder}',
    dateFormat: '${v.dateFormat}',${v.required ? '\n    required: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
