// base — рецепт DatePicker (Popover + Calendar single + Button-триггер с date-fns форматированием).
export { DatePicker } from './variants/base/date-picker-base';
export type { DatePickerProps } from './variants/base/date-picker-base';

// field-версия single-date + алиас DatePickerField (дефолтный для форм).
export { DatePickerBaseField } from './variants/base/date-picker-base.field';
export { DatePickerBaseField as DatePickerField } from './variants/base/date-picker-base.field';

// props-схема варианта.
export { datePickerBasePropsSchema } from './variants/base/date-picker-base.props';
