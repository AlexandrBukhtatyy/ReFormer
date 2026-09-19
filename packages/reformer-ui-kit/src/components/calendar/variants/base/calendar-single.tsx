import * as React from 'react';
import type { PropsBase, PropsSingle } from 'react-day-picker';

import { defineFieldControl } from '@/fields/field-control';
import { dateAdapter } from '@/fields/adapters';
import { withFieldTooltip, OUTSIDE_START_GROUP } from '@/fields/field-tooltip';
import { Calendar } from './calendar-base';

/**
 * Props single-date обёртки: база DayPicker (`className`, `captionLayout`, `showOutsideDays`,
 * `disabled`…) + single-selection (`selected`/`onSelect`). `mode`/`required` убраны — зашиты.
 * Плоская интерсекция (а не union `React.ComponentProps<typeof Calendar>`) осознанно: спред union
 * с discriminated `mode` в `<Calendar mode="single" …>` не сужается и падает на tsc.
 */
export type CalendarSingleProps = Omit<PropsBase, 'mode' | 'required'> &
  Omit<PropsSingle, 'mode'> & {
    buttonVariant?: React.ComponentProps<typeof Calendar>['buttonVariant'];
  };

/**
 * Single-date вариант Calendar: `mode='single'` зашит; остальные props DayPicker проходят как есть.
 * Селект одной даты (`selected` / `onSelect(Date | undefined)`) — контракт, который {@link dateAdapter}
 * сводит к value-based `value: Date | null` + `onChange(Date | null)`.
 */
function CalendarSingleBase(props: CalendarSingleProps) {
  return <Calendar mode="single" {...props} />;
}

/**
 * Календарь одной даты — компонент для формы (`component: CalendarSingle`, registry `Calendar`):
 * `selected`/`onSelect` ↔ `value: Date | null` через {@link dateAdapter} (статика) + проп `tooltip`.
 */
const CalendarSingle = defineFieldControl(
  withFieldTooltip(CalendarSingleBase, OUTSIDE_START_GROUP),
  { adapter: dateAdapter }
);
CalendarSingle.displayName = 'CalendarSingle';

export { CalendarSingle };
