import * as React from 'react';
import type { PropsBase, PropsSingle } from 'react-day-picker';

import { withFormControl } from '@/fields/with-form-control';
import { dateAdapter } from '@/fields/adapters';
import { Calendar } from './calendar-base';

/**
 * Props single-date обёртки: база DayPicker (`className`, `captionLayout`, `showOutsideDays`,
 * `disabled`…) + single-selection (`selected`/`onSelect`). `mode`/`required` убраны — зашиты.
 * Плоская интерсекция (а не union `React.ComponentProps<typeof Calendar>`) осознанно: спред union
 * с discriminated `mode` в `<Calendar mode="single" …>` не сужается и падает на tsc.
 */
type CalendarSingleProps = Omit<PropsBase, 'mode' | 'required'> &
  Omit<PropsSingle, 'mode'> & {
    buttonVariant?: React.ComponentProps<typeof Calendar>['buttonVariant'];
  };

/**
 * Single-date вариант Calendar: `mode='single'` зашит; остальные props DayPicker проходят как есть.
 * Селект одной даты (`selected` / `onSelect(Date | undefined)`) — контракт, который {@link dateAdapter}
 * сводит к value-based `value: Date | null` + `onChange(Date | null)`.
 */
function CalendarSingle(props: CalendarSingleProps) {
  return <Calendar mode="single" {...props} />;
}
CalendarSingle.displayName = 'CalendarSingle';

/**
 * Field-версия single-date Calendar: pure Calendar(mode=single) + {@link dateAdapter}
 * (`selected`/`onSelect` ↔ `value: Date | null`). HOC отбрасывает `control` (renderer-путь).
 */
export const CalendarBaseField = withFormControl(CalendarSingle, dateAdapter);
