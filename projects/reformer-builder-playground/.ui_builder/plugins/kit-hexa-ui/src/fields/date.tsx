/**
 * Дата и время: `DatePicker`, `DatePickerRange` (имена ui-kit), `TimeInput`, `TimeRange` (свои
 * у HexaUI).
 *
 * Значения модели: дата — `Date | null` (HexaUI `Calendar` держит `DateInputValue = Date | null`),
 * период — кортеж `[Date, Date] | null`, время — строка `'ЧЧ:ММ'` либо `null`, интервал времени —
 * `[string, string] | null`. Неполный период и интервал модель видит как `null`; контрол при этом
 * показывает то, что уже выбрано (черновик — {@link useDraft}).
 *
 * Формат даты в схеме — `dateFormat` в токенах date-fns, как у ui-kit; HexaUI получает его в своём
 * виде (`format`). Календари открываются в контейнере всплывающих окон кита.
 *
 * ## Календари — лениво
 *
 * HexaUI `Calendar` и `RangePicker` стоят на antd `DatePicker` с генератором date-fns, а тот
 * тянет ВСЕ локали date-fns — около двух мегабайт. Поэтому календарь грузится `import()` с подпути
 * HexaUI при первой отрисовке поля, а до тех пор на его месте — пустое поле только для чтения.
 * Время (`TimeInput`, `TimeRange`) — это маска на `Textbox`, ему ленивость не нужна.
 *
 * @module reformer/kit-hexa-ui/fields/date
 */

import type {
  CalendarProps,
  RangeDateInputValue,
  RangePickerProps,
  RangeTimeInputProps,
  TimeInputProps as HexaTimeInputProps,
} from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { Textbox } from '@kaspersky/hexa-ui/input';
import { RangeTimeInput, TimeInput as HexaTimeInput } from '@kaspersky/hexa-ui/time-input';
import { lazy, Suspense, type ComponentType, type FocusEventHandler } from 'react';
import { useKitPopupContainer } from '../popup-container';
import { dateAdapter, dateRangeAdapter, textAdapter, timeRangeAdapter } from './adapters';
import { BlurScope, fieldControl, useDraft } from './control';
import { hexaDateFormat, isDateRange, isStringPair, samePair, sameRange } from './convert';

/** Пропсы {@link DatePicker}: пропсы HexaUI `Calendar`, формат — `dateFormat`, значение — дата. */
export type DatePickerProps = Omit<CalendarProps, 'format' | 'value' | 'onChange'> & {
  /** Формат даты в токенах date-fns: `'dd.MM.yyyy'`. По умолчанию — формат локали HexaUI. */
  dateFormat?: string;
  value?: Date | null;
  onChange?: (value: Date | null) => void;
};

/**
 * Календари HexaUI — с подпути, лениво. Их собственный тип объявлен через `VFC`, которого в
 * `@types/react` 19 нет, поэтому тип пропсов задаётся здесь явно.
 */
const Calendar = lazy(() =>
  import('@kaspersky/hexa-ui/datepicker').then((module) => ({
    default: module.Calendar as ComponentType<CalendarProps>,
  }))
);
const RangePicker = lazy(() =>
  import('@kaspersky/hexa-ui/datepicker').then((module) => ({
    default: module.RangePicker as ComponentType<RangePickerProps>,
  }))
);

/** Пока календарь грузится — пустое поле только для чтения той же высоты. */
function DateFallback({ placeholder }: { placeholder?: unknown }) {
  return (
    <Textbox readOnly placeholder={typeof placeholder === 'string' ? placeholder : undefined} />
  );
}

/** Выбор даты: HexaUI `Calendar` (antd `DatePicker` на date-fns). */
export function DatePicker({ dateFormat, value, onChange, ...rest }: DatePickerProps) {
  const popupContainer = useKitPopupContainer();
  return (
    <Suspense fallback={<DateFallback placeholder={rest.placeholder} />}>
      <Calendar
        getPopupContainer={popupContainer}
        {...rest}
        format={dateFormat === undefined ? undefined : hexaDateFormat(dateFormat)}
        value={value ?? null}
        onChange={(date: Date | null) => onChange?.(date)}
      />
    </Suspense>
  );
}
DatePicker.reformerAdapter = dateAdapter;

/** Пропсы {@link DatePickerRange}: пропсы HexaUI `RangePicker`, значение — полный период. */
export type DatePickerRangeProps = Omit<RangePickerProps, 'format' | 'value' | 'onChange'> & {
  /** Формат даты в токенах date-fns: `'dd.MM.yyyy'`. По умолчанию — формат локали HexaUI. */
  dateFormat?: string;
  value?: [Date, Date] | null;
  onChange?: (value: [Date, Date] | null) => void;
};

/** Полный период из черновика либо `null`. */
const fullRange = (range: RangeDateInputValue): [Date, Date] | null =>
  isDateRange(range) ? range : null;

/**
 * Выбор периода: HexaUI `RangePicker`. После первой даты HexaUI отдаёт неполный период —
 * модель получает `null`, а календарь продолжает показывать выбранное начало.
 */
export function DatePickerRange({ dateFormat, value, onChange, ...rest }: DatePickerRangeProps) {
  const popupContainer = useKitPopupContainer();
  const [draft, update] = useDraft<[Date, Date] | null | undefined, RangeDateInputValue>(
    value,
    (range) => (isDateRange(range) ? range : null),
    sameRange
  );
  return (
    <Suspense fallback={<DateFallback />}>
      <RangePicker
        getPopupContainer={popupContainer}
        {...rest}
        format={dateFormat === undefined ? undefined : hexaDateFormat(dateFormat)}
        value={draft}
        onChange={(range: RangeDateInputValue) => {
          const emitted = fullRange(range);
          update(range, emitted);
          onChange?.(emitted);
        }}
      />
    </Suspense>
  );
}
DatePickerRange.reformerAdapter = dateRangeAdapter;

/** Пропсы {@link TimeInput} — пропсы HexaUI `TimeInput` (формат `HH:mm` и др.). */
export type TimeInputProps = HexaTimeInputProps;

/** Время: HexaUI `TimeInput` — поле с маской времени, `onChange(text)`. */
export const TimeInput = fieldControl<TimeInputProps>(HexaTimeInput, 'TimeInput', {
  reformerAdapter: textAdapter,
});

/** Пропсы {@link TimeRange}: пропсы HexaUI `RangeTimeInput`, начало и конец — одним значением. */
export type TimeRangeProps = Omit<
  RangeTimeInputProps,
  'valueStart' | 'valueEnd' | 'onChangeStart' | 'onChangeEnd'
> & {
  value?: [string, string] | null;
  onChange?: (value: [string, string] | null) => void;
  onBlur?: FocusEventHandler;
};

/**
 * Интервал времени: HexaUI `RangeTimeInput` — два поля со своими `onChangeStart`/`onChangeEnd`.
 * Обёртка сводит их в одно значение-пару; пока заполнено одно поле, модель видит `null`.
 */
export function TimeRange({ value, onChange, onBlur, ...rest }: TimeRangeProps) {
  const [draft, update] = useDraft<[string, string] | null | undefined, [string, string]>(
    value,
    // Поле-кортеж хранит «пусто» как [], а не null: всё, чего нет, — пустая строка.
    (pair) => (Array.isArray(pair) ? [pair[0] ?? '', pair[1] ?? ''] : ['', '']),
    samePair
  );
  const change = (next: [string, string]): void => {
    const emitted = isStringPair(next) ? next : null;
    update(next, emitted);
    onChange?.(emitted);
  };
  return (
    <BlurScope onBlur={onBlur}>
      <RangeTimeInput
        {...rest}
        valueStart={draft[0]}
        valueEnd={draft[1]}
        onChangeStart={(start) => change([start, draft[1]])}
        onChangeEnd={(end) => change([draft[0], end])}
      />
    </BlurScope>
  );
}
TimeRange.reformerAdapter = timeRangeAdapter;
