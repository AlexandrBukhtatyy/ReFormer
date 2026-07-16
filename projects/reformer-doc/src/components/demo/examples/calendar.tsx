import { useState } from 'react';
import { Calendar, CalendarField, calendarBasePropsSchema } from '@reformer/ui-kit/calendar';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { makeFieldVariant } from '../field-demo';
import { controlsFromPropsSchema } from '../controls-from-schema';
import type { ComponentDocConfig } from '../types';

/* ─── Ручная сборка base (управляемый Calendar с локальным состоянием) ─── */

function ControlledCalendarVariant() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <div style={{ display: 'inline-block' }}>
      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
      <p style={{ marginTop: 8, fontSize: 13, color: '#6b7280' }}>
        Выбрано: {date ? date.toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

export const calendarDocConfig: ComponentDocConfig = {
  name: 'Calendar',
  importFrom: '@reformer/ui-kit',
  description:
    'Календарь выбора даты на react-day-picker (v10). Вариант base — чистая обёртка DayPicker (mode single/multiple/range), field-версия CalendarField — single-date со связкой value: Date | null.',
  variants: [
    {
      id: 'single',
      title: 'Выбор даты (single, field)',
      description:
        'CalendarField привязан к полю формы: значение — Date | null, повторный клик по дате сбрасывает выбор в null.',
      render: makeFieldVariant({
        initial: null,
        component: CalendarField,
        componentProps: { label: 'Дата' },
      }),
      code: `{
  value: model.$.date,
  component: CalendarField,
  componentProps: { label: 'Дата' },
}`,
    },
    {
      id: 'caption-dropdown',
      title: 'Навигация дропдаунами (captionLayout)',
      description:
        'captionLayout="dropdown" заменяет статичную подпись месяца на выпадающие списки месяца и года — быстрый переход к далёким датам.',
      render: makeFieldVariant({
        initial: null,
        component: CalendarField,
        componentProps: { label: 'Дата рождения', captionLayout: 'dropdown' },
      }),
      code: `componentProps: { label: 'Дата рождения', captionLayout: 'dropdown' }`,
    },
    {
      id: 'controlled-base',
      title: 'Ручная сборка (base compound, управляемый)',
      description:
        'Форма вне схемы: чистый Calendar варианта base с локальным состоянием (mode / selected / onSelect). Так же собираются multiple- и range-режимы.',
      render: ControlledCalendarVariant,
      code: `import { Calendar } from '@reformer/ui-kit';

const [date, setDate] = useState<Date>();

<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="rounded-md border"
/>`,
    },
  ],
  examples: [
    {
      id: 'hide-outside-days',
      title: 'Без дней соседних месяцев (showOutsideDays)',
      description:
        'showOutsideDays=false убирает «хвосты» предыдущего и следующего месяцев в первой и последней неделях.',
      render: makeFieldVariant({
        initial: null,
        component: CalendarField,
        componentProps: { label: 'Дата', showOutsideDays: false },
      }),
      code: `componentProps: { label: 'Дата', showOutsideDays: false }`,
    },
    {
      id: 'validation',
      title: 'Обязательная дата (валидатор)',
      description:
        'validators: [required()] прямо в ноде схемы. touched-поле с пустым значением показывает ошибку.',
      render: makeFieldVariant({
        initial: null,
        component: CalendarField,
        componentProps: { label: 'Дата' },
        validators: [required({ message: 'Выберите дату' })],
        touched: true,
      }),
      code: `{
  value: model.$.date,
  component: CalendarField,
  componentProps: { label: 'Дата' },
  validators: [required({ message: 'Выберите дату' })],
}`,
    },
  ],
  api: {
    component: CalendarField,
    initialValue: null,
    baseComponentProps: { label: 'Дата' },
    validators: [required({ message: 'Выберите дату' })],
    valuePresets: [
      { label: 'Сегодня', value: new Date() },
      { label: 'Очистить (null)', value: null },
    ],
    // Единый источник — props-схема варианта. Ручной controls[] запрещён (§ Props-компаньоны).
    // omit: label — задаётся baseComponentProps (иначе перетрёт initialValues undefined-ом).
    controls: controlsFromPropsSchema(mergeFieldPropsSchema(calendarBasePropsSchema), {
      omit: ['label'],
    }),
    code: (v) =>
      `{
  value: model.$.date,
  component: CalendarField,
  componentProps: {
    label: 'Дата',
    captionLayout: '${v.captionLayout}',${v.showOutsideDays ? '' : '\n    showOutsideDays: false,'}${v.required ? '\n    required: true,' : ''}
  },
  validators: [required()],
}`,
  },
};
