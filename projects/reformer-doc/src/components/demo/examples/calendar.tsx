import { useState } from 'react';
// Тяжёлый компонент (react-day-picker) — только из своего подпути, не из главного входа кита.
import { Calendar, CalendarSingle, calendarBasePropsSchema } from '@reformer/ui-kit/calendar';
import { mergeFieldPropsSchema } from '@reformer/ui-kit/meta';
import { required } from '@reformer/core/validators';
import { controlsFromPropsSchema } from '../controls-from-schema';
import { fieldSnippet, fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Пропсы панели API — из props-схемы. label задаётся baseComponentProps.
const API_CONTROLS = controlsFromPropsSchema(mergeFieldPropsSchema(calendarBasePropsSchema), {
  omit: ['label'],
});

/* ─── Календарь вне формы: свой стейт, режим и обработчик ─── */

function StandaloneCalendar() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <div>
      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
      <p className="mt-2 text-sm text-muted-foreground">
        Выбрано: {date ? date.toLocaleDateString() : '—'}
      </p>
    </div>
  );
}

export const calendarDocConfig: ComponentDocConfig = {
  name: 'Calendar',
  importFrom: '@reformer/ui-kit/calendar',
  description:
    'Календарь на странице, без всплывающего окна. В форме — CalendarSingle: одна дата, значение Date | null.',
  variants: [
    fieldVariant({
      id: 'single',
      title: 'Одна дата в форме',
      description:
        'CalendarSingle привязан к полю: значение — Date | null, повторный щелчок по выбранной дате сбрасывает его в null.',
      field: 'date',
      component: CalendarSingle,
      componentName: 'CalendarSingle',
      initial: null,
      props: { label: 'Дата' },
    }),
    fieldVariant({
      id: 'caption-dropdown',
      title: 'Месяц и год списками',
      description:
        'captionLayout="dropdown" заменяет подпись месяца выпадающими списками месяца и года — быстрый переход к далёким датам.',
      field: 'birthDate',
      component: CalendarSingle,
      componentName: 'CalendarSingle',
      initial: null,
      props: { label: 'Дата рождения', captionLayout: 'dropdown' },
    }),
    {
      id: 'standalone',
      title: 'Вне формы',
      description:
        'Calendar — обёртка DayPicker: режим mode (single, multiple, range), выбранное selected и обработчик onSelect задаёте сами.',
      render: StandaloneCalendar,
      code: `import { useState } from 'react';
import { Calendar } from '@reformer/ui-kit/calendar';

function StandaloneCalendar() {
  const [date, setDate] = useState<Date | undefined>(undefined);
  return (
    <div>
      <Calendar mode="single" selected={date} onSelect={setDate} className="rounded-md border" />
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
      id: 'hide-outside-days',
      title: 'Без дней соседних месяцев',
      description:
        'showOutsideDays: false убирает дни предыдущего и следующего месяцев из первой и последней недели.',
      field: 'date',
      component: CalendarSingle,
      componentName: 'CalendarSingle',
      initial: null,
      props: { label: 'Дата', showOutsideDays: false },
    }),
    fieldVariant({
      id: 'validation',
      title: 'Обязательная дата',
      description:
        'Правило required — в схеме валидации. Поле уже тронуто, поэтому замечание видно сразу.',
      field: 'date',
      component: CalendarSingle,
      componentName: 'CalendarSingle',
      initial: null,
      props: { label: 'Дата', required: true },
      validators: [required({ code: 'date.required' })],
      rules: "required({ code: 'date.required' })",
      messages: { 'date.required': 'Выберите дату' },
      touched: true,
    }),
  ],
  api: {
    component: CalendarSingle,
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
        component: 'CalendarSingle',
        props: { label: 'Дата' },
        controls: API_CONTROLS,
        values: v,
        rules: 'required()',
      }),
  },
};
