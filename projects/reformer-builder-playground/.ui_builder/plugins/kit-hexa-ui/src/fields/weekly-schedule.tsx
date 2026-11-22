/**
 * Недельное расписание: HexaUI `WeeklySchedule` — сетка «день × час», выделяемая мышью.
 *
 * Значение модели — формат самого HexaUI: `Record<день, number[]> | null`, ключи — `monday` …
 * `sunday`, у дня — 24 флага часов (`1` отмечен, `0` нет). Расписание без единого часа — `null`.
 *
 * ## Неуправляемый компонент
 *
 * HexaUI читает `initialState` один раз, при монтировании, и дальше держит сетку у себя. Поэтому
 * значение, пришедшее СНАРУЖИ (сброс формы, загрузка данных), обёртка показывает пересозданием
 * компонента — новым `key` ({@link useRemountKey}). Своя правка пересоздания не вызывает.
 *
 * @module reformer/kit-hexa-ui/fields/weekly-schedule
 */

import type { FocusEventHandler } from 'react';
import type { WeeklyScheduleProps as HexaWeeklyScheduleProps } from '@kaspersky/hexa-ui';
// Значения HexaUI — с подпутей: модуль входит в пространство имён билдера (см. `../palette`).
import { WeeklySchedule as HexaWeeklySchedule } from '@kaspersky/hexa-ui/weekly-schedule';
import { scheduleAdapter } from './adapters';
import { BlurScope, useRemountKey } from './control';
import { isNonEmptySchedule, sameSchedule, scheduleOf, type WeeklyScheduleValue } from './convert';

/** Подписи дней недели — `{ monday: 'Пн', … }`. */
export type WeeklyScheduleDays = HexaWeeklyScheduleProps['daysOfWeek'];

/** Подписи легенды — `{ selected, notSelected }`. */
export type WeeklyScheduleLegend = HexaWeeklyScheduleProps['legend'];

/** Пропсы {@link WeeklySchedule}: пропсы HexaUI без начального состояния — его даёт значение. */
export type WeeklyScheduleProps = Omit<
  HexaWeeklyScheduleProps,
  'initialState' | 'onChange' | 'daysOfWeek' | 'legend'
> & {
  value?: WeeklyScheduleValue | null;
  onChange?: (value: WeeklyScheduleValue | null) => void;
  onBlur?: FocusEventHandler;
  /** Подписи дней недели. По умолчанию — сокращения по-русски. */
  daysOfWeek?: WeeklyScheduleDays;
  /** Подписи легенды. По умолчанию — «Выбрано» / «Не выбрано». */
  legend?: WeeklyScheduleLegend;
};

/** Подписи дней по умолчанию. */
const DAYS_RU: WeeklyScheduleDays = {
  monday: 'Пн',
  tuesday: 'Вт',
  wednesday: 'Ср',
  thursday: 'Чт',
  friday: 'Пт',
  saturday: 'Сб',
  sunday: 'Вс',
};

/** Легенда по умолчанию. */
const LEGEND_RU: WeeklyScheduleLegend = { selected: 'Выбрано', notSelected: 'Не выбрано' };

/** Недельное расписание: HexaUI `WeeklySchedule`, пересоздаётся на внешнее значение. */
export function WeeklySchedule({
  value,
  onChange,
  onBlur,
  daysOfWeek = DAYS_RU,
  legend = LEGEND_RU,
  ...rest
}: WeeklyScheduleProps) {
  const [key, emitted] = useRemountKey<unknown>(value, sameSchedule);
  return (
    <BlurScope onBlur={onBlur}>
      <HexaWeeklySchedule
        key={key}
        {...rest}
        daysOfWeek={daysOfWeek}
        legend={legend}
        initialState={scheduleOf(value)}
        onChange={(next) => {
          const schedule = isNonEmptySchedule(next) ? next : null;
          emitted(schedule);
          onChange?.(schedule);
        }}
      />
    </BlurScope>
  );
}
WeeklySchedule.reformerAdapter = scheduleAdapter;
