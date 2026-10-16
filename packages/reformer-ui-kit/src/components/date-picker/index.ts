// base — рецепт DatePicker (Popover + Calendar single + Button-триггер с date-fns форматированием)
// + проп tooltip. Компонент для формы (value: Date | null).
export { DatePicker } from './variants/base/date-picker-base';
export type { DatePickerProps, DatePickerHandle } from './variants/base/date-picker-base';

// range — период (Calendar range, value: [Date, Date] | null). Отдельная запись каталога: другой
// тип значения.
export { DatePickerRange } from './variants/range/date-picker-range';
export type {
  DatePickerRangeProps,
  DatePickerRangeHandle,
  DatePickerRangeFormProps,
  DateRangeValue,
} from './variants/range/date-picker-range';

// multi — несколько дат (Calendar multiple, value: Date[] | null). Отдельная запись каталога.
export { DatePickerMulti } from './variants/multi/date-picker-multi';
export type {
  DatePickerMultiProps,
  DatePickerMultiHandle,
  DatePickerMultiFormProps,
} from './variants/multi/date-picker-multi';

// props-схемы вариантов.
export { datePickerBasePropsSchema } from './variants/base/date-picker-base.props';
export { datePickerRangePropsSchema } from './variants/range/date-picker-range.props';
export { datePickerMultiPropsSchema } from './variants/multi/date-picker-multi.props';
