// base — pure shadcn Calendar (обёртка react-day-picker DayPicker): Calendar + CalendarDayButton.
export { Calendar, CalendarDayButton } from './variants/base/calendar-base';

// field-версия single-date + алиас CalendarField (дефолтный для форм).
export { CalendarBaseField } from './variants/base/calendar-base.field';
export { CalendarBaseField as CalendarField } from './variants/base/calendar-base.field';

// props-схема варианта.
export { calendarBasePropsSchema } from './variants/base/calendar-base.props';
