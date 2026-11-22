// base — pure shadcn Calendar (обёртка react-day-picker DayPicker): Calendar + CalendarDayButton.
export { Calendar, CalendarDayButton } from './variants/base/calendar-base';

// single — одна дата (mode="single" зашит) + проп tooltip. Компонент для формы (registry Calendar).
export { CalendarSingle, type CalendarSingleProps } from './variants/base/calendar-single';

// props-схема варианта.
export { calendarBasePropsSchema } from './variants/base/calendar-base.props';
