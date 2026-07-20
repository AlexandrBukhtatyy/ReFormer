import { forwardRef } from 'react';
import { withFormControl } from '@/fields/with-form-control';
import { dateAdapter } from '@/fields/adapters';
import { DatePicker, type DatePickerProps, type DatePickerHandle } from './date-picker-base';

/**
 * Props тонкой обёртки-моста: база DatePicker управляется `value`/`onChange`, а {@link dateAdapter}
 * (единый пресет дат) эмитит через `selected`/`onSelect`. Обёртка переименовывает пару
 * (как {@link import('../../../calendar/variants/base/calendar-base.field').CalendarBaseField} —
 * `CalendarSingle`), не добавляя нового адаптер-пресета.
 */
type DatePickerControlledProps = Omit<DatePickerProps, 'value' | 'onChange'> & {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
};

/**
 * Мост `selected`/`onSelect` → `value`/`onChange` базы. Нужен, потому что общий {@link dateAdapter}
 * говорит на языке `selected`/`onSelect` (контракт react-day-picker), а публичный API DatePicker —
 * `value`/`onChange`.
 *
 * `forwardRef`: мост обязан пробрасывать ref дальше в {@link DatePicker}, иначе passthrough-режим HOC
 * упёрся бы в обёртку и {@link DatePickerHandle} не дошёл бы до потребителя.
 */
const DatePickerControlled = forwardRef<DatePickerHandle, DatePickerControlledProps>(
  function DatePickerControlled({ selected, onSelect, ...props }, ref) {
    return <DatePicker ref={ref} value={selected} onChange={onSelect} {...props} />;
  }
);
DatePickerControlled.displayName = 'DatePickerControlled';

/**
 * Field-версия DatePicker: single-date со связкой `value: Date | null` + `onChange(Date | null)`.
 * {@link dateAdapter} сводит `selected`/`onSelect` к value-based контракту формы; HOC отбрасывает
 * `control` (renderer-путь).
 *
 * `exposesHandle: true` — DatePicker сам реализует {@link DatePickerHandle}, ref форвардится
 * через мост прямо в него (passthrough).
 */
export const DatePickerBaseField = withFormControl(DatePickerControlled, dateAdapter, {
  exposesHandle: true,
});
